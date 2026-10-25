"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, Save, Volume2 } from "lucide-react";
import { audioKey, audioRepository } from "@/adapters/storage";
import type { Language } from "@/domain/models";
import { Dialog, errorMessage } from "./ui";
export function RecordDialog({
  title,
  texts,
  fleetId,
  onClose,
  onSaved,
}: {
  title: string;
  texts: Record<Language, string>;
  fleetId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [language, setLanguage] = useState<Language>("ml");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  const previewUrl = useRef("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      preview.current?.pause();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
  async function record() {
    setError("");
    setBlob(null);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording is unavailable in this browser. Upload an audio file instead.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const instance = new MediaRecorder(media);
      recorder.current = instance;
      const chunks: BlobPart[] = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (alive.current) {
          setBlob(new Blob(chunks, { type: instance.mimeType }));
          setRecording(false);
        }
      };
      instance.start();
      setRecording(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  async function save() {
    if (!blob) return;
    setSaving(true);
    try {
      if (blob.size > 10 * 1024 * 1024)
        throw new Error("Choose a recording smaller than 10 MB.");
      await audioRepository.put({
        key: await audioKey(texts[language], language, "uploaded", fleetId),
        blob,
        createdAt: new Date().toISOString(),
        title,
        text: texts[language],
        language,
        origin: "uploaded",
        fleetId,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  function listen() {
    if (!blob) return;
    preview.current?.pause();
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(blob);
    preview.current = new Audio(previewUrl.current);
    preview.current
      .play()
      .catch(() =>
        setError("This file could not be played. Try MP3, WAV or M4A."),
      );
  }
  return (
    <Dialog title="Add your own voice" onClose={onClose}>
      <div className="form-stack">
        <p className="muted">
          Record or upload a voice for <strong>{title}</strong>. Saved audio
          works without a speech API.
        </p>
        <label>
          Recording language
          <select
            disabled={recording}
            value={language}
            onChange={(e) => {
              preview.current?.pause();
              setLanguage(e.target.value as Language);
              setBlob(null);
            }}
          >
            <option value="ml">Malayalam</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className="record-script" lang={language === "ml" ? "ml" : "en"}>
          {texts[language]}
        </div>
        <div className="button-row">
          <button
            className={`button ${recording ? "danger" : "secondary"}`}
            onClick={recording ? () => recorder.current?.stop() : record}
          >
            {recording ? <Square size={16} /> : <Mic size={17} />}
            {recording ? "Stop recording" : "Record voice"}
          </button>
          <label
            className={`button secondary file-button ${recording ? "disabled" : ""}`}
          >
            <Upload size={17} /> Upload audio
            <input
              disabled={recording}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (
                    !file.type.startsWith("audio/") ||
                    file.size > 10 * 1024 * 1024
                  ) {
                    setError("Choose an audio file smaller than 10 MB.");
                    return;
                  }
                  setBlob(file);
                  setError("");
                }
              }}
            />
          </label>
        </div>
        {blob ? (
          <div className="notice">
            <span>Audio ready · {(blob.size / 1024).toFixed(0)} KB</span>
            <button className="text-button" onClick={listen}>
              <Volume2 size={16} /> Listen first
            </button>
          </div>
        ) : null}
        <p className="field-help">
          Only save audio you have listened to. A change to the script or trip
          details requires a matching new recording. Recordings stay on this
          phone.
        </p>
        {error ? (
          <p role="alert" className="inline-error">
            {error}
          </p>
        ) : null}
        <div className="dialog-footer">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!blob || recording || saving}
            onClick={save}
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save recording"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
