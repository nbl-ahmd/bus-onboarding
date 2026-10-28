"use client";
import { useState } from "react";
import {
  Check,
  ChevronRight,
  ListOrdered,
  Play,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
} from "lucide-react";
import type { Trip } from "@/domain/models";
import {
  buildJourney,
  nextJourneyStep,
  type JourneyStep,
} from "@/domain/journey";
export function JourneyConsole({
  trip,
  disabled,
  busy,
  onPlay,
  onSkip,
  onChoose,
  onEdit,
  onPrepare,
  onInterrupt,
  sequenceLabel,
}: {
  trip: Trip;
  disabled: boolean;
  busy: boolean;
  onPlay: (step: JourneyStep) => void;
  onSkip: (step: JourneyStep) => void;
  onChoose: (step: JourneyStep) => void;
  onEdit: (step: JourneyStep) => void;
  onPrepare: () => void;
  onInterrupt: (id: string) => void;
  sequenceLabel: string;
}) {
  const [showRoute, setShowRoute] = useState(false);
  const steps = buildJourney(trip);
  const step = nextJourneyStep(trip);
  const index = step ? steps.findIndex((s) => s.id === step.id) : steps.length;
  const next = steps[index + 1];
  const active = trip.status === "active";
  return (
    <section
      className={`journey-console ${active ? "is-running" : ""}`}
      aria-label="Guided trip"
    >
      <div className="journey-console-header">
        <h2>{active ? "Your journey" : "Ready for the road"}</h2>
        <span>
          {trip.stops.length} stops · {Math.min(index + 1, steps.length)} /{" "}
          {steps.length}
        </span>
      </div>
      <div
        className="journey-track"
        role="progressbar"
        aria-label="Journey progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={index}
      >
        <span style={{ width: `${(index / steps.length) * 100}%` }} />
      </div>
      {step ? (
        <>
          <div className="journey-current">
            <div>
              <p>{step.location}</p>
              <h3>{step.title}</h3>
              <span>{step.detail}</span>
            </div>
            <button
              className="icon-button"
              aria-label={`Edit guided ${step.title}`}
              disabled={disabled}
              onClick={() => onEdit(step)}
            >
              <SlidersHorizontal size={20} />
            </button>
          </div>
          <button
            className="journey-play"
            disabled={disabled || !active}
            onClick={() => onPlay(step)}
          >
            <Play size={23} fill="currentColor" />
            <span>
              {busy
                ? "Playing announcement…"
                : active
                  ? "Play next announcement"
                  : "Start trip to begin"}
              <small>{sequenceLabel}</small>
            </span>
          </button>
          <div className="journey-next">
            <span>
              {next ? (
                <>
                  Then <strong>{next.title}</strong>
                </>
              ) : (
                "Last announcement of this journey"
              )}
            </span>
            <button
              className="text-button"
              disabled={disabled || !active}
              onClick={() => onSkip(step)}
            >
              <SkipForward size={16} /> Skip
            </button>
          </div>
        </>
      ) : (
        <div className="journey-finished">
          <Check size={28} />
          <h3>All announcements complete</h3>
          <p>You can replay any step from the route or end this trip.</p>
        </div>
      )}
      {active ? (
        <div
          className="journey-interrupts"
          role="group"
          aria-label="Announcements in between"
        >
          <span>In between</span>
          {[
            { id: "congestion", label: "Traffic & delay" },
            { id: "summary", label: "Trip summary" },
            { id: "unscheduled", label: "Unplanned stop" },
            { id: "resume", label: "Return to bus" },
          ].map((item) => (
            <button
              key={item.id}
              disabled={disabled}
              onClick={() => onInterrupt(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="journey-console-footer">
        <button
          className="text-button"
          aria-expanded={showRoute}
          onClick={() => setShowRoute(!showRoute)}
        >
          <ListOrdered size={17} /> {showRoute ? "Hide route" : "View route"}
        </button>
        <button className="text-button" disabled={disabled} onClick={onPrepare}>
          Download trip audio <ChevronRight size={15} />
        </button>
      </div>
      {showRoute ? (
        <ol className="journey-step-list">
          {steps.map((item, i) => {
            const done = trip.journeyDone?.includes(item.id);
            const skipped = trip.journeySkipped?.includes(item.id);
            return (
              <li
                key={item.id}
                aria-current={item.id === step?.id ? "step" : undefined}
              >
                <span className="journey-step-number">
                  {done ? <Check size={15} /> : i + 1}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {skipped ? "Skipped" : done ? "Completed" : item.detail}
                  </small>
                </div>
                <button
                  className="icon-button"
                  disabled={disabled || !active}
                  aria-label={`${done ? "Replay" : "Choose"} ${item.title}`}
                  onClick={() => onChoose(item)}
                >
                  {done ? <RotateCcw size={17} /> : <Play size={17} />}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
