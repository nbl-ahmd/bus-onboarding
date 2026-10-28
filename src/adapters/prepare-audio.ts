import type { Language, Preferences, ServiceConfig } from "@/domain/models";
import { cloudVoice, speechVariant } from "@/domain/voices";
import { DEFAULT_LIVE_MODEL } from "@/domain/live-speech";
import { audioKey, audioRepository, type AudioRecord } from "./storage";
import {
  findPreparedAudio,
  GeminiSpeechProvider,
  type SpeechProvider,
} from "./speech";
import { getSupabase } from "./supabase";
export class AudioPreparer {
  private provider?: SpeechProvider;
  private language?: Language;
  constructor(
    private fleetId: string,
    private preferences: Preferences,
    private config: ServiceConfig,
    private useCloud: boolean,
  ) {}
  dispose() {
    this.provider?.dispose?.();
    this.provider = undefined;
  }
  async prepare(
    text: string,
    language: Language,
    title: string,
    signal?: AbortSignal,
    regenerate = false,
  ) {
    const variant = speechVariant(this.config, this.preferences, language);
    const cached = await findPreparedAudio(
      text,
      language,
      this.fleetId,
      variant,
    );
    if (cached && !regenerate) return { record: cached, reused: true, downloaded: false };
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const live = this.preferences.preparationProvider !== "gemini";
    const key = await audioKey(text, language, variant, this.fleetId);
    const db = this.useCloud ? getSupabase() : null;
    const remote =
      db && !regenerate
        ? await db.storage
            .from("announcements")
            .download(`${this.fleetId}/${key}.wav`)
        : null;
    const voice = cloudVoice(this.config, this.preferences, language);
    const model = live
      ? this.preferences.liveModel ||
        this.config.liveModel ||
        DEFAULT_LIVE_MODEL
      : this.preferences.geminiModel || this.config.model;
    if (!remote?.data && (!this.provider || this.language !== language)) {
      this.dispose();
      this.language = language;
      this.provider = live
        ? new (await import("./live-speech")).GeminiLiveSpeechProvider(
            voice,
            model,
          )
        : new GeminiSpeechProvider(voice, model);
    }
    const blob =
      remote?.data || (await this.provider!.synthesize(text, language, signal));
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const record: AudioRecord = {
      key,
      blob,
      language,
      text,
      fleetId: this.fleetId,
      title,
      createdAt: new Date().toISOString(),
      recordingId: crypto.randomUUID(),
      origin: live ? "live" : "gemini",
      model,
      voice,
      ...(live
        ? {
            reviewStatus: "pending" as const,
            transcript: remote?.data ? "" : this.provider?.transcript || "",
          }
        : {}),
    };
    await audioRepository.put(record);
    // Unreviewed Live clips stay on this phone. Only crew-approved files are shared.
    let uploadFailed = false;
    if (db && !live && !remote?.data) {
      const result = await db.storage
        .from("announcements")
        .upload(`${this.fleetId}/${key}.wav`, blob, {
          upsert: true,
          contentType: "audio/wav",
        });
      uploadFailed = Boolean(result.error);
    }
    return {
      record,
      reused: false,
      downloaded: Boolean(remote?.data),
      uploadFailed,
    };
  }
}
