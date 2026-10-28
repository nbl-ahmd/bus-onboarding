import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AudioRecord } from "../src/adapters/storage";
const mocks = vi.hoisted(() => ({
  records: new Map<string, AudioRecord>(),
  synthesize: vi.fn(),
  dispose: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
}));
vi.mock("../src/adapters/storage", () => ({
  audioKey: async (
    text: string,
    language: string,
    variant: string,
    fleet: string,
  ) => JSON.stringify([text, language, variant, fleet]),
  audioRepository: {
    get: async (key: string) => mocks.records.get(key),
    put: async (record: AudioRecord) => {
      mocks.records.set(record.key, record);
    },
  },
}));
vi.mock("../src/adapters/supabase", () => ({
  authHeaders: async () => ({}),
  getSupabase: () => ({
    storage: {
      from: () => ({ upload: mocks.upload, download: mocks.download }),
    },
  }),
}));
vi.mock("../src/adapters/live-speech", () => ({
  GeminiLiveSpeechProvider: class {
    origin = "live";
    transcript = "Welcome";
    synthesize = mocks.synthesize;
    dispose = mocks.dispose;
  },
}));
import {
  findAudio,
  findPreparedAudio,
  isAudioApproved,
} from "../src/adapters/speech";
import { AudioPreparer } from "../src/adapters/prepare-audio";
import { createWorkspace } from "../src/domain/seed";
import { speechVariant } from "../src/domain/voices";
const prefs = createWorkspace().preferences;
const config = {
  supabase: false,
  gemini: true,
  pilotCode: false,
  weather: false,
  model: "gemini-3.8-flash-lite-tts",
  voice: "Kore",
};
beforeEach(() => {
  mocks.records.clear();
  mocks.synthesize.mockResolvedValue(
    new Blob(["complete wav"], { type: "audio/wav" }),
  );
  mocks.download.mockResolvedValue({ data: null });
  mocks.upload.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.clearAllMocks();
});
it("saves Live clips pending, reuses them without generation and releases them only after approval", async () => {
  const preparer = new AudioPreparer("fleet", prefs, config, false);
  const first = await preparer.prepare("Welcome", "en", "Welcome aboard");
  const variant = speechVariant(config, prefs, "en");
  expect(first.record.origin).toBe("live");
  expect(first.record.reviewStatus).toBe("pending");
  expect(await findAudio("Welcome", "en", "fleet", variant)).toBeUndefined();
  expect(
    (await findPreparedAudio("Welcome", "en", "fleet", variant))?.key,
  ).toBe(first.record.key);
  expect(
    (await preparer.prepare("Welcome", "en", "Welcome aboard")).reused,
  ).toBe(true);
  expect(mocks.synthesize).toHaveBeenCalledTimes(1);
  mocks.records.set(first.record.key, {
    ...first.record,
    reviewStatus: "approved",
  });
  expect(await findAudio("Welcome", "en", "fleet", variant)).toBeDefined();
  preparer.dispose();
});
it("never uploads unreviewed Live clips to the fleet", async () => {
  const preparer = new AudioPreparer("fleet", prefs, config, true);
  await preparer.prepare("Welcome", "en", "Welcome aboard");
  expect(mocks.download).toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  preparer.dispose();
});
it("downloads shared Live clips into pending review on a new phone", async () => {
  mocks.download.mockResolvedValue({ data: new Blob(["fleet recording"]) });
  const preparer = new AudioPreparer("fleet", prefs, config, true);
  const result = await preparer.prepare("Welcome", "en", "Welcome aboard");
  expect(result.downloaded).toBe(true);
  expect(isAudioApproved(result.record)).toBe(false);
  expect(mocks.synthesize).not.toHaveBeenCalled();
  preparer.dispose();
});
it("a cancelled clip is never saved and uploads/legacy voices keep their existing policy", async () => {
  const controller = new AbortController();
  mocks.synthesize.mockImplementation(async () => {
    controller.abort();
    return new Blob(["partial"]);
  });
  const preparer = new AudioPreparer("fleet", prefs, config, false);
  await expect(
    preparer.prepare("Welcome", "en", "Welcome aboard", controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.records.size).toBe(0);
  expect(isAudioApproved({ origin: "uploaded" } as AudioRecord)).toBe(true);
  expect(isAudioApproved({ origin: "gemini" } as AudioRecord)).toBe(true);
  expect(isAudioApproved({ origin: "live" } as AudioRecord)).toBe(false);
  preparer.dispose();
});

it("regenerates just one cached clip with a fresh review identity", async () => {
  const preparer = new AudioPreparer("fleet", prefs, config, false);
  const original = await preparer.prepare("Welcome", "en", "Welcome aboard");
  mocks.records.set(original.record.key, {
    ...original.record,
    reviewStatus: "approved",
  });
  const replacement = await preparer.prepare(
    "Welcome",
    "en",
    "Welcome aboard",
    undefined,
    true,
  );
  expect(replacement.record.key).toBe(original.record.key);
  expect(replacement.record.recordingId).not.toBe(original.record.recordingId);
  expect(replacement.record.reviewStatus).toBe("pending");
  expect(mocks.synthesize).toHaveBeenCalledTimes(2);
  preparer.dispose();
});
