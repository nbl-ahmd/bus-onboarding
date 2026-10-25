import { describe, expect, it } from "vitest";
import { createWorkspace } from "../src/domain/seed";
import { templates } from "../src/domain/templates";
import {
  ManualAnnouncementTrigger,
  ManualRouteFactsProvider,
  renderAnnouncement,
} from "../src/domain/announcements";
import {
  languagesFor,
  tripSchema,
  type AnnouncementFacts,
} from "../src/domain/models";
const workspace = createWorkspace();
const trip = {
  ...workspace.trips[0],
  distanceKm: 365,
  crew: "Ravi and Arun",
  stops: [
    {
      id: "break",
      name: "Confirmed rest stop",
      minutes: 15,
      type: "break" as const,
    },
  ],
};
const facts: AnnouncementFacts = {
  delayMinutes: 30,
  breakMinutes: 15,
  reason: "unspecified",
  stopName: "Main terminal",
  revisedArrival: "",
};
describe("announcement pipeline", () => {
  it("resolves every variable in every built-in language", () => {
    for (const template of templates)
      for (const lang of ["ml", "en"] as const) {
        const text = renderAnnouncement(
          template,
          trip,
          "Pilot Fleet",
          facts,
          lang,
        );
        expect(text).not.toMatch(/\{\w+\}/);
        expect(text.length).toBeGreaterThan(30);
      }
  });
  it("does not invent distance or weather when unavailable", () => {
    const summary = templates.find((t) => t.id === "summary")!;
    const text = renderAnnouncement(
      summary,
      { ...trip, distanceKm: 0 },
      "Pilot",
      facts,
      "en",
    );
    expect(text).not.toContain("kilometres");
    expect(text).not.toContain("forecast");
    expect(text).toContain("scheduled arrival");
  });
  it("does not infer congestion from an unexplained delay", () => {
    const template = templates.find((t) => t.id === "congestion")!;
    const text = renderAnnouncement(template, trip, "Pilot", facts, "en");
    expect(text).not.toContain("congestion");
    expect(text).toContain("30 minutes");
    expect(
      renderAnnouncement(
        template,
        trip,
        "Pilot",
        { ...facts, reason: "traffic" },
        "en",
      ),
    ).toContain("traffic congestion");
  });
  it("omits stale or wrong-destination forecasts", () => {
    const summary = templates.find((t) => t.id === "summary")!;
    const weather = {
      temperature: 22,
      condition: "rain",
      forecastAt: trip.arrival,
      fetchedAt: new Date().toISOString(),
      destination: trip.destination,
      source: "MET Norway" as const,
    };
    expect(
      renderAnnouncement(summary, trip, "Pilot", { ...facts, weather }, "en"),
    ).toContain("22 degrees");
    expect(
      renderAnnouncement(
        summary,
        trip,
        "Pilot",
        {
          ...facts,
          weather: { ...weather, fetchedAt: "2020-01-01T00:00:00Z" },
        },
        "en",
      ),
    ).not.toContain("forecast");
    expect(
      renderAnnouncement(
        summary,
        trip,
        "Pilot",
        { ...facts, weather: { ...weather, destination: "Elsewhere" } },
        "en",
      ),
    ).not.toContain("forecast");
  });
  it("validates an overnight arrival with its date", () => {
    expect(tripSchema.safeParse(trip).success).toBe(true);
    expect(
      tripSchema.safeParse({
        ...trip,
        arrival: new Date(Date.parse(trip.departure) - 1000).toISOString(),
      }).success,
    ).toBe(false);
  });
  it("keeps the selected playback language order", () => {
    expect(languagesFor("ml-en")).toEqual(["ml", "en"]);
    expect(languagesFor("en-ml")).toEqual(["en", "ml"]);
    expect(languagesFor("ml")).toEqual(["ml"]);
  });
  it("dispatches the actual trigger payload and unsubscribes cleanly", () => {
    const trigger = new ManualAnnouncementTrigger();
    const received: string[] = [];
    const stop = trigger.subscribe((event) =>
      received.push(
        `${event.templateId}:${event.facts.delayMinutes}:${event.source}`,
      ),
    );
    trigger.dispatch("congestion", facts);
    stop();
    trigger.dispatch("welcome", facts);
    expect(received).toEqual(["congestion:30:manual"]);
  });
  it("exposes a replaceable manual route provider", async () => {
    await expect(
      new ManualRouteFactsProvider().getFacts(trip),
    ).resolves.toMatchObject({
      source: "driver-entered",
      distanceKm: 365,
      arrival: trip.arrival,
    });
  });
});

it("does not invent delay or break lengths for a direct play without supplied facts", () => {
  const unknown = {
    ...facts,
    delayMinutes: 0,
    breakMinutes: undefined,
    stopName: "",
  };
  const delay = renderAnnouncement(
    templates.find((t) => t.id === "congestion")!,
    trip,
    "Pilot",
    unknown,
    "en",
  );
  const rest = renderAnnouncement(
    templates.find((t) => t.id === "break")!,
    trip,
    "Pilot",
    unknown,
    "en",
  );
  expect(delay).not.toContain("minutes behind");
  expect(rest).not.toContain("minute");
  expect(rest).toContain("crew’s instructions");
  expect(rest).not.toContain(trip.destination);
});
