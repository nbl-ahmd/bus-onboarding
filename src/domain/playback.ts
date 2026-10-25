import type { Language, Preferences } from "./models";
export function getPlaybackReadiness(
  requested: Language[],
  saved: Language[],
  deviceLanguages: string[],
  provider: Preferences["speechProvider"],
) {
  const missing = requested.filter(
    (language) =>
      !saved.includes(language) &&
      !(
        provider === "device" &&
        deviceLanguages.some((code) => code.toLowerCase().startsWith(language))
      ),
  );
  return {
    missing,
    canPlay: missing.length === 0,
    offlineReady: requested.every((language) => saved.includes(language)),
  };
}

/** Build a finite language sequence. Audio files are reused for each repeat. */
export function buildPlaybackSequence(
  mode: import("./models").LanguageMode,
  repetitions: number = 2,
  pattern: "alternating" | "grouped" = "alternating",
): Language[] {
  const languages: Language[] =
    mode === "en-ml" ? ["en", "ml"] : mode === "ml-en" ? ["ml", "en"] : [mode];
  const count = Number.isFinite(repetitions)
    ? Math.min(3, Math.max(1, Math.floor(repetitions)))
    : 2;
  return pattern === "grouped"
    ? languages.flatMap((language) =>
        Array.from({ length: count }, () => language),
      )
    : Array.from({ length: count }, () => languages).flat();
}
export function playbackSequenceLabel(
  sequence: Language[],
  short = false,
): string {
  return sequence
    .map((l) =>
      short ? (l === "en" ? "EN" : "ML") : l === "en" ? "English" : "Malayalam",
    )
    .join(" → ");
}
export function normalizePlaybackPreferences<
  T extends Partial<import("./models").Preferences>,
>(preferences: T) {
  return {
    ...preferences,
    repetitions: [1, 2, 3].includes(preferences.repetitions ?? 0)
      ? preferences.repetitions!
      : 2,
    repeatPattern:
      preferences.repeatPattern === "grouped"
        ? ("grouped" as const)
        : ("alternating" as const),
    haptics: preferences.haptics ?? true,
    gestures: preferences.gestures ?? true,
  };
}
