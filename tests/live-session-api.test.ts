import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  authorize: vi.fn(),
  origin: vi.fn(),
}));
vi.mock("../src/lib/server-auth", () => ({
  authorize: mocks.authorize,
  sameOrigin: mocks.origin,
}));
vi.mock("@google/genai", () => ({
  Modality: { AUDIO: "AUDIO" },
  GoogleGenAI: class {
    authTokens = { create: mocks.create };
  },
}));
import { POST } from "../src/app/api/live/session/route";
const request = (
  body: unknown = { language: "ml", model: "gemini-3.8-live", voice: "Kore" },
) =>
  new NextRequest("http://localhost:3100/api/live/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  mocks.authorize.mockResolvedValue({ db: null });
  mocks.origin.mockReturnValue(true);
  mocks.create.mockResolvedValue({ name: "auth_tokens/test-ephemeral" });
  vi.stubEnv("GEMINI_API_KEY", "server-test-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("issues a single-use short-lived model/voice/instruction-constrained token, never the API key", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  const body = await response.text();
  expect(body).toContain("auth_tokens/test-ephemeral");
  expect(body).not.toContain("server-test-secret");
  const { config } = mocks.create.mock.calls[0][0];
  expect(config.uses).toBe(1);
  expect(Date.parse(config.expireTime) - Date.now()).toBeLessThanOrEqual(
    300000,
  );
  expect(config.liveConnectConstraints.model).toBe("gemini-3.8-live");
  expect(
    config.liveConnectConstraints.config.systemInstruction.parts[0].text,
  ).toContain("Malayalam");
  expect(
    config.liveConnectConstraints.config.speechConfig.voiceConfig
      .prebuiltVoiceConfig.voiceName,
  ).toBe("Kore");
});
it("requires authenticated same-origin requests before issuing any token", async () => {
  mocks.authorize.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  mocks.origin.mockReturnValue(false);
  expect((await POST(request())).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("rejects unsupported models and voices and missing configuration", async () => {
  expect(
    (await POST(request({ language: "en", model: "arbitrary-model" }))).status,
  ).toBe(400);
  expect(
    (await POST(request({ language: "en", voice: "arbitrary-voice" }))).status,
  ).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
  vi.stubEnv("GEMINI_API_KEY", "");
  expect((await POST(request())).status).toBe(503);
});
it("sanitizes upstream token errors", async () => {
  mocks.create.mockRejectedValue({
    status: 429,
    message: "server-test-secret and credential URL",
  });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(await response.text()).not.toContain("server-test-secret");
});
