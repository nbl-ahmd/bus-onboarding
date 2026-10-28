import { openDB, type DBSchema } from "idb";
import type { Language, Workspace } from "@/domain/models";
import { templates } from "@/domain/templates";
import { createWorkspace } from "@/domain/seed";
import { normalizePlaybackPreferences } from "@/domain/playback";
export interface AudioRecord {
  fleetId: string;
  key: string;
  blob: Blob;
  createdAt: string;
  language: Language;
  title: string;
  text: string;
  origin: "gemini" | "uploaded";
}
interface PilotDB extends DBSchema {
  workspaces: { key: string; value: Workspace };
  audio: { key: string; value: AudioRecord; indexes: { "by-created": string } };
}
const db = () =>
  openDB<PilotDB>("nightline-v1", 1, {
    upgrade(database) {
      database.createObjectStore("workspaces");
      const audio = database.createObjectStore("audio", { keyPath: "key" });
      audio.createIndex("by-created", "createdAt");
    },
  });
export interface WorkspaceRepository {
  load(owner: string): Promise<Workspace>;
  save(owner: string, state: Workspace): Promise<void>;
}
export class IndexedDBWorkspaceRepository implements WorkspaceRepository {
  async load(owner: string) {
    const state =
      (await (await db()).get("workspaces", owner)) || createWorkspace();
    return {
      ...state,
      templates: [
        ...templates.filter(
          (t) => !state.templates.some((old) => old.id === t.id),
        ),
        ...state.templates,
      ],
      preferences: normalizePlaybackPreferences({
        ...createWorkspace().preferences,
        ...state.preferences,
      }),
    };
  }
  async save(owner: string, state: Workspace) {
    await (await db()).put("workspaces", state, owner);
  }
}
export const workspaceRepository = new IndexedDBWorkspaceRepository();
export async function audioKey(
  text: string,
  language: Language,
  variant: string,
  fleetId: string,
) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify([fleetId, text, language, variant]),
    ),
  );
  return [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export const audioRepository = {
  async get(key: string) {
    return (await db()).get("audio", key);
  },
  async put(value: AudioRecord) {
    await (await db()).put("audio", value);
  },
  async list() {
    return (await db()).getAll("audio");
  },
  async remove(key: string) {
    await (await db()).delete("audio", key);
  },
};
