import { afterEach, expect, it, vi } from "vitest";
import { GoogleGenAI } from "@google/genai";
import { liveSessionConfig, liveSessionSetup } from "../src/domain/live-speech";
afterEach(() => vi.unstubAllGlobals());
it("matches the browser setup to the actual SDK's locked token configuration", async () => {
  let body: Record<string, unknown> = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, request: RequestInit) => {
      body = JSON.parse(request.body as string);
      return Response.json({ name: "auth_tokens/fixture" });
    }),
  );
  const client = new GoogleGenAI({
    apiKey: "fake-server-key-for-test",
    httpOptions: { apiVersion: "v1alpha" },
  });
  const config = liveSessionConfig("ml", "Kore");
  await client.authTokens.create({
    config: {
      uses: 1,
      liveConnectConstraints: { model: "gemini-3.8-live", config },
    },
  });
  expect(body.bidiGenerateContentSetup).toEqual(
    liveSessionSetup("gemini-3.8-live", config),
  );
  expect(
    (body.bidiGenerateContentSetup as { systemInstruction: unknown })
      .systemInstruction,
  ).toEqual({ parts: [{ text: expect.stringContaining("Malayalam") }] });
  expect(body.uses).toBe(1);
});
