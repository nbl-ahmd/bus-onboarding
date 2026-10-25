import { afterEach, expect, it, vi } from "vitest";
import { BrowserPlaybackAdapter } from "../src/adapters/speech";
import { createWorkspace } from "../src/domain/seed";
import { buildPlaybackSequence } from "../src/domain/playback";
function fakeSpeech() {
  const spoken: string[] = [];
  class Utterance {
    text: string;
    voice = null;
    lang = "";
    rate = 1;
    onend?: () => void;
    onerror?: (event: { error: string }) => void;
    constructor(text: string) {
      this.text = text;
    }
  }
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  let pending: ReturnType<typeof setTimeout> | undefined;
  vi.stubGlobal("window", {
    speechSynthesis: {
      getVoices: () => [
        { voiceURI: "en", lang: "en-IN" },
        { voiceURI: "ml", lang: "ml-IN" },
      ],
      speak: (utterance: Utterance) => {
        spoken.push(utterance.lang);
        pending = setTimeout(() => utterance.onend?.(), 10);
      },
      cancel: () => clearTimeout(pending),
    },
  });
  return spoken;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("one playback operation speaks every part in the configured order", async () => {
  vi.useFakeTimers();
  const spoken = fakeSpeech();
  const player = new BrowserPlaybackAdapter();
  const items = buildPlaybackSequence("en-ml", 2, "grouped").map(
    (language) => ({
      language,
      text: language === "en" ? "Welcome" : "സ്വാഗതം",
    }),
  );
  const progress: number[] = [];
  const finished = player.play(
    items,
    createWorkspace().preferences,
    (_, index, total) => progress.push(index + total),
  );
  await vi.runAllTimersAsync();
  await finished;
  expect(spoken).toEqual(["en-IN", "en-IN", "ml-IN", "ml-IN"]);
  expect(progress).toEqual([4, 5, 6, 7]);
});
it("stop during the pause cancels all remaining languages", async () => {
  vi.useFakeTimers();
  const spoken = fakeSpeech();
  const player = new BrowserPlaybackAdapter();
  const result = player
    .play(
      buildPlaybackSequence("en-ml", 2).map((language) => ({
        language,
        text: "Test",
      })),
      createWorkspace().preferences,
      () => {},
    )
    .catch((error) => error.message);
  await vi.advanceTimersByTimeAsync(20);
  player.stop();
  await vi.runAllTimersAsync();
  await expect(result).resolves.toBe("STOPPED");
  expect(spoken).toEqual(["en-IN"]);
});
