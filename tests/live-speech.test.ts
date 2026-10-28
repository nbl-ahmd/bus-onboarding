import { afterEach, expect, it, vi } from "vitest";
import type { LiveServerMessage } from "@google/genai";
import {
  GeminiLiveSpeechProvider,
  type LiveConnector,
  type LiveSession,
} from "../src/adapters/live-speech";
import { pcmToWav, transcriptMatches } from "../src/domain/live-speech";
const chunk = Buffer.alloc(4800, 1).toString("base64");
function fixture(complete = true) {
  const connections: Parameters<LiveConnector>[0][] = [];
  const closed = vi.fn();
  const sent: string[] = [];
  const connector: LiveConnector = vi.fn(async (options) => {
    connections.push(options);
    return {
      close: closed,
      sendClientContent: (
        input: Parameters<LiveSession["sendClientContent"]>[0],
      ) => {
        sent.push(input.turns[0].parts[0].text);
        if (complete)
          queueMicrotask(() =>
            options.onmessage({
              serverContent: {
                modelTurn: {
                  parts: [
                    {
                      inlineData: {
                        data: chunk,
                        mimeType: "audio/pcm;rate=24000",
                      },
                    },
                    {
                      inlineData: {
                        data: chunk,
                        mimeType: "audio/pcm;rate=24000",
                      },
                    },
                  ],
                },
                outputTranscription: { text: sent.at(-1) },
                turnComplete: true,
              },
            } as LiveServerMessage),
          );
      },
    };
  });
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      token: "auth_tokens/test-only",
      model: "gemini-3.8-live",
      voice: "Kore",
    }),
  }));
  vi.stubGlobal("fetch", fetcher);
  return {
    provider: new GeminiLiveSpeechProvider(
      "Kore",
      "gemini-3.8-live",
      connector,
    ),
    connector,
    fetcher,
    connections,
    sent,
    closed,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("captures every audio part as WAV and reuses a session for independent clips", async () => {
  const f = fixture();
  const a = await f.provider.synthesize("Welcome aboard", "en");
  const b = await f.provider.synthesize("Next stop", "en");
  expect(a.size).toBe(9644);
  expect(b.size).toBe(9644);
  expect(
    Buffer.from(await a.arrayBuffer())
      .subarray(0, 4)
      .toString(),
  ).toBe("RIFF");
  expect(f.provider.transcript).toBe("Next stop");
  expect(f.connector).toHaveBeenCalledTimes(1);
  expect(f.fetcher).toHaveBeenCalledTimes(1);
  expect(f.sent).toEqual(["Welcome aboard", "Next stop"]);
  expect(
    (f.connections[0].config.systemInstruction as { parts: { text: string }[] })
      .parts[0].text,
  ).toContain("Indian English");
  f.provider.dispose();
  expect(f.closed).toHaveBeenCalledTimes(1);
});
it("rotates bounded sessions after six clips and on language changes", async () => {
  const f = fixture();
  for (let i = 0; i < 7; i++) await f.provider.synthesize(`Clip ${i}`, "en");
  expect(f.connector).toHaveBeenCalledTimes(2);
  await f.provider.synthesize("സ്വാഗതം", "ml");
  expect(f.connector).toHaveBeenCalledTimes(3);
  expect(
    (f.connections[2].config.systemInstruction as { parts: { text: string }[] })
      .parts[0].text,
  ).toContain("Malayalam");
  f.provider.dispose();
});
it("discards an interrupted recording and can start a fresh session", async () => {
  const f = fixture(false);
  const pending = f.provider
    .synthesize("Welcome", "en")
    .catch((error) => error.message);
  await vi.waitFor(() => expect(f.sent).toHaveLength(1));
  f.connections[0].onmessage({
    serverContent: {
      modelTurn: {
        parts: [
          { inlineData: { data: chunk, mimeType: "audio/pcm;rate=24000" } },
        ],
      },
      interrupted: true,
    },
  } as LiveServerMessage);
  expect(await pending).toContain("connection ended");
  const retry = f.provider.synthesize("Retry", "en");
  await vi.waitFor(() => expect(f.sent).toHaveLength(2));
  // Late events from the previous socket must never complete the new clip.
  f.connections[0].onmessage({
    serverContent: { turnComplete: true },
  } as LiveServerMessage);
  f.connections[1].onmessage({
    serverContent: {
      modelTurn: {
        parts: [
          { inlineData: { data: chunk, mimeType: "audio/pcm;rate=24000" } },
        ],
      },
      turnComplete: true,
    },
  } as LiveServerMessage);
  expect((await retry).size).toBe(4844);
  f.provider.dispose();
});
it("cancel closes the socket and rejects without returning partial audio", async () => {
  const f = fixture(false);
  const controller = new AbortController();
  const pending = f.provider
    .synthesize("Welcome", "en", controller.signal)
    .catch((error) => error.name);
  await vi.waitFor(() => expect(f.sent).toHaveLength(1));
  controller.abort();
  expect(await pending).toBe("AbortError");
  expect(f.closed).toHaveBeenCalled();
});
it("connection loss never accepts a partial recording", async () => {
  const f = fixture(false);
  const pending = f.provider
    .synthesize("Welcome", "en")
    .catch((error) => error.message);
  await vi.waitFor(() => expect(f.sent).toHaveLength(1));
  f.connections[0].onmessage({
    serverContent: {
      modelTurn: {
        parts: [
          { inlineData: { data: chunk, mimeType: "audio/pcm;rate=24000" } },
        ],
      },
    },
  } as LiveServerMessage);
  f.connections[0].onclose();
  expect(await pending).toContain("connection ended");
  f.provider.dispose();
});
it("rejects empty/truncated PCM and uses transcripts only as a review aid", () => {
  expect(() => pcmToWav([])).toThrow();
  expect(() => pcmToWav([new Uint8Array(4801)])).toThrow();
  expect(transcriptMatches("Welcome, Ravi!", "welcome Ravi.")).toBe(true);
  expect(transcriptMatches("Arrival at 7 AM", "Arrival at 8 AM")).toBe(false);
  expect(transcriptMatches("സ്വാഗതം", "")).toBe(false);
});
