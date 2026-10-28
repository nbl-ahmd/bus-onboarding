"use client";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Headphones,
  Play,
  Square,
  Trash2,
  HardDrive,
  RefreshCw,
  Check,
  LoaderCircle,
} from "lucide-react";
import { audioRepository, type AudioRecord } from "@/adapters/storage";
import { isAudioApproved } from "@/adapters/speech";
import { transcriptMatches } from "@/domain/live-speech";
import { EmptyState, errorMessage } from "./ui";
export function AudioLibrary({
  fleetId,
  revision,
  notify,
  onChange,
  preparing = false,
  preparationLabel,
  onCancel,
  onRegenerate,
}: {
  fleetId: string;
  revision: number;
  notify: (message: string) => void;
  onChange: (record?: AudioRecord) => void;
  preparing?: boolean;
  preparationLabel?: string;
  onCancel: () => void;
  onRegenerate: (record: AudioRecord) => void;
}) {
  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [playing, setPlaying] = useState("");
  const [exporting, setExporting] = useState(false);
  const [heard, setHeard] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState("");
  const pendingCount = records.filter(
    (record) => !isAudioApproved(record),
  ).length;
  const version = (record: AudioRecord) =>
    `${record.key}:${record.recordingId || record.createdAt}`;
  const [confirm, setConfirm] = useState("");
  const player = useRef<HTMLAudioElement | null>(null);
  const url = useRef("");
  async function refresh() {
    try {
      const records = await audioRepository.list();
      setRecords(
        records
          .filter((r) => r.fleetId === fleetId)
          .sort(
            (a, b) =>
              Number(isAudioApproved(a)) - Number(isAudioApproved(b)) ||
              b.createdAt.localeCompare(a.createdAt),
          ),
      );
    } catch (err) {
      notify(errorMessage(err));
    }
  }
  useEffect(() => {
    let alive = true;
    audioRepository.list().then((records) => {
      if (alive)
        setRecords(
          records
            .filter((r) => r.fleetId === fleetId)
            .sort(
              (a, b) =>
                Number(isAudioApproved(a)) - Number(isAudioApproved(b)) ||
                b.createdAt.localeCompare(a.createdAt),
            ),
        );
    });
    return () => {
      alive = false;
      player.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, [fleetId, revision]);
  function stop() {
    player.current?.pause();
    if (player.current) {
      player.current.onended = null;
      player.current.onerror = null;
    }
    setPlaying("");
    if (url.current) URL.revokeObjectURL(url.current);
  }
  async function play(record: AudioRecord) {
    stop();
    url.current = URL.createObjectURL(record.blob);
    const audio = new Audio(url.current);
    player.current = audio;
    audio.onended = () => {
      setHeard((previous) => new Set([...previous, version(record)]));
      stop();
    };
    audio.onerror = () => {
      stop();
      notify(
        "This recording could not be played. Try a different format or prepare it again.",
      );
    };
    setPlaying(record.key);
    try {
      await audio.play();
    } catch {
      stop();
      notify("This audio format could not be played on this phone.");
    }
  }
  async function approve(record: AudioRecord) {
    if (!heard.has(version(record)) || playing || preparing) return;
    setApproving(record.key);
    try {
      const current = await audioRepository.get(record.key);
      if (!current || version(current) !== version(record))
        throw new Error(
          "This clip changed. Listen to the latest recording before approval.",
        );
      const approved: AudioRecord = {
        ...current,
        reviewStatus: "approved",
        reviewedAt: new Date().toISOString(),
      };
      await audioRepository.put(approved);
      await refresh();
      onChange(approved);
      notify("Voice approved for bus playback. Your trip step is unchanged.");
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setApproving("");
    }
  }
  function download(record: AudioRecord) {
    const link = document.createElement("a");
    const href = URL.createObjectURL(record.blob);
    link.href = href;
    const ext = record.blob.type.includes("wav")
      ? "wav"
      : record.blob.type.includes("mp4")
        ? "m4a"
        : record.blob.type.includes("mpeg")
          ? "mp3"
          : record.blob.type.includes("ogg")
            ? "ogg"
            : "webm";
    link.download = `${record.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${record.language}.${ext}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  async function downloadAll() {
    setExporting(true);
    try {
      const { zipSync, strToU8 } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      const manifest = [];
      for (const record of records) {
        const ext = record.blob.type.includes("wav")
          ? "wav"
          : record.blob.type.includes("mp4")
            ? "m4a"
            : record.blob.type.includes("mpeg")
              ? "mp3"
              : record.blob.type.includes("ogg")
                ? "ogg"
                : "webm";
        const name = `${record.title.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 70)}-${record.language}-${record.key.slice(0, 10)}.${ext}`;
        files[name] = new Uint8Array(await record.blob.arrayBuffer());
        manifest.push({
          file: name,
          title: record.title,
          language: record.language,
          text: record.text,
          createdAt: record.createdAt,
          origin: record.origin,
          reviewStatus: record.reviewStatus,
          transcript: record.transcript,
        });
      }
      files["scripts.json"] = strToU8(JSON.stringify(manifest, null, 2));
      const href = URL.createObjectURL(
        new Blob([new Uint8Array(zipSync(files, { level: 0 }))], {
          type: "application/zip",
        }),
      );
      const link = document.createElement("a");
      link.href = href;
      link.download = "nightline-voices.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 3000);
      notify(`${records.length} saved voices exported with their scripts.`);
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }
  return (
    <section className="surface audio-library-panel">
      <div className="panel-heading">
        <div>
          <h2>
            {pendingCount
              ? "Review your voices"
              : "Ready when the signal isn’t"}
          </h2>
          <p>
            {pendingCount
              ? `${pendingCount} Live ${pendingCount === 1 ? "clip needs" : "clips need"} approval. Listen to each full clip, check its wording, names and times, then approve for bus playback.`
              : "Saved recordings and prepared voices on this phone."}
          </p>
        </div>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={downloadAll}
            disabled={!records.length || exporting}
          >
            <Download size={16} />
            {exporting ? "Exporting…" : "Download all voices"}
          </button>
          <button className="button secondary" onClick={refresh}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>
      {preparing ? (
        <div className="library-preparation">
          <LoaderCircle size={16} className="spin" />
          <span>{preparationLabel || "Preparing voices…"}</span>
          <button className="text-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null}
      <div className="storage-summary">
        <HardDrive size={19} />
        <span>
          <strong>{records.length - pendingCount}</strong> ready
          {pendingCount ? ` · ${pendingCount} to review` : ""}
        </span>
        <span>
          {(records.reduce((s, r) => s + r.blob.size, 0) / 1024 / 1024).toFixed(
            1,
          )}{" "}
          MB on this device
        </span>
      </div>
      {!records.length ? (
        <EmptyState icon={Headphones} title="Your audio library starts here">
          Open an announcement, then prepare a Gemini voice or add your own
          recording. Saved audio appears here and works offline.
        </EmptyState>
      ) : (
        <div className="audio-list">
          {records.map((record) => (
            <article
              className={`audio-row ${!isAudioApproved(record) ? "needs-review" : ""}`}
              key={record.key}
            >
              <button
                disabled={preparing}
                className={`audio-play ${playing === record.key ? "active" : ""}`}
                aria-label={
                  playing === record.key
                    ? "Stop recording"
                    : `${isAudioApproved(record) ? "Play" : "Review"} ${record.title} in ${record.language === "ml" ? "Malayalam" : "English"}`
                }
                onClick={() => (playing === record.key ? stop() : play(record))}
              >
                {playing === record.key ? (
                  <Square size={17} />
                ) : (
                  <Play size={18} />
                )}
              </button>
              <div className="audio-info">
                <strong>{record.title}</strong>
                <span>
                  {record.language === "ml" ? "Malayalam" : "English"} ·{" "}
                  {record.origin === "live"
                    ? "Gemini Live"
                    : record.origin === "gemini"
                      ? "Dedicated TTS"
                      : "Your recording"}{" "}
                  · {new Date(record.createdAt).toLocaleDateString("en-IN")}
                </span>
                <p lang={record.language}>{record.text}</p>
                {record.origin === "live" ? (
                  <>
                    <span
                      className={`review-status ${isAudioApproved(record) ? "approved" : "pending"}`}
                    >
                      {isAudioApproved(record)
                        ? "Approved for bus playback"
                        : "Review required · unavailable for bus playback"}
                    </span>
                    <details className="transcript-comparison">
                      <summary>
                        {record.transcript
                          ? transcriptMatches(record.text, record.transcript)
                            ? "Transcript matches the script · listen to confirm pronunciation"
                            : "Transcript differs · check against the script"
                          : "No transcript returned · check the full recording"}
                      </summary>
                      <p lang={record.language}>
                        {record.transcript ||
                          "Compare the recording with the script above. Transcript checks do not replace listening."}
                      </p>
                    </details>
                    {!isAudioApproved(record) ? (
                      <div className="review-actions">
                        <button
                          className="button primary"
                          aria-label={`Approve ${record.title} in ${record.language === "en" ? "English" : "Malayalam"}`}
                          disabled={
                            preparing ||
                            !heard.has(version(record)) ||
                            Boolean(playing) ||
                            Boolean(approving)
                          }
                          onClick={() => approve(record)}
                        >
                          <Check size={16} />
                          {approving === record.key
                            ? "Approving…"
                            : "Approve for bus"}
                        </button>
                        <button
                          className="button secondary"
                          aria-label={`Regenerate ${record.title} in ${record.language === "en" ? "English" : "Malayalam"}`}
                          disabled={
                            preparing || Boolean(playing) || Boolean(approving)
                          }
                          onClick={() => onRegenerate(record)}
                        >
                          <RefreshCw size={16} /> Regenerate clip
                        </button>
                        <span className="field-help">
                          {heard.has(version(record))
                            ? "Approve only if wording, names and times are correct. Regenerate just this clip if it needs a correction."
                            : "Play the full clip to enable approval."}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="button-row">
                <button
                  className="icon-button"
                  onClick={() => download(record)}
                  aria-label={`Download ${record.title}`}
                >
                  <Download size={18} />
                </button>
                {confirm === record.key ? (
                  <button
                    className="button danger small"
                    onClick={async () => {
                      stop();
                      await audioRepository.remove(record.key);
                      setConfirm("");
                      await refresh();
                      onChange();
                      notify(
                        "Recording removed from this phone. Prepare again to regenerate this clip.",
                      );
                    }}
                  >
                    Delete file
                  </button>
                ) : (
                  <button
                    className="icon-button danger-text"
                    onClick={() => setConfirm(record.key)}
                    aria-label={`Delete ${record.title}`}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
