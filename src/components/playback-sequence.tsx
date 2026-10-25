"use client";
import { useState } from "react";
import { ArrowRight, Check, Repeat2 } from "lucide-react";
import type { Preferences } from "@/domain/models";
import {
  buildPlaybackSequence,
  playbackSequenceLabel,
} from "@/domain/playback";
import { Dialog } from "./ui";
export function SequenceControls({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (next: Preferences) => void;
}) {
  const sequence = buildPlaybackSequence(
    value.languageMode,
    value.repetitions,
    value.repeatPattern,
  );
  return (
    <div className="sequence-controls">
      <label>
        Playback order
        <select
          aria-label="Playback order"
          value={value.languageMode}
          onChange={(e) =>
            onChange({
              ...value,
              languageMode: e.target.value as Preferences["languageMode"],
            })
          }
        >
          <option value="en-ml">English first, then Malayalam</option>
          <option value="ml-en">Malayalam first, then English</option>
          <option value="en">English only</option>
          <option value="ml">Malayalam only</option>
        </select>
      </label>
      <div className="sequence-field">
        <span>Repeat</span>
        <div className="segmented" role="group" aria-label="Repeat count">
          {[1, 2, 3].map((count) => (
            <button
              type="button"
              key={count}
              aria-pressed={value.repetitions === count}
              onClick={() => onChange({ ...value, repetitions: count })}
            >
              {count === 1 ? "Once" : `${count} times`}
            </button>
          ))}
        </div>
      </div>
      <div className="sequence-field">
        <span>How to repeat</span>
        <div
          className="sequence-patterns"
          role="group"
          aria-label="Repeat pattern"
        >
          <button
            type="button"
            aria-pressed={value.repeatPattern === "alternating"}
            onClick={() => onChange({ ...value, repeatPattern: "alternating" })}
          >
            <strong>Alternate languages</strong>
            <span>
              {playbackSequenceLabel(
                buildPlaybackSequence(
                  value.languageMode,
                  value.repetitions,
                  "alternating",
                ),
                true,
              )}
            </span>
            {value.repeatPattern === "alternating" ? <Check size={17} /> : null}
          </button>
          <button
            type="button"
            aria-pressed={value.repeatPattern === "grouped"}
            onClick={() => onChange({ ...value, repeatPattern: "grouped" })}
          >
            <strong>Repeat each language</strong>
            <span>
              {playbackSequenceLabel(
                buildPlaybackSequence(
                  value.languageMode,
                  value.repetitions,
                  "grouped",
                ),
                true,
              )}
            </span>
            {value.repeatPattern === "grouped" ? <Check size={17} /> : null}
          </button>
        </div>
      </div>
      <div className="sequence-preview" aria-label="Full playback sequence">
        <span>One tap will play</span>
        <div>
          {sequence.map((language, index) => (
            <span className="sequence-part" key={index}>
              {index ? <ArrowRight size={13} aria-hidden="true" /> : null}
              <strong className={language === "en" ? "english" : "malayalam"}>
                {language === "en" ? "EN" : "ML"}
              </strong>
            </span>
          ))}
        </div>
        <p>One short pause between voices. Stop cancels the entire sequence.</p>
      </div>
    </div>
  );
}
export function SequenceDialog({
  preferences,
  onSave,
  onClose,
}: {
  preferences: Preferences;
  onSave: (next: Preferences) => void | Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(preferences);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog title="Your playback sequence" onClose={onClose}>
      <div className="form-stack">
        <p className="muted">
          Set it once. Every announcement uses this sequence with a single tap.
        </p>
        <SequenceControls value={draft} onChange={setDraft} />
        <button
          className="button primary full"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
              onClose();
            } finally {
              setSaving(false);
            }
          }}
        >
          <Repeat2 size={17} /> {saving ? "Saving…" : "Use this sequence"}
        </button>
      </div>
    </Dialog>
  );
}
