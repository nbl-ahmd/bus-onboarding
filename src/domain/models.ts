import { z } from "zod";
export type Language = "en" | "ml";
export type LanguageMode = "ml-en" | "en-ml" | "ml" | "en";
export type Category =
  "All announcements" | "Journey" | "Stops & breaks" | "Updates" | "Arrival";
export type Page =
  "announcements" | "trips" | "library" | "history" | "fleet" | "settings";
export type Role = "admin" | "driver";
export const stopSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  minutes: z.number().min(0).max(180),
  type: z.enum(["boarding", "break", "drop-off"]),
});
export const tripSchema = z
  .object({
    id: z.string(),
    fleetId: z.string(),
    vehicleId: z.string(),
    driverId: z.string(),
    origin: z.string().min(1).max(100),
    destination: z.string().min(1).max(100),
    departure: z
      .string()
      .refine(
        (v) => Number.isFinite(Date.parse(v)),
        "Choose a valid departure",
      ),
    arrival: z
      .string()
      .refine((v) => Number.isFinite(Date.parse(v)), "Choose a valid arrival"),
    distanceKm: z.number().min(0).max(3000),
    crew: z.string().max(120),
    stops: z.array(stopSchema).max(20),
    status: z.enum(["scheduled", "active", "completed"]),
    updatedAt: z.string(),
    sample: z.boolean().optional(),
  })
  .refine((v) => Date.parse(v.arrival) > Date.parse(v.departure), {
    message: "Arrival must be after departure, including the date.",
    path: ["arrival"],
  });
export type Trip = z.infer<typeof tripSchema>;
export type Stop = z.infer<typeof stopSchema>;
export interface Vehicle {
  id: string;
  fleetId: string;
  name: string;
  registration: string;
}
export interface Driver {
  id: string;
  fleetId: string;
  name: string;
  email: string;
  role: Role;
}
export interface AnnouncementTemplate {
  id: string;
  title: string;
  description: string;
  category: Category;
  icon: string;
  en: string;
  ml: string;
  custom?: boolean;
}
export interface Weather {
  temperature: number;
  condition: string;
  forecastAt: string;
  fetchedAt: string;
  destination: string;
  source: "MET Norway";
}
export interface AnnouncementFacts {
  delayMinutes: number;
  breakMinutes: number | undefined;
  reason: "traffic" | "roadblock" | "operational" | "unspecified";
  stopName: string;
  revisedArrival: string;
  weather?: Weather;
}
export interface AnnouncementEvent {
  id: string;
  tripId: string;
  fleetId: string;
  driverId: string;
  templateId: string;
  title: string;
  languageMode: LanguageMode;
  sequence?: Language[];
  at: string;
  status: "played" | "stopped" | "failed";
  source: "device" | "saved-audio";
  detail: string;
  trigger: "manual" | "geofence" | "traffic-api";
}
export interface Preferences {
  languageMode: LanguageMode;
  repetitions: number;
  repeatPattern: "alternating" | "grouped";
  haptics: boolean;
  gestures: boolean;
  favoriteIds: string[];
  nightMode: boolean;
  quietMode: boolean;
  voiceRate: number;
  keepAwake: boolean;
  speechProvider: "device" | "gemini";
  voiceEn: string;
  voiceMl: string;
}
export interface Workspace {
  version: 1;
  fleet: { id: string; name: string };
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  templates: AnnouncementTemplate[];
  events: AnnouncementEvent[];
  preferences: Preferences;
  activeTripId: string;
  pending: Mutation[];
}
export type Mutation = {
  kind: "trip" | "vehicle" | "template" | "event";
  id: string;
  payload: Trip | Vehicle | AnnouncementTemplate | AnnouncementEvent;
};
export interface SessionIdentity {
  id: string;
  fleetId: string;
  name: string;
  email: string;
  role: Role;
}
export interface ServiceConfig {
  supabase: boolean;
  gemini: boolean;
  pilotCode: boolean;
  weather: boolean;
  voice: string;
  model: string;
}
export const languagesFor = (mode: LanguageMode): Language[] =>
  mode === "ml-en" ? ["ml", "en"] : mode === "en-ml" ? ["en", "ml"] : [mode];
export const uid = () => crypto.randomUUID();
