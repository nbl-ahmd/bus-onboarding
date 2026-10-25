import { expect, it } from "vitest";
import { getPlaybackReadiness } from "../src/domain/playback";
it("identifies missing Malayalam before attempting bilingual playback", () => {
  expect(getPlaybackReadiness(["ml", "en"], [], ["en-IN"], "device")).toEqual({
    missing: ["ml"],
    canPlay: false,
    offlineReady: false,
  });
});
it("allows a saved Malayalam voice paired with an English device voice without promising offline readiness", () => {
  expect(
    getPlaybackReadiness(["ml", "en"], ["ml"], ["en-IN"], "device"),
  ).toEqual({ missing: [], canPlay: true, offlineReady: false });
});
it("requires saved audio in Gemini mode even when device voices exist", () => {
  expect(getPlaybackReadiness(["en"], [], ["en-IN"], "gemini").canPlay).toBe(
    false,
  );
  expect(
    getPlaybackReadiness(["ml", "en"], ["ml", "en"], [], "gemini"),
  ).toEqual({ missing: [], canPlay: true, offlineReady: true });
});

import {
  buildPlaybackSequence,
  normalizePlaybackPreferences,
} from "../src/domain/playback";
it("builds English then Malayalam repeated as pairs", () => {
  expect(buildPlaybackSequence("en-ml", 2, "alternating")).toEqual([
    "en",
    "ml",
    "en",
    "ml",
  ]);
});
it("groups both English copies before both Malayalam copies", () => {
  expect(buildPlaybackSequence("en-ml", 2, "grouped")).toEqual([
    "en",
    "en",
    "ml",
    "ml",
  ]);
});
it("honors Malayalam-first and single-language settings with bounded repeats", () => {
  expect(buildPlaybackSequence("ml-en", 2, "grouped")).toEqual([
    "ml",
    "ml",
    "en",
    "en",
  ]);
  expect(buildPlaybackSequence("en", 3, "alternating")).toEqual([
    "en",
    "en",
    "en",
  ]);
  expect(buildPlaybackSequence("en-ml", 999, "alternating")).toHaveLength(6);
  expect(
    buildPlaybackSequence("en-ml", Number.NaN, "alternating"),
  ).toHaveLength(4);
});
it("migrates existing phone preferences without discarding language order", () => {
  const migrated = normalizePlaybackPreferences({
    languageMode: "ml-en",
    favoriteIds: ["welcome"],
  } as const);
  expect(migrated).toMatchObject({
    languageMode: "ml-en",
    repetitions: 2,
    repeatPattern: "alternating",
    haptics: true,
    gestures: true,
  });
});
