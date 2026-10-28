"use client";
import { useState } from "react";
import {
  Bluetooth,
  Check,
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  KeyRound,
  Moon,
  ShieldCheck,
  Smartphone,
  Volume2,
  WifiOff,
} from "lucide-react";
import type { Preferences, ServiceConfig } from "@/domain/models";
import { errorMessage } from "./ui";
import { GEMINI_VOICES, TTS_MODELS } from "@/domain/voices";
import { SequenceControls } from "./playback-sequence";
export function SettingsPanel({
  preferences: p,
  update,
  config,
  voices,
  onAccount,
  onTest,
  onInstall,
  installable,
  installed,
  notify,
}: {
  preferences: Preferences;
  update: (p: Preferences) => void;
  config: ServiceConfig;
  voices: SpeechSynthesisVoice[];
  onAccount: () => void;
  onTest: () => void;
  onInstall: () => void;
  installable: boolean;
  installed: boolean;
  notify: (message: string) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function unlock() {
    setBusy(true);
    try {
      const response = await fetch("/api/pilot/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCode("");
      notify("Pilot voice service unlocked for 12 hours.");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-layout">
      <section className="surface settings-section">
        <div className="section-heading">
          <h2>Playback preferences</h2>
          <Volume2 size={20} />
        </div>
        <SequenceControls value={p} onChange={update} />
        <label>
          Preferred voice service
          <select
            value={p.speechProvider}
            onChange={(e) =>
              update({
                ...p,
                speechProvider: e.target.value as Preferences["speechProvider"],
              })
            }
          >
            <option value="device">Device voices · no API needed</option>
            <option value="gemini">Gemini · prepare audio online</option>
          </select>
          <span className="field-help">
            Matching saved recordings always play first. Download the trip
            before departure, or enable live generation for changed
            announcements.
          </span>
        </label>
        {p.speechProvider === "gemini" ? (
          <label>
            Speech model
            <select
              value={p.geminiModel}
              onChange={(e) => update({ ...p, geminiModel: e.target.value })}
            >
              <option value="">Fleet default · {config.model}</option>
              {TTS_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <span className="field-help">
              A lighter model does not guarantee more free requests. Check your
              project’s limits in Google AI Studio.
            </span>
          </label>
        ) : null}
        {p.speechProvider === "gemini" ? (
          <div className="form-grid">
            {(["en", "ml"] as const).map((lang) => (
              <label key={lang}>
                {lang === "en" ? "English" : "Malayalam"} announcement voice
                <select
                  value={
                    (lang === "en" ? p.geminiVoiceEn : p.geminiVoiceMl) || ""
                  }
                  onChange={(e) =>
                    update({
                      ...p,
                      [lang === "en" ? "geminiVoiceEn" : "geminiVoiceMl"]:
                        e.target.value,
                    })
                  }
                >
                  <option value="">Fleet default · {config.voice}</option>
                  {GEMINI_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}
        <div className="setting-toggle">
          <div>
            <strong>Announcement chime</strong>
            <span>
              A soft two-note sound once before the whole language sequence.
            </span>
          </div>
          <input
            type="checkbox"
            role="switch"
            aria-label="Announcement chime"
            checked={p.chime}
            onChange={(e) => update({ ...p, chime: e.target.checked })}
          />
        </div>
        <div className="setting-toggle">
          <div>
            <strong>Generate changed audio live</strong>
            <span>
              With Gemini selected and internet available, prepare missing
              voices on tap. Saved voices never use quota.
            </span>
          </div>
          <input
            type="checkbox"
            role="switch"
            aria-label="Generate changed audio live"
            checked={p.liveAudio}
            onChange={(e) => update({ ...p, liveAudio: e.target.checked })}
          />
        </div>
        <label>
          Journey summary
          <select
            value={p.summaryMode}
            onChange={(e) =>
              update({
                ...p,
                summaryMode: e.target.value as Preferences["summaryMode"],
              })
            }
          >
            <option value="live">
              Live when online · refresh destination forecast
            </option>
            <option value="reusable">
              Reusable · scheduled arrival, no live weather
            </option>
          </select>
          <span className="field-help">
            Offline playback uses the reusable format. Arrival is relative to
            departure (for example, tomorrow at 7 AM). Live summaries use the
            current day. ETA stays crew-entered.
          </span>
        </label>
        <label>
          Playback pace{" "}
          <span className="pace-value">{p.voiceRate.toFixed(2)}×</span>
          <input
            type="range"
            min="0.75"
            max="1.15"
            step="0.05"
            value={p.voiceRate}
            onChange={(e) =>
              update({ ...p, voiceRate: Number(e.target.value) })
            }
          />
        </label>
        {(["en", "ml"] as const).map((lang) => (
          <label key={lang}>
            {lang === "en" ? "English" : "Malayalam"} device voice
            <select
              value={lang === "en" ? p.voiceEn : p.voiceMl}
              onChange={(e) =>
                update({
                  ...p,
                  [lang === "en" ? "voiceEn" : "voiceMl"]: e.target.value,
                })
              }
            >
              <option value="">
                {voices.some((v) => v.lang.startsWith(lang))
                  ? "Use available device voice"
                  : "No voice detected · use a recording"}
              </option>
              {voices
                .filter((v) => v.lang.startsWith(lang))
                .map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
                ))}
            </select>
          </label>
        ))}
        <p className="field-help">
          Device voice availability and offline support depend on the phone.
          Test both languages before departure.
        </p>
        <div className="setting-toggle">
          <div>
            <strong>
              <Moon size={17} /> Night appearance
            </strong>
            <span>Lower brightness for an overnight journey.</span>
          </div>
          <input
            aria-label="Night appearance"
            type="checkbox"
            role="switch"
            checked={p.nightMode}
            onChange={(e) => update({ ...p, nightMode: e.target.checked })}
          />
        </div>
        <div className="setting-toggle">
          <div>
            <strong>Quiet journey</strong>
            <span>
              Show a quiet-journey note. Your taps still play immediately.
            </span>
          </div>
          <input
            aria-label="Quiet journey"
            type="checkbox"
            role="switch"
            checked={p.quietMode}
            onChange={(e) => update({ ...p, quietMode: e.target.checked })}
          />
        </div>
        <div className="setting-toggle">
          <div>
            <strong>Touch feedback</strong>
            <span>
              Light vibration on supported phones. Browser vibration is
              unavailable on iPhone.
            </span>
          </div>
          <input
            aria-label="Touch feedback"
            type="checkbox"
            role="switch"
            checked={p.haptics}
            onChange={(e) => update({ ...p, haptics: e.target.checked })}
          />
        </div>
        <div className="setting-toggle">
          <div>
            <strong>Gesture shortcuts</strong>
            <span>
              Hold an announcement to edit. Swipe the player left to stop.
            </span>
          </div>
          <input
            aria-label="Gesture shortcuts"
            type="checkbox"
            role="switch"
            checked={p.gestures}
            onChange={(e) => update({ ...p, gestures: e.target.checked })}
          />
        </div>
        <div className="setting-toggle">
          <div>
            <strong>Keep screen awake</strong>
            <span>Only while a trip is active and this app is visible.</span>
          </div>
          <input
            aria-label="Keep screen awake"
            type="checkbox"
            role="switch"
            checked={p.keepAwake}
            onChange={(e) => update({ ...p, keepAwake: e.target.checked })}
          />
        </div>
      </section>
      <div className="settings-aside">
        <section className="surface settings-section">
          <div className="section-heading">
            <h2>Your bus audio</h2>
            <Bluetooth size={20} />
          </div>
          <ol className="steps">
            <li>Pair your phone in its Bluetooth settings.</li>
            <li>Select Bluetooth on the bus audio system.</li>
            <li>Set a comfortable media volume.</li>
            <li>Play a speaker test and listen in the cabin.</li>
          </ol>
          <button className="button secondary full" onClick={onTest}>
            <Volume2 size={17} /> Play speaker test
          </button>
          <p className="field-help">
            The app cannot verify your Bluetooth connection or interrupt another
            audio source. Calls and other phone audio may reach the bus
            speakers.
          </p>
        </section>
        <section className="surface settings-section">
          <div className="section-heading">
            <h2>Connected services</h2>
            <Cloud size={20} />
          </div>
          <div className="integration-row">
            <span>Fleet accounts</span>
            <span className={`status-label ${config.supabase ? "good" : ""}`}>
              {config.supabase ? "Configured" : "Local pilot"}
            </span>
          </div>
          <div className="integration-row">
            <span>Gemini speech</span>
            <span className={`status-label ${config.gemini ? "good" : ""}`}>
              {config.gemini ? "Configured" : "Not connected"}
            </span>
          </div>
          <p className="field-help">
            Speech model: {p.geminiModel || config.model || "loading…"}.
            Free-tier availability and quotas are set by your Google AI Studio
            project.
          </p>
          <div className="integration-row">
            <span>Destination weather</span>
            <span className={`status-label ${config.weather ? "good" : ""}`}>
              {config.weather ? "MET Norway" : "Not connected"}
            </span>
          </div>
          <div className="integration-row">
            <span>Route distance & ETA</span>
            <span className="status-label">Manual entry</span>
          </div>
          <button className="text-button" onClick={onAccount}>
            Manage fleet account <ChevronRight size={16} />
          </button>
          {config.pilotCode ? (
            <div className="pilot-unlock">
              <label>
                Pilot voice access code
                <input
                  type="password"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button
                className="button secondary"
                disabled={!code || busy}
                onClick={unlock}
              >
                <KeyRound size={16} />
                {busy ? "Unlocking…" : "Unlock voice generation"}
              </button>
            </div>
          ) : null}
          <p className="field-help">
            <ShieldCheck size={14} /> API keys stay on the server. No
            billing-dependent Maps API is enabled.
          </p>
        </section>
        <section className="surface settings-section">
          <div className="section-heading">
            <h2>Take it with you</h2>
            <Smartphone size={20} />
          </div>
          <p className="muted small">
            Install Nightline for a simpler, full-screen experience. Prepare
            your audio while connected.
          </p>
          <button className="button secondary full" onClick={onInstall}>
            {installed ? <Check size={17} /> : <Download size={17} />}
            {installed
              ? "App installed"
              : installable
                ? "Install Nightline"
                : "How to install"}
          </button>
          <p className="field-help">
            <WifiOff size={14} /> Downloaded trips and audio work offline.
            Switching apps or locking the phone may interrupt playback.
          </p>
          <a
            className="text-button small"
            href="https://docs.api.met.no/doc/FAQ.html"
            target="_blank"
            rel="noreferrer"
          >
            Forecasts by MET Norway <ExternalLink size={13} />
          </a>
        </section>
      </div>
    </div>
  );
}
