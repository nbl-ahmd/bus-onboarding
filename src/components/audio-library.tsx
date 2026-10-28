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
} from "lucide-react";
import { audioRepository, type AudioRecord } from "@/adapters/storage";
import { EmptyState, errorMessage } from "./ui";
export function AudioLibrary({
  fleetId,
  revision,
  notify,
}: {
  fleetId: string;
  revision: number;
  notify: (message: string) => void;
}) {
  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [playing, setPlaying] = useState("");
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const player = useRef<HTMLAudioElement | null>(null);
  const url = useRef("");
  async function refresh() {
    try {
      const records = await audioRepository.list();
      setRecords(
        records
          .filter((r) => r.fleetId === fleetId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
    setPlaying("");
    if (url.current) URL.revokeObjectURL(url.current);
  }
  async function play(record: AudioRecord) {
    stop();
    url.current = URL.createObjectURL(record.blob);
    const audio = new Audio(url.current);
    player.current = audio;
    audio.onended = stop;
    setPlaying(record.key);
    try {
      await audio.play();
    } catch {
      stop();
      notify("This audio format could not be played on this phone.");
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
    <section className="surface">
      <div className="panel-heading">
        <div>
          <h2>Ready when the signal isn’t</h2>
          <p>Saved recordings and prepared voices on this phone.</p>
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
      <div className="storage-summary">
        <HardDrive size={19} />
        <span>
          <strong>{records.length}</strong> audio files
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
            <article className="audio-row" key={record.key}>
              <button
                className={`audio-play ${playing === record.key ? "active" : ""}`}
                aria-label={
                  playing === record.key
                    ? "Stop recording"
                    : `Play ${record.title} in ${record.language === "ml" ? "Malayalam" : "English"}`
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
                  {record.origin === "gemini"
                    ? "Gemini voice"
                    : "Your recording"}{" "}
                  · {new Date(record.createdAt).toLocaleDateString("en-IN")}
                </span>
                <p lang={record.language}>{record.text}</p>
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
                      notify("Recording removed from this phone.");
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
