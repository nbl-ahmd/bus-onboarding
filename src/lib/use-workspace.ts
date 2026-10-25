"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Mutation,
  ServiceConfig,
  SessionIdentity,
  Workspace,
} from "@/domain/models";
import { createWorkspace } from "@/domain/seed";
import { workspaceRepository } from "@/adapters/storage";
import { getSupabase, SupabaseWorkspaceGateway } from "@/adapters/supabase";
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [online, setOnline] = useState(true);
  const [config, setConfig] = useState<ServiceConfig>({
    supabase: false,
    gemini: false,
    pilotCode: false,
    weather: false,
    voice: "Kore",
    model: "",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const owner = useRef("local-pilot");
  const current = useRef<Workspace | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const save = useCallback((next: Workspace) => {
    current.current = next;
    setWorkspace(next);
    const key = owner.current;
    saving.current = saving.current
      .catch(() => {})
      .then(() => workspaceRepository.save(key, next))
      .catch(() => {
        setNotice(
          "This phone could not save your changes. Free some storage and export your trip as a backup.",
        );
      });
    return saving.current;
  }, []);
  useEffect(() => {
    let alive = true;
    const network = () => setOnline(navigator.onLine);
    network();
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    workspaceRepository
      .load("local-pilot")
      .then((state) => {
        if (alive) {
          current.current = state;
          setWorkspace(state);
        }
      })
      .catch(() => {
        if (alive) {
          const state = createWorkspace();
          current.current = state;
          setWorkspace(state);
          setNotice(
            "Private browsing or storage settings may prevent offline saving.",
          );
        }
      });
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (alive) setConfig(data);
      })
      .catch(() => {});
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {
        setNotice(
          "Offline app setup failed. Refresh while connected before the trip.",
        );
      });
    return () => {
      alive = false;
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  const update = useCallback(
    (transform: (state: Workspace) => Workspace, mutation?: Mutation) => {
      if (!current.current) return;
      let next = transform(current.current);
      if (mutation && owner.current !== "local-pilot")
        next = {
          ...next,
          pending: [
            ...next.pending.filter(
              (m) => !(m.id === mutation.id && m.kind === mutation.kind),
            ),
            mutation,
          ],
        };
      return save(next);
    },
    [save],
  );
  const connectCloud = useCallback(async () => {
    const db = getSupabase();
    if (!db) throw new Error("Configure Supabase first.");
    setBusy(true);
    try {
      const result = await new SupabaseWorkspaceGateway(db).pull();
      const key = `user:${result.identity.id}`;
      const existing = await workspaceRepository.load(key);
      const isExisting = existing.fleet.id === result.identity.fleetId;
      const next = {
        ...result.workspace,
        preferences:
          current.current?.preferences || result.workspace.preferences,
        activeTripId:
          isExisting &&
          result.workspace.trips.some((t) => t.id === existing.activeTripId)
            ? existing.activeTripId
            : result.workspace.activeTripId,
        pending: isExisting ? existing.pending : [],
      };
      if (isExisting) {
        for (const mutation of existing.pending) applyMutation(next, mutation);
      }
      owner.current = key;
      setIdentity(result.identity);
      save(next);
      localStorage.setItem(
        "nightline-cloud-identity",
        JSON.stringify(result.identity),
      );
    } finally {
      setBusy(false);
    }
  }, [save]);
  const restored = useRef(false);
  useEffect(() => {
    if (!workspace || restored.current) return;
    restored.current = true;
    const db = getSupabase();
    if (!db) return;
    db.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      if (navigator.onLine) {
        await connectCloud().catch((error) =>
          setNotice(
            error.message === "NO_FLEET"
              ? "Sign in and create your fleet to finish cloud setup."
              : error.message,
          ),
        );
      } else {
        try {
          const stored = JSON.parse(
            localStorage.getItem("nightline-cloud-identity") || "null",
          ) as SessionIdentity | null;
          if (stored?.id === data.session.user.id) {
            const state = await workspaceRepository.load(`user:${stored.id}`);
            if (state.fleet.id !== stored.fleetId) return;
            owner.current = `user:${stored.id}`;
            setIdentity(stored);
            current.current = state;
            setWorkspace(state);
          }
        } catch {
          setNotice("Reconnect to restore your fleet account.");
        }
      }
    });
  }, [workspace, connectCloud]);
  const sync = useCallback(async () => {
    const db = getSupabase();
    if (!db || !identity || !current.current)
      throw new Error("Sign in to synchronize this phone with your fleet.");
    setBusy(true);
    try {
      const snapshot = current.current;
      const gateway = new SupabaseWorkspaceGateway(db);
      await gateway.push(snapshot.pending);
      const result = await gateway.pull();
      const latest = current.current;
      const pending = latest.pending.filter(
        (m) =>
          !snapshot.pending.some(
            (sent) =>
              sent.id === m.id &&
              sent.kind === m.kind &&
              JSON.stringify(sent.payload) === JSON.stringify(m.payload),
          ),
      );
      const merged = {
        ...result.workspace,
        preferences: latest.preferences,
        activeTripId: result.workspace.trips.some(
          (t) => t.id === latest.activeTripId,
        )
          ? latest.activeTripId
          : result.workspace.activeTripId,
        pending,
      };
      for (const mutation of pending) applyMutation(merged, mutation);
      save(merged);
      setNotice("Fleet synchronized. Your latest changes are saved.");
    } finally {
      setBusy(false);
    }
  }, [identity, save]);
  const disconnect = useCallback(async () => {
    await saving.current;
    await getSupabase()?.auth.signOut();
    await fetch("/api/pilot/session", { method: "DELETE" }).catch(() => {});
    localStorage.removeItem("nightline-cloud-identity");
    owner.current = "local-pilot";
    setIdentity(null);
    const next = await workspaceRepository.load("local-pilot");
    current.current = next;
    setWorkspace(next);
  }, []);
  return {
    workspace,
    identity,
    online,
    config,
    busy,
    notice,
    setNotice,
    update,
    connectCloud,
    sync,
    disconnect,
  };
}
function applyMutation(state: Workspace, mutation: Mutation) {
  if (mutation.kind === "trip")
    state.trips = [
      ...state.trips.filter((t) => t.id !== mutation.id),
      mutation.payload as Workspace["trips"][number],
    ];
  if (mutation.kind === "vehicle")
    state.vehicles = [
      ...state.vehicles.filter((t) => t.id !== mutation.id),
      mutation.payload as Workspace["vehicles"][number],
    ];
  if (mutation.kind === "template")
    state.templates = [
      ...state.templates.filter((t) => t.id !== mutation.id),
      mutation.payload as Workspace["templates"][number],
    ];
  if (mutation.kind === "event")
    state.events = [
      mutation.payload as Workspace["events"][number],
      ...state.events.filter((t) => t.id !== mutation.id),
    ];
}
