import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseWorkspaceGateway } from "../src/adapters/supabase";
import { createWorkspace } from "../src/domain/seed";
import type { AnnouncementEvent, Mutation } from "../src/domain/models";
it("syncs a trip before its event even when a later edit moved the trip to the end of the outbox", async () => {
  const workspace = createWorkspace();
  const trip = workspace.trips[0];
  const event: AnnouncementEvent = {
    id: "event",
    tripId: trip.id,
    fleetId: trip.fleetId,
    driverId: trip.driverId,
    templateId: "welcome",
    title: "Welcome aboard",
    languageMode: "en",
    at: new Date().toISOString(),
    status: "played",
    source: "saved-audio",
    detail: "",
    trigger: "manual",
  };
  const calls: string[] = [];
  const fake = {
    from: (table: string) => ({
      upsert: async () => {
        if (table === "announcement_events" && !calls.includes("trips"))
          return { error: { message: "Trip foreign key missing" } };
        calls.push(table);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  const mutations: Mutation[] = [
    { kind: "event", id: event.id, payload: event },
    { kind: "trip", id: trip.id, payload: trip },
    {
      kind: "vehicle",
      id: workspace.vehicles[0].id,
      payload: workspace.vehicles[0],
    },
  ];
  await expect(
    new SupabaseWorkspaceGateway(fake).push(mutations),
  ).resolves.toHaveLength(3);
  expect(calls).toEqual(["vehicles", "trips", "announcement_events"]);
});
