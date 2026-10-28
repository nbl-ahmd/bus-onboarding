import type { Language, Preferences, ServiceConfig } from "./models";
export const DEFAULT_TTS_MODEL = "gemini-3.8-flash-lite-tts";
export const TTS_MODELS = [
  { id: "gemini-3.8-flash-lite-tts", label: "Flash-Lite TTS · fast" },
  { id: "gemini-3.8-flash-tts", label: "Flash TTS · expressive" },
  { id: "gemini-2.5-flash-preview-tts", label: "Flash 2.5 TTS · legacy" },
];
export const GEMINI_VOICES = [
  { id: "Kore", label: "Kore · firm" },
  { id: "Puck", label: "Puck · upbeat" },
  { id: "Charon", label: "Charon · informative" },
  { id: "Aoede", label: "Aoede · breezy" },
  { id: "Leda", label: "Leda · youthful" },
  { id: "Fenrir", label: "Fenrir · excitable" },
  { id: "Orus", label: "Orus · firm" },
  { id: "Zephyr", label: "Zephyr · bright" },
];
export function cloudVoice(
  config: Pick<ServiceConfig, "voice">,
  prefs: Preferences,
  language: Language,
) {
  return (
    (language === "en" ? prefs.geminiVoiceEn : prefs.geminiVoiceMl) ||
    config.voice
  );
}
export function speechVariant(
  config: Pick<ServiceConfig, "voice" | "model">,
  prefs: Preferences,
  language: Language,
) {
  return `gemini:${prefs.geminiModel || config.model}:${cloudVoice(config, prefs, language)}`;
}
