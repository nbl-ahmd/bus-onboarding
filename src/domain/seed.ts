import type { Workspace } from "./models";
import { templates } from "./templates";
export const SAMPLE_FLEET = "00000000-0000-4000-8000-000000000001";
export const SAMPLE_DRIVER = "00000000-0000-4000-8000-000000000002";
export const SAMPLE_BUS = "00000000-0000-4000-8000-000000000003";
export const SAMPLE_TRIP = "00000000-0000-4000-8000-000000000004";
export function createWorkspace(): Workspace {
  const now = new Date();
  const indiaDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const departure = new Date(`${indiaDay}T21:00:00+05:30`).toISOString();
  const arrival = new Date(Date.parse(departure) + 10 * 3600_000).toISOString();
  return {
    version: 1,
    fleet: { id: SAMPLE_FLEET, name: "Your fleet" },
    vehicles: [
      {
        id: SAMPLE_BUS,
        fleetId: SAMPLE_FLEET,
        name: "Sleeper 01",
        registration: "Add registration",
      },
    ],
    drivers: [
      {
        id: SAMPLE_DRIVER,
        fleetId: SAMPLE_FLEET,
        name: "Pilot driver",
        email: "",
        role: "admin",
      },
    ],
    trips: [
      {
        id: SAMPLE_TRIP,
        fleetId: SAMPLE_FLEET,
        vehicleId: SAMPLE_BUS,
        driverId: SAMPLE_DRIVER,
        origin: "Kozhikode",
        destination: "Bengaluru",
        departure,
        arrival,
        distanceKm: 0,
        crew: "",
        stops: [],
        status: "scheduled",
        updatedAt: now.toISOString(),
        sample: true,
      },
    ],
    activeTripId: SAMPLE_TRIP,
    templates: structuredClone(templates),
    events: [],
    pending: [],
    preferences: {
      languageMode: "en-ml",
      repetitions: 2,
      repeatPattern: "alternating",
      haptics: true,
      gestures: true,
      favoriteIds: ["welcome", "summary", "break", "congestion"],
      nightMode: false,
      quietMode: true,
      voiceRate: 0.95,
      keepAwake: false,
      speechProvider: "device",
      voiceEn: "",
      voiceMl: "",
    },
  };
}
