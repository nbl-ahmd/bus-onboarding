import type { AnnouncementFacts, AnnouncementTemplate, Trip } from "./models";

export interface JourneyStep {
  id: string;
  templateId: string;
  title: string;
  location: string;
  detail: string;
  stopId?: string;
  facts: Partial<AnnouncementFacts>;
}
export const baseFacts: AnnouncementFacts = {
  delayMinutes: 0,
  breakMinutes: undefined,
  reason: "unspecified",
  stopName: "",
  revisedArrival: "",
};
/** Stable stop IDs keep progress attached to the right stop after reordering. */
export function buildJourney(trip: Trip): JourneyStep[] {
  const steps: JourneyStep[] = [
    {
      id: "welcome",
      templateId: "welcome",
      title: "Welcome aboard",
      location: trip.origin,
      detail: "Boarding · introduce your crew",
      facts: { stopName: trip.origin },
    },
    {
      id: "summary",
      templateId: "summary",
      title: "Journey summary",
      location: `${trip.origin} → ${trip.destination}`,
      detail: "Route, arrival and optional forecast",
      facts: {},
    },
    {
      id: "departure",
      templateId: "departure",
      title: "We’re on our way",
      location: trip.origin,
      detail: "Ready to depart",
      facts: {},
    },
  ];
  for (const stop of trip.stops) {
    const label =
      stop.type === "boarding"
        ? "Boarding"
        : stop.type === "drop-off"
          ? "Drop-off"
          : "Rest break";
    const facts = { stopName: stop.name, breakMinutes: stop.minutes };
    steps.push(
      {
        id: `${stop.id}:approach`,
        templateId: "stop-approach",
        title: `Approaching ${stop.name}`,
        location: stop.name,
        detail: `${label}${stop.time ? ` · ${stop.time}` : ""}`,
        stopId: stop.id,
        facts,
      },
      {
        id: `${stop.id}:stop`,
        templateId:
          stop.type === "boarding"
            ? "stop-boarding"
            : stop.type === "drop-off"
              ? "stop-dropoff"
              : "break",
        title: `${label} at ${stop.name}`,
        location: stop.name,
        detail: stop.minutes
          ? `${stop.minutes} minute stop`
          : "Follow the crew’s instructions",
        stopId: stop.id,
        facts,
      },
    );
    if (stop.type === "break")
      steps.push({
        id: `${stop.id}:resume`,
        templateId: "resume",
        title: `Leave ${stop.name}`,
        location: stop.name,
        detail: "Ask passengers to return",
        stopId: stop.id,
        facts,
      });
  }
  steps.push(
    {
      id: "destination:approach",
      templateId: "approaching",
      title: `Approaching ${trip.destination}`,
      location: trip.destination,
      detail: "Final destination",
      facts: { stopName: trip.destination },
    },
    {
      id: "destination:arrival",
      templateId: "arrival",
      title: `Arrived in ${trip.destination}`,
      location: trip.destination,
      detail: "Final drop-off",
      facts: { stopName: trip.destination },
    },
    {
      id: "thanks",
      templateId: "thanks",
      title: "Until next time",
      location: trip.destination,
      detail: "Thank passengers",
      facts: {},
    },
  );
  return steps;
}
export function nextJourneyStep(trip: Trip) {
  const done = new Set(trip.journeyDone || []);
  return buildJourney(trip).find((step) => !done.has(step.id));
}
export interface AudioTask {
  template: AnnouncementTemplate;
  facts: AnnouncementFacts;
  title: string;
}
export function journeyAudioTasks(
  trip: Trip,
  templates: AnnouncementTemplate[],
): AudioTask[] {
  return buildJourney(trip).flatMap((step) => {
    const template = templates.find((item) => item.id === step.templateId);
    return template
      ? [
          {
            template,
            facts: {
              ...baseFacts,
              ...step.facts,
              summaryMode: "reusable" as const,
            },
            title: step.title,
          },
        ]
      : [];
  });
}
export function reorderStop<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length)
    return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
