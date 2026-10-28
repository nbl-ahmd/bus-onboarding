import { DEFAULT_TTS_MODEL } from "@/domain/voices";
export async function GET() {
  return Response.json(
    {
      supabase: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      pilotCode: Boolean(process.env.PILOT_ACCESS_CODE),
      weather: Boolean(process.env.WEATHER_CONTACT),
      voice: process.env.GEMINI_TTS_VOICE || "Kore",
      model: process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
