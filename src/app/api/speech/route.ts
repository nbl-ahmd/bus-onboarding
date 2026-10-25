import { NextRequest } from "next/server";
import { z } from "zod";
import { authorize, sameOrigin } from "@/lib/server-auth";
export const maxDuration = 60;
const input = z.object({
  text: z.string().min(1).max(1800),
  language: z.enum(["en", "ml"]),
});
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorize(request);
  if (!auth)
    return Response.json(
      {
        error:
          "Sign in to your fleet or unlock the pilot speech service in Settings.",
      },
      { status: 401 },
    );
  if (!process.env.GEMINI_API_KEY)
    return Response.json(
      {
        error:
          "Gemini is not configured. Use a device voice or upload a recording.",
      },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length")) > 12_000)
    return Response.json(
      { error: "Announcement is too long." },
      { status: 413 },
    );
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        error:
          "Provide an announcement under 1,800 characters and a supported language.",
      },
      { status: 400 },
    );
  if (auth.db) {
    const { data: permitted, error } = await auth.db.rpc(
      "consume_speech_quota",
    );
    if (error || !permitted)
      return Response.json(
        {
          error:
            "Your daily pilot voice limit has been reached, or the quota migration is missing. Use saved audio and check fleet setup.",
        },
        { status: 429 },
      );
  }
  const { text, language } = parsed.data;
  const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
  if (!/^[a-zA-Z0-9._-]+$/.test(model))
    return Response.json(
      { error: "Invalid server speech-model configuration." },
      { status: 503 },
    );
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(50_000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Read the following ${language === "ml" ? "Malayalam" : "Indian English"} passenger announcement exactly as written, calmly and clearly. Do not add introductions or other words.\n\n${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: process.env.GEMINI_TTS_VOICE || "Kore",
                },
              },
            },
          },
        }),
      },
    );
    if (!response.ok)
      return Response.json(
        {
          error:
            response.status === 429
              ? "The Gemini free-tier quota is temporarily exhausted. Use saved audio or try later."
              : "Gemini could not generate speech. Check the server model, voice and API key.",
        },
        { status: response.status === 429 ? 429 : 502 },
      );
    const data = await response.json();
    const part = data.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string } }) => p.inlineData?.data,
    )?.inlineData;
    if (!part?.data) throw new Error("No audio returned");
    const bytes = Buffer.from(part.data, "base64");
    const isWav = bytes.subarray(0, 4).toString() === "RIFF";
    const isPcm = /^audio\/(l16|pcm)/i.test(part.mimeType || "");
    if (!isWav && !isPcm) throw new Error("Unsupported speech audio format");
    const rate = Number(/rate=(\d+)/.exec(part.mimeType || "")?.[1] || 24000);
    let output = bytes;
    if (!isWav) {
      const header = Buffer.alloc(44);
      header.write("RIFF", 0);
      header.writeUInt32LE(36 + bytes.length, 4);
      header.write("WAVEfmt ", 8);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22);
      header.writeUInt32LE(rate, 24);
      header.writeUInt32LE(rate * 2, 28);
      header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34);
      header.write("data", 36);
      header.writeUInt32LE(bytes.length, 40);
      output = Buffer.concat([header, bytes]);
    }
    return new Response(new Uint8Array(output), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        error:
          "Voice generation timed out or returned invalid audio. Your saved announcements are still available.",
      },
      { status: 502 },
    );
  }
}
