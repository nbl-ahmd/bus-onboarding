"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  Plus,
  Trash2,
  ArrowLeftRight,
  Save,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import {
  tripSchema,
  uid,
  type Driver,
  type Trip,
  type Vehicle,
} from "@/domain/models";
import { reorderStop } from "@/domain/journey";
import { Dialog } from "./ui";
const localInput = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
export function TripEditor({
  trip,
  vehicles,
  drivers,
  onSave,
  onClose,
}: {
  trip: Trip;
  vehicles: Vehicle[];
  drivers: Driver[];
  onSave: (trip: Trip) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Trip>(() => structuredClone(trip));
  const dragging = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (trip.sample && !confirmed) {
      setError("Confirm the actual timetable before saving.");
      return;
    }
    const checked = tripSchema.safeParse({
      ...draft,
      sample: false,
      updatedAt: new Date().toISOString(),
    });
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    onSave(checked.data);
  }
  return (
    <Dialog title="Set up your trip" onClose={onClose} wide>
      <form onSubmit={submit} className="form-stack">
        <p className="muted">
          Set up this route once. Stops become an ordered announcement guide,
          saved on this phone and ready for your next run.
        </p>
        <div className="form-grid">
          <label>
            Starting point
            <input
              required
              maxLength={100}
              value={draft.origin}
              onChange={(e) => setDraft({ ...draft, origin: e.target.value })}
            />
          </label>
          <label>
            Destination
            <input
              required
              maxLength={100}
              value={draft.destination}
              onChange={(e) =>
                setDraft({ ...draft, destination: e.target.value })
              }
            />
          </label>
        </div>
        <button
          type="button"
          className="text-button align-start"
          onClick={() =>
            setDraft({
              ...draft,
              origin: draft.destination,
              destination: draft.origin,
              stops: [...draft.stops].reverse(),
            })
          }
        >
          <ArrowLeftRight size={16} /> Swap direction
        </button>
        <div className="form-grid">
          <label>
            Departure · phone local time
            <input
              type="datetime-local"
              required
              value={localInput(draft.departure)}
              onChange={(e) => {
                if (e.target.value)
                  setDraft({
                    ...draft,
                    departure: new Date(e.target.value).toISOString(),
                  });
              }}
            />
          </label>
          <label>
            Arrival · include the next day
            <input
              type="datetime-local"
              required
              value={localInput(draft.arrival)}
              onChange={(e) => {
                if (e.target.value)
                  setDraft({
                    ...draft,
                    arrival: new Date(e.target.value).toISOString(),
                  });
              }}
            />
          </label>
        </div>
        <p className="field-help">
          Announcements always read arrival in India Standard Time.
        </p>
        <div className="form-grid">
          <label>
            Bus
            <select
              value={draft.vehicleId}
              onChange={(e) =>
                setDraft({ ...draft, vehicleId: e.target.value })
              }
            >
              <option value="">Select a bus</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assigned driver
            <select
              required
              value={draft.driverId}
              onChange={(e) => setDraft({ ...draft, driverId: e.target.value })}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Route distance (km)
            <input
              type="number"
              min={0}
              max={3000}
              value={draft.distanceKm || ""}
              placeholder="Enter confirmed distance"
              onChange={(e) =>
                setDraft({ ...draft, distanceKm: Number(e.target.value) })
              }
            />
            <span className="field-help">
              Leave blank to omit distance from the briefing.
            </span>
          </label>
          <label>
            Crew introduction
            <input
              maxLength={120}
              value={draft.crew}
              placeholder="Driver and attendant names"
              onChange={(e) => setDraft({ ...draft, crew: e.target.value })}
            />
          </label>
        </div>
        <div className="section-heading">
          <h3>
            Stop sequence{" "}
            <span className="muted small">{draft.stops.length} / 200</span>
          </h3>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setDraft({
                ...draft,
                stops: [
                  ...draft.stops,
                  { id: uid(), name: "", minutes: 15, type: "break" },
                ],
              })
            }
            disabled={draft.stops.length >= 200}
          >
            <Plus size={16} /> Add stop
          </button>
        </div>
        <p className="field-help">
          Add stops in travel order. Drag the handle or use the arrows to
          rearrange. Each stop gets an approaching and a stopped announcement.
        </p>
        {draft.stops.length === 0 ? (
          <p className="muted small">
            No stops added. Add your actual boarding, break and drop-off
            locations.
          </p>
        ) : (
          draft.stops.map((stop, index) => (
            <div
              className="stop-sequence-row"
              key={stop.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging.current !== null)
                  setDraft({
                    ...draft,
                    stops: reorderStop(draft.stops, dragging.current, index),
                  });
                dragging.current = null;
              }}
            >
              <div className="stop-order-controls">
                <button
                  type="button"
                  className="icon-button"
                  draggable
                  aria-label={`Drag stop ${index + 1} to reorder`}
                  onDragStart={() => {
                    dragging.current = index;
                  }}
                  onDragEnd={() => {
                    dragging.current = null;
                  }}
                >
                  <GripVertical size={18} />
                </button>
                <span>{index + 1}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Move stop ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      stops: reorderStop(draft.stops, index, index - 1),
                    })
                  }
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Move stop ${index + 1} down`}
                  disabled={index === draft.stops.length - 1}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      stops: reorderStop(draft.stops, index, index + 1),
                    })
                  }
                >
                  <ArrowDown size={17} />
                </button>
              </div>
              <div className="stop-editor">
                <label>
                  Stop {index + 1}
                  <input
                    aria-label={`Stop ${index + 1} name`}
                    required
                    maxLength={100}
                    value={stop.name}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        stops: draft.stops.map((s) =>
                          s.id === stop.id ? { ...s, name: e.target.value } : s,
                        ),
                      })
                    }
                    placeholder="Location name"
                  />
                </label>
                <label>
                  Type
                  <select
                    aria-label={`Stop ${index + 1} type`}
                    value={stop.type}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        stops: draft.stops.map((s) =>
                          s.id === stop.id
                            ? { ...s, type: e.target.value as typeof s.type }
                            : s,
                        ),
                      })
                    }
                  >
                    <option value="break">Break</option>
                    <option value="boarding">Boarding</option>
                    <option value="drop-off">Drop-off</option>
                  </select>
                </label>
                <label>
                  Scheduled time · IST
                  <input
                    type="time"
                    aria-label={`Stop ${index + 1} time`}
                    value={stop.time || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        stops: draft.stops.map((s) =>
                          s.id === stop.id ? { ...s, time: e.target.value } : s,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Minutes
                  <input
                    type="number"
                    min={0}
                    max={180}
                    aria-label={`Stop ${index + 1} duration`}
                    value={stop.minutes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        stops: draft.stops.map((s) =>
                          s.id === stop.id
                            ? { ...s, minutes: Number(e.target.value) }
                            : s,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-button danger-text"
                  aria-label={`Remove stop ${index + 1}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      stops: draft.stops.filter((s) => s.id !== stop.id),
                    })
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
        {trip.sample ? (
          <label className="trip-confirmation">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I have confirmed the actual timetable and trip details.</span>
          </label>
        ) : null}
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            <Save size={17} /> Save trip
          </button>
        </div>
      </form>
    </Dialog>
  );
}
