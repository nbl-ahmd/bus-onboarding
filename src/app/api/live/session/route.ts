import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { authorize, sameOrigin } from "@/lib/server-auth";
import {
  DEFAULT_LIVE_MODEL,
  LIVE_MODELS,
  liveSessionConfig,
} from "@/domain/live-speech";
import { GEMINI_VOICES } from "@/domain/voices";
export const maxDuration = 30;
const input = z.object({
  language: z.enum(["en", "ml"]),
  model: z
    .string()
    .refine((value) => LIVE_MODELS.some((model) => model.id === value))
    .optional(),
  voice: z
    .string()
    .refine((value) => GEMINI_VOICES.some((voice) => voice.id === value))
    .optional(),
});
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!(await authorize(request)))
    return Response.json(
      {
        error:
          "Sign in to your fleet or unlock the pilot voice service in Settings.",
      },
      { status: 401 },
    );
  if (!process.env.GEMINI_API_KEY)
    return Response.json(
      {
        error:
          "Live generation is not configured. Use device voices or a recording.",
      },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length")) > 2000)
    return Response.json(
      { error: "Invalid session request." },
      { status: 413 },
    );
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Choose a supported Live model, voice and language." },
      { status: 400 },
    );
  const model =
    parsed.data.model || process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
  const voice = parsed.data.voice || process.env.GEMINI_TTS_VOICE || "Kore";
  if (
    !LIVE_MODELS.some((item) => item.id === model) ||
    !GEMINI_VOICES.some((item) => item.id === voice)
  )
    return Response.json(
      { error: "Check the server Live model and voice configuration." },
      { status: 503 },
    );
  try {
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1alpha", timeout: 20_000 },
    });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        liveConnectConstraints: {
          model,
          config: liveSessionConfig(parsed.data.language, voice),
        },
      },
    });
    if (!token.name) throw new Error("Missing token");
    return Response.json(
      { token: token.name, model, voice, expiresAt },
      { headers: { "Cache-Control": "no-store, private", Pragma: "no-cache" } },
    );
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 429
        ? 429
        : 502;
    return Response.json(
      {
        error:
          status === 429
            ? "The Live service is rate-limited. Saved voices remain available; retry preparation later."
            : "Live session could not start. Check model access in AI Studio, retry, or choose Dedicated TTS in Settings.",
      },
      { status },
    );
  }
}
