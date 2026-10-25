import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Driver,
  Mutation,
  SessionIdentity,
  Workspace,
} from "@/domain/models";
import { templates } from "@/domain/templates";
let client: SupabaseClient | null = null;
export const cloudConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
export function getSupabase() {
  if (!cloudConfigured) return null;
  if (!client)
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  return client;
}
export interface CloudWorkspaceGateway {
  pull(): Promise<{ workspace: Workspace; identity: SessionIdentity }>;
  push(mutations: Mutation[]): Promise<string[]>;
}
export class SupabaseWorkspaceGateway implements CloudWorkspaceGateway {
  constructor(private db: SupabaseClient) {}
  async pull() {
    const {
      data: { user },
      error: authError,
    } = await this.db.auth.getUser();
    if (authError || !user)
      throw new Error("Sign in to synchronize your fleet.");
    const { data: member, error: memberError } = await this.db
      .from("fleet_members")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("NO_FLEET");
    const results = await Promise.all([
      this.db.from("fleets").select("*").eq("id", member.fleet_id).single(),
      this.db.from("fleet_members").select("*").eq("fleet_id", member.fleet_id),
      this.db.from("vehicles").select("*").eq("fleet_id", member.fleet_id),
      this.db
        .from("trips")
        .select("*")
        .eq("fleet_id", member.fleet_id)
        .order("updated_at", { ascending: false })
        .limit(100),
      this.db
        .from("announcement_templates")
        .select("*")
        .eq("fleet_id", member.fleet_id),
      this.db
        .from("announcement_events")
        .select("*")
        .eq("fleet_id", member.fleet_id)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    for (const result of results)
      if (result.error) throw new Error(result.error.message);
    const [fleet, members, vehicles, trips, custom, events] = results;
    const drivers: Driver[] = members.data!.map((m) => ({
      id: m.user_id,
      fleetId: m.fleet_id,
      name: m.display_name,
      email: m.email,
      role: m.role,
    }));
    const identity: SessionIdentity = {
      id: user.id,
      fleetId: member.fleet_id,
      name: member.display_name,
      email: user.email || "",
      role: member.role,
    };
    const allTemplates = new Map(templates.map((t) => [t.id, t]));
    custom.data!.forEach((t) => allTemplates.set(t.id, t.payload));
    const { createWorkspace } = await import("@/domain/seed");
    const baseline = createWorkspace();
    const workspace: Workspace = {
      ...baseline,
      fleet: { id: fleet.data!.id, name: fleet.data!.name },
      drivers,
      vehicles: vehicles.data!.map((v) => ({
        id: v.id,
        fleetId: v.fleet_id,
        name: v.name,
        registration: v.registration,
      })),
      trips: trips.data!.map((t) => ({
        ...t.payload,
        id: t.id,
        fleetId: t.fleet_id,
        driverId: t.driver_id,
      })),
      templates: [...allTemplates.values()],
      events: events.data!.map((e) => e.payload),
      activeTripId: trips.data![0]?.id || "",
      pending: [],
    };
    return { workspace, identity };
  }
  async push(mutations: Mutation[]) {
    const acknowledged: string[] = [];
    const order = { vehicle: 0, trip: 1, template: 2, event: 3 };
    for (const mutation of [...mutations].sort(
      (a, b) => order[a.kind] - order[b.kind],
    )) {
      let error;
      if (mutation.kind === "trip") {
        const trip = mutation.payload as Workspace["trips"][number];
        ({ error } = await this.db
          .from("trips")
          .upsert({
            id: trip.id,
            fleet_id: trip.fleetId,
            driver_id: trip.driverId,
            vehicle_id: trip.vehicleId || null,
            payload: trip,
            updated_at: trip.updatedAt,
          }));
      } else if (mutation.kind === "vehicle") {
        const vehicle = mutation.payload as Workspace["vehicles"][number];
        ({ error } = await this.db
          .from("vehicles")
          .upsert({
            id: vehicle.id,
            fleet_id: vehicle.fleetId,
            name: vehicle.name,
            registration: vehicle.registration,
          }));
      } else if (mutation.kind === "template") {
        const template = mutation.payload as Workspace["templates"][number];
        const {
          data: { user },
        } = await this.db.auth.getUser();
        const { data: member } = await this.db
          .from("fleet_members")
          .select("fleet_id")
          .eq("user_id", user!.id)
          .single();
        ({ error } = await this.db
          .from("announcement_templates")
          .upsert(
            { id: template.id, fleet_id: member!.fleet_id, payload: template },
            { onConflict: "fleet_id,id" },
          ));
      } else {
        const event = mutation.payload as Workspace["events"][number];
        ({ error } = await this.db
          .from("announcement_events")
          .upsert(
            {
              id: event.id,
              fleet_id: event.fleetId,
              trip_id: event.tripId,
              driver_id: event.driverId,
              payload: event,
              created_at: event.at,
            },
            { ignoreDuplicates: true },
          ));
      }
      if (error)
        throw new Error(
          `Sync stopped: ${error.message}. Your changes remain on this phone.`,
        );
      acknowledged.push(mutation.id);
    }
    return acknowledged;
  }
}
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = (await getSupabase()?.auth.getSession()) || { data: null };
  return data?.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}
