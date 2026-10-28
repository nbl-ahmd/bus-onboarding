import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("../src/lib/server-auth", () => ({
  authorize: vi.fn(async () => ({ db: null })),
  sameOrigin: vi.fn(() => true),
}));
import { POST } from "../src/app/api/speech/route";
const request = (voice = "Kore") =>
  new NextRequest("http://localhost:3100/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Welcome aboard", language: "en", voice }),
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("uses the Flash-Lite interactions API with the chosen voice and returns WAV", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
  vi.stubEnv("GEMINI_TTS_MODEL", "");
  const wav = Buffer.alloc(48);
  wav.write("RIFF");
  const fetcher = vi.fn(async (...args: [string, RequestInit]) => {
    void args;
    return Response.json({
      steps: [
        {
          type: "model_output",
          content: [
            {
              type: "audio",
              data: wav.toString("base64"),
              mime_type: "audio/wav",
            },
          ],
        },
      ],
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await POST(request("Puck"));
  expect(result.status).toBe(200);
  expect(result.headers.get("Content-Type")).toBe("audio/wav");
  expect((fetcher.mock.calls[0] as [string, RequestInit])[0]).toBe(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
  );
  const body = JSON.parse(
    (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as string,
  );
  expect(body.model).toBe("gemini-3.8-flash-lite-tts");
  expect(body.generation_config.speech_config[0].voice).toBe("Puck");
  expect(
    Buffer.from(await result.arrayBuffer())
      .subarray(0, 4)
      .toString(),
  ).toBe("RIFF");
});
it("keeps the old configured model adapter available and wraps PCM", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
  vi.stubEnv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: Buffer.alloc(48).toString("base64"),
                    mimeType: "audio/L16;rate=24000",
                  },
                },
              ],
            },
          },
        ],
      }),
    ),
  );
  const result = await POST(request());
  expect(result.status).toBe(200);
  expect(
    Buffer.from(await result.arrayBuffer())
      .subarray(0, 4)
      .toString(),
  ).toBe("RIFF");
});
it("rejects unknown voices and surfaces provider quota errors without leaking credentials", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
  expect((await POST(request("invalid"))).status).toBe(400);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "sensitive upstream error" }, { status: 429 }),
    ),
  );
  const result = await POST(request());
  expect(result.status).toBe(429);
  const body = await result.text();
  expect(body).toContain("quota");
  expect(body).not.toContain("sensitive upstream");
  expect(body).not.toContain("test-only");
});
