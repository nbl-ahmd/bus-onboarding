import { describe, expect, it } from "vitest";
import { createWorkspace } from "../src/domain/seed";
import {
  buildJourney,
  journeyAudioTasks,
  nextJourneyStep,
  reorderStop,
} from "../src/domain/journey";
import {
  renderAnnouncement,
  relativeArrival,
} from "../src/domain/announcements";
import { tripSchema } from "../src/domain/models";
import { speechVariant } from "../src/domain/voices";
const workspace = createWorkspace();
const trip = {
  ...workspace.trips[0],
  sample: false,
  stops: [
    {
      id: "a",
      name: "Kalpetta",
      type: "boarding" as const,
      minutes: 5,
      time: "22:15",
    },
    {
      id: "b",
      name: "Gundlupet",
      type: "break" as const,
      minutes: 20,
      time: "01:00",
    },
    {
      id: "c",
      name: "Mysuru",
      type: "drop-off" as const,
      minutes: 5,
      time: "04:00",
    },
  ],
};
describe("guided journey", () => {
  it("builds approach and stopped announcements in stop order with the right facts", () => {
    const steps = buildJourney(trip);
    expect(steps.slice(0, 3).map((s) => s.id)).toEqual([
      "welcome",
      "summary",
      "departure",
    ]);
    expect(steps.filter((s) => s.stopId).map((s) => s.id)).toEqual([
      "a:approach",
      "a:stop",
      "b:approach",
      "b:stop",
      "b:resume",
      "c:approach",
      "c:stop",
    ]);
    for (const task of journeyAudioTasks(trip, workspace.templates)) {
      for (const lang of ["en", "ml"] as const)
        expect(
          renderAnnouncement(
            task.template,
            trip,
            workspace.fleet.name,
            task.facts,
            lang,
          ),
        ).not.toMatch(/\{\w+\}/);
    }
    const rest = journeyAudioTasks(trip, workspace.templates).find(
      (task) => task.template.id === "break",
    )!;
    expect(
      renderAnnouncement(rest.template, trip, "Pilot", rest.facts, "en"),
    ).toContain("Gundlupet for a 20 minute");
    const boarding = steps.find((s) => s.id === "a:stop")!;
    expect(boarding.templateId).toBe("stop-boarding");
    expect(steps.find((s) => s.id === "c:stop")!.templateId).toBe(
      "stop-dropoff",
    );
  });
  it("keeps stop identities and progress through reordering and resumes after reload", () => {
    const reordered = {
      ...trip,
      stops: reorderStop(trip.stops, 2, 0),
      journeyDone: ["welcome", "summary", "departure", "c:approach"],
    };
    expect(nextJourneyStep(JSON.parse(JSON.stringify(reordered)))?.id).toBe(
      "c:stop",
    );
    expect(reorderStop(trip.stops, 0, -1)).toEqual(trip.stops);
  });
  it("accepts 200 stops and rejects 201 and invalid stop times", () => {
    const stops = Array.from({ length: 200 }, (_, i) => ({
      ...trip.stops[0],
      id: String(i),
    }));
    expect(tripSchema.safeParse({ ...trip, stops }).success).toBe(true);
    expect(
      tripSchema.safeParse({ ...trip, stops: [...stops, trip.stops[0]] })
        .success,
    ).toBe(false);
    expect(
      tripSchema.safeParse({
        ...trip,
        stops: [{ ...trip.stops[0], time: "25:10" }],
      }).success,
    ).toBe(false);
  });
  it("makes unchanged daily-run summaries reusable with relative arrival", () => {
    const template = workspace.templates.find((t) => t.id === "summary")!;
    const task = {
      delayMinutes: 0,
      breakMinutes: undefined,
      reason: "unspecified" as const,
      stopName: "",
      revisedArrival: "",
      summaryMode: "reusable" as const,
    };
    const a = {
      ...trip,
      departure: "2026-10-28T21:00:00+05:30",
      arrival: "2026-10-29T07:00:00+05:30",
    };
    const b = {
      ...a,
      departure: "2026-10-29T21:00:00+05:30",
      arrival: "2026-10-30T07:00:00+05:30",
    };
    const text = renderAnnouncement(template, a, "Pilot", task, "en");
    expect(text).toContain("tomorrow");
    expect(text).toBe(renderAnnouncement(template, b, "Pilot", task, "en"));
    expect(relativeArrival(a.arrival, "2026-10-29T02:00:00+05:30")).toContain(
      "today",
    );
  });
  it("changing an English voice leaves the Malayalam cache identity unchanged", () => {
    const config = { model: "test-tts", voice: "Kore" };
    const a = workspace.preferences;
    const b = { ...a, geminiVoiceEn: "Puck" };
    expect(speechVariant(config, a, "ml")).toBe(speechVariant(config, b, "ml"));
    expect(speechVariant(config, a, "en")).not.toBe(
      speechVariant(config, b, "en"),
    );
  });
});
