import type { Language, Preferences } from "@/domain/models";
import { audioKey, audioRepository } from "./storage";
import { authHeaders } from "./supabase";
export interface SpeechProvider {
  synthesize(
    text: string,
    language: Language,
    signal?: AbortSignal,
  ): Promise<Blob>;
}
export class GeminiSpeechProvider implements SpeechProvider {
  async synthesize(text: string, language: Language, signal?: AbortSignal) {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ text, language }),
      signal,
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(
        data.error || "Voice generation failed. Try again later.",
      );
    }
    return response.blob();
  }
}
export async function findAudio(
  text: string,
  language: Language,
  fleetId: string,
  variant: string,
) {
  const uploaded = await audioRepository.get(
    await audioKey(text, language, "uploaded", fleetId),
  );
  return (
    uploaded ||
    audioRepository.get(await audioKey(text, language, variant, fleetId))
  );
}
export interface PlaybackAdapter {
  stop(): void;
  play(
    items: { text: string; language: Language; blob?: Blob }[],
    preferences: Preferences,
    onLanguage: (lang: Language, index: number, total: number) => void,
  ): Promise<void>;
}
export class BrowserPlaybackAdapter implements PlaybackAdapter {
  private audio?: HTMLAudioElement;
  private media?: HTMLAudioElement;
  private cancelled = false;
  private rejectCurrent?: (reason: Error) => void;
  stop() {
    this.cancelled = true;
    this.audio?.pause();
    this.audio = undefined;
    window.speechSynthesis?.cancel();
    this.rejectCurrent?.(new Error("STOPPED"));
    this.rejectCurrent = undefined;
  }
  async play(
    items: { text: string; language: Language; blob?: Blob }[],
    preferences: Preferences,
    onLanguage: (lang: Language, index: number, total: number) => void,
  ) {
    this.cancelled = false;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (this.cancelled) throw new Error("STOPPED");
      if (index > 0) await this.pause(450);
      if (this.cancelled) throw new Error("STOPPED");
      onLanguage(item.language, index, items.length);
      if (item.blob) await this.playBlob(item.blob, preferences.voiceRate);
      else await this.speak(item.text, item.language, preferences);
    }
  }
  private pause(duration: number) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rejectCurrent = undefined;
        resolve();
      }, duration);
      this.rejectCurrent = (error) => {
        clearTimeout(timer);
        this.rejectCurrent = undefined;
        reject(error);
      };
    });
  }
  private playBlob(blob: Blob, rate: number) {
    return new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = this.media || new Audio();
      this.media = audio;
      audio.src = url;
      this.audio = audio;
      audio.playbackRate = rate;
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
        this.audio = undefined;
        this.rejectCurrent = undefined;
      };
      this.rejectCurrent = (error) => {
        cleanup();
        reject(error);
      };
      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        reject(
          new Error(
            "This audio could not be played. Try a different recording format.",
          ),
        );
      };
      audio.play().catch((error) => {
        cleanup();
        reject(error);
      });
    });
  }
  private speak(text: string, language: Language, preferences: Preferences) {
    return new Promise<void>((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(
          new Error(
            "Device speech is unavailable. Upload a recording or prepare Gemini audio.",
          ),
        );
        return;
      }
      const voices = window.speechSynthesis.getVoices();
      const selected =
        language === "ml" ? preferences.voiceMl : preferences.voiceEn;
      const voice =
        voices.find(
          (v) => v.voiceURI === selected && v.lang.startsWith(language),
        ) || voices.find((v) => v.lang.toLowerCase().startsWith(language));
      if (!voice) {
        reject(
          new Error(
            `${language === "ml" ? "Malayalam" : "English"} device voice is unavailable. Upload a recording, prepare Gemini audio, or select a supported language in Settings.`,
          ),
        );
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = language === "ml" ? "ml-IN" : "en-IN";
      utterance.rate = preferences.voiceRate;
      const clean = () => {
        clearTimeout(timer);
        this.rejectCurrent = undefined;
      };
      this.rejectCurrent = (error) => {
        clean();
        reject(error);
      };
      utterance.onend = () => {
        clean();
        resolve();
      };
      utterance.onerror = (event) => {
        clean();
        reject(
          new Error(
            event.error === "canceled" || event.error === "interrupted"
              ? "STOPPED"
              : "Device speech failed. Use a saved recording.",
          ),
        );
      };
      const timer = setTimeout(
        () => {
          window.speechSynthesis.cancel();
          clean();
          reject(new Error("Device speech timed out. Use a saved recording."));
        },
        Math.max(90_000, text.length * 150),
      );
      window.speechSynthesis.speak(utterance);
    });
  }
}
