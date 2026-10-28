import type { LiveConnectConfig, LiveServerMessage } from "@google/genai";
import type { Language } from "@/domain/models";
import {
  DEFAULT_LIVE_MODEL,
  liveSessionConfig,
  liveSessionSetup,
  pcmToWav,
} from "@/domain/live-speech";
import { authHeaders } from "./supabase";
import type { SpeechProvider } from "./speech";
export interface LiveSession {
  sendClientContent(input: {
    turns: { role: string; parts: { text: string }[] }[];
    turnComplete: boolean;
  }): void;
  close(): void;
}
export type LiveConnector = (options: {
  token: string;
  model: string;
  config: LiveConnectConfig;
  signal?: AbortSignal;
  onmessage: (message: LiveServerMessage) => void;
  onerror: () => void;
  onclose: () => void;
}) => Promise<LiveSession>;
/** The constrained Live WebSocket endpoint accepts only short-lived auth tokens. */
export const connectLiveWebSocket: LiveConnector = ({
  token,
  model,
  config,
  signal,
  ...callbacks
}) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const socket = new WebSocket(
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`,
    );
    let ready = false;
    let incoming = Promise.resolve();
    const abort = () => {
      socket.close();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    const clean = () => signal?.removeEventListener("abort", abort);
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          setup: liveSessionSetup(model, config),
        }),
      );
    socket.onmessage = (event) => {
      // Preserve ordering even if the browser delivers JSON as asynchronous Blob frames.
      incoming = incoming
        .then(async () => {
          const text =
            typeof event.data === "string"
              ? event.data
              : event.data instanceof Blob
                ? await event.data.text()
                : new TextDecoder().decode(event.data);
          const message = JSON.parse(text) as LiveServerMessage & {
            error?: unknown;
          };
          if (message.error) {
            clean();
            reject(connectionError());
            callbacks.onerror();
            socket.close();
            return;
          }
          if (message.setupComplete && !ready) {
            ready = true;
            clean();
            resolve({
              sendClientContent: (input) =>
                socket.send(JSON.stringify({ clientContent: input })),
              close: () => socket.close(),
            });
          }
          callbacks.onmessage(message);
        })
        .catch(() => {
          clean();
          reject(connectionError());
          callbacks.onerror();
          socket.close();
        });
    };
    socket.onerror = () => {
      clean();
      reject(connectionError());
      callbacks.onerror();
      socket.close();
    };
    socket.onclose = () => {
      clean();
      if (!ready) reject(connectionError());
      callbacks.onclose();
    };
  });
const cancelled = () => new DOMException("Preparation cancelled", "AbortError");
const connectionError = () =>
  new Error(
    "Live connection ended before the clip finished. Completed clips are saved; retry or choose Dedicated TTS in Settings.",
  );
export class GeminiLiveSpeechProvider implements SpeechProvider {
  readonly origin = "live" as const;
  transcript = "";
  private session?: LiveSession;
  private epoch = 0;
  private turns = 0;
  private openedAt = 0;
  private language?: Language;
  private pending?: {
    chunks: Uint8Array[];
    bytes: number;
    transcript: string;
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
    clean: () => void;
  };
  constructor(
    private voice = "Kore",
    private model = DEFAULT_LIVE_MODEL,
    private connector: LiveConnector = connectLiveWebSocket,
  ) {}
  dispose() {
    this.fail(cancelled());
    this.epoch++;
    const session = this.session;
    this.session = undefined;
    session?.close();
  }
  private fail(error: Error) {
    const pending = this.pending;
    this.pending = undefined;
    if (pending) {
      pending.clean();
      pending.reject(error);
    }
  }
  private receive(message: LiveServerMessage) {
    const pending = this.pending;
    if (!pending) return;
    try {
      const content = message.serverContent;
      if (content?.interrupted || message.toolCall) throw connectionError();
      for (const part of content?.modelTurn?.parts || []) {
        if (part.thought || !part.inlineData?.data) continue;
        if (!/^audio\/(pcm|l16)(;|$)/i.test(part.inlineData.mimeType || ""))
          throw new Error("Live returned an unsupported audio format.");
        const binary = atob(part.inlineData.data);
        pending.bytes += binary.length;
        if (pending.bytes > 8 * 1024 * 1024)
          throw new Error(
            "Live recording exceeded its size limit. Use a shorter script.",
          );
        pending.chunks.push(
          Uint8Array.from(binary, (char) => char.charCodeAt(0)),
        );
      }
      if (content?.outputTranscription?.text)
        pending.transcript += content.outputTranscription.text;
      if (
        content?.turnComplete &&
        content.interactionStatus !== "IN_PROGRESS"
      ) {
        const blob = pcmToWav(pending.chunks);
        this.transcript = pending.transcript.trim();
        this.pending = undefined;
        pending.clean();
        this.turns++;
        pending.resolve(blob);
      }
    } catch (error) {
      this.fail(error instanceof Error ? error : connectionError());
      this.dispose();
    }
  }
  private async connect(language: Language, signal?: AbortSignal) {
    if (
      this.session &&
      this.language === language &&
      this.turns < 6 &&
      Date.now() - this.openedAt < 3 * 60_000
    )
      return;
    this.dispose();
    const epoch = this.epoch;
    const controller = new AbortController();
    const stop = () => controller.abort();
    signal?.addEventListener("abort", stop, { once: true });
    const timer = setTimeout(stop, 30_000);
    try {
      if (signal?.aborted) throw cancelled();
      const response = await fetch("/api/live/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          model: this.model,
          voice: this.voice,
          language,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Live session could not start.");
      if (!data.token || data.model !== this.model || data.voice !== this.voice)
        throw connectionError();
      const opening = this.connector({
        token: data.token,
        model: this.model,
        signal: controller.signal,
        config: liveSessionConfig(language, this.voice),
        onmessage: (message) => {
          if (this.epoch === epoch) this.receive(message);
        },
        onerror: () => {
          if (this.epoch === epoch) {
            this.fail(connectionError());
            this.dispose();
          }
        },
        onclose: () => {
          if (this.epoch === epoch) {
            this.fail(connectionError());
            this.session = undefined;
            this.epoch++;
          }
        },
      });
      const session = await new Promise<LiveSession>((resolve, reject) => {
        const abort = () => reject(cancelled());
        controller.signal.addEventListener("abort", abort, { once: true });
        opening.then(
          (session) => {
            controller.signal.removeEventListener("abort", abort);
            if (controller.signal.aborted || this.epoch !== epoch) {
              session.close();
              reject(cancelled());
            } else resolve(session);
          },
          () => {
            controller.signal.removeEventListener("abort", abort);
            reject(connectionError());
          },
        );
        if (controller.signal.aborted) abort();
      });
      this.session = session;
      this.turns = 0;
      this.openedAt = Date.now();
      this.language = language;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
    }
  }
  async synthesize(
    text: string,
    language: Language,
    signal?: AbortSignal,
  ): Promise<Blob> {
    if (!text.trim() || text.length > 1800)
      throw new Error("Use an announcement under 1,800 characters.");
    if (this.pending)
      throw new Error("Wait for the current Live recording to finish.");
    this.transcript = "";
    await this.connect(language, signal);
    if (signal?.aborted) {
      this.dispose();
      throw cancelled();
    }
    return new Promise<Blob>((resolve, reject) => {
      const stop = () => {
        this.fail(cancelled());
        this.dispose();
      };
      const timer = setTimeout(() => {
        this.fail(
          new Error(
            "Live recording timed out. This incomplete clip was not saved.",
          ),
        );
        this.dispose();
      }, 120_000);
      this.pending = {
        chunks: [],
        bytes: 0,
        transcript: "",
        resolve,
        reject,
        clean: () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", stop);
        },
      };
      signal?.addEventListener("abort", stop, { once: true });
      try {
        this.session!.sendClientContent({
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true,
        });
      } catch {
        this.fail(connectionError());
        this.dispose();
      }
    });
  }
}
