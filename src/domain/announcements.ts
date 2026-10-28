import type {
  AnnouncementFacts,
  AnnouncementTemplate,
  Language,
  Trip,
} from "./models";
export interface RouteFactsProvider {
  getFacts(
    trip: Trip,
  ): Promise<{ distanceKm: number; arrival: string; source: string }>;
}
export class ManualRouteFactsProvider implements RouteFactsProvider {
  async getFacts(trip: Trip) {
    return {
      distanceKm: trip.distanceKm,
      arrival: trip.arrival,
      source: "driver-entered",
    };
  }
}
export interface TriggerEvent {
  templateId: string;
  source: "manual" | "geofence" | "traffic-api";
  facts: AnnouncementFacts;
  scripts?: Record<Language, string>;
  journeyStepId?: string;
  title?: string;
}
export interface AnnouncementTrigger {
  readonly kind: string;
  subscribe(handler: (event: TriggerEvent) => void): () => void;
}
export class ManualAnnouncementTrigger implements AnnouncementTrigger {
  readonly kind = "manual";
  private listeners = new Set<(event: TriggerEvent) => void>();
  subscribe(handler: (event: TriggerEvent) => void) {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }
  dispatch(
    templateId: string,
    facts: AnnouncementFacts,
    scripts?: Record<Language, string>,
    context?: Pick<TriggerEvent, "journeyStepId" | "title">,
  ) {
    this.listeners.forEach((fn) =>
      fn({ templateId, facts, scripts, source: "manual", ...context }),
    );
  }
}
export function formatArrival(value: string, lang: Language = "en") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    return lang === "en" ? "to be confirmed" : "പിന്നീട് അറിയിക്കുന്നതാണ്";
  return new Intl.DateTimeFormat(lang === "en" ? "en-IN" : "ml-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
/** Relative to departure for reusable scripts, or playback day for live summaries. */
export function relativeArrival(
  value: string,
  reference: string,
  lang: Language = "en",
) {
  const date = new Date(value);
  const base = new Date(reference);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(base.getTime()))
    return formatArrival(value, lang);
  const day = (d: Date) => Math.floor((d.getTime() + 330 * 60000) / 86400000);
  const days = day(date) - day(base);
  const label =
    lang === "en"
      ? days === 0
        ? "today"
        : days === 1
          ? "tomorrow"
          : days > 1
            ? `in ${days} days`
            : "on the scheduled arrival day"
      : days === 0
        ? "ഇന്ന്"
        : days === 1
          ? "നാളെ"
          : days > 1
            ? `${days} ദിവസങ്ങൾക്ക് ശേഷം`
            : "നിശ്ചയിച്ച എത്തിച്ചേരൽ ദിവസം";
  const time = new Intl.DateTimeFormat(lang === "en" ? "en-IN" : "ml-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${label} ${time}`;
}
export function renderAnnouncement(
  template: AnnouncementTemplate,
  trip: Trip,
  fleet: string,
  facts: AnnouncementFacts,
  lang: Language,
): string {
  const ml = lang === "ml";
  const breaks = trip.stops.filter((s) => s.type === "break");
  const weather =
    facts.summaryMode !== "reusable" &&
    facts.weather &&
    facts.weather.destination.toLowerCase() ===
      trip.destination.toLowerCase() &&
    Math.abs(Date.parse(facts.weather.forecastAt) - Date.parse(trip.arrival)) <=
      3 * 60 * 60 * 1000 &&
    Date.now() - Date.parse(facts.weather.fetchedAt) < 3 * 60 * 60 * 1000
      ? facts.weather
      : undefined;
  const conditions: Record<string, string> = {
    "clear skies": "തെളിഞ്ഞ ആകാശം",
    "partly cloudy": "ഭാഗികമായി മേഘാവൃതം",
    cloudy: "മേഘാവൃതം",
    rain: "മഴ",
    fog: "മൂടൽമഞ്ഞ്",
    showers: "ഇടവിട്ട മഴ",
    thunderstorms: "ഇടിമിന്നലോടുകൂടിയ മഴ",
  };
  const reasons = {
    traffic: ml
      ? "ഗതാഗതക്കുരുക്ക് കാരണം യാത്ര വൈകുകയാണ്."
      : "We are experiencing traffic congestion.",
    roadblock: ml
      ? "റോഡിലെ തടസ്സം കാരണം യാത്ര വൈകുകയാണ്."
      : "A road obstruction is affecting our journey.",
    operational: ml
      ? "പ്രവർത്തനപരമായ കാരണങ്ങളാൽ യാത്ര വൈകുകയാണ്."
      : "An operational issue is affecting our journey.",
    unspecified: ml
      ? "നമ്മുടെ യാത്രയിൽ കാലതാമസം നേരിടുകയാണ്."
      : "Our journey is taking longer than planned.",
  };
  const fields: Record<string, string> = {
    fleet,
    origin: trip.origin,
    destination: trip.destination,
    crew: trip.crew || (ml ? "ബസ് ജീവനക്കാർ" : "your bus crew"),
    arrival: relativeArrival(
      trip.arrival,
      template.id === "summary" && facts.summaryMode === "live"
        ? facts.referenceTime || new Date().toISOString()
        : trip.departure,
      lang,
    ),
    stopName:
      facts.stopName ||
      (template.category === "Arrival"
        ? trip.destination
        : ml
          ? "ഈ വിശ്രമകേന്ദ്രം"
          : "this stop"),
    breakMinutes: String(facts.breakMinutes || 0),
    delayMinutes: String(facts.delayMinutes),
    distanceSentence:
      trip.distanceKm > 0
        ? ml
          ? `യാത്രാദൂരം ഏകദേശം ${trip.distanceKm} കിലോമീറ്ററാണ്.`
          : `The planned distance is approximately ${trip.distanceKm} kilometres.`
        : "",
    stopsSentence: breaks.length
      ? ml
        ? `യാത്രയിൽ ${breaks.length} വിശ്രമ സ്റ്റോപ്പുകൾ നിശ്ചയിച്ചിട്ടുണ്ട്.`
        : `We have ${breaks.length} scheduled refreshment ${breaks.length === 1 ? "stop" : "stops"}.`
      : "",
    weatherSentence: weather
      ? ml
        ? `എത്തിച്ചേരുന്ന സമയത്തെ കാലാവസ്ഥാ പ്രവചനം ${Math.round(weather.temperature)} ഡിഗ്രി സെൽഷ്യസും ${conditions[weather.condition] || "മേഘാവൃതമായ കാലാവസ്ഥയും"} ആണ്.`
        : `Around arrival, the forecast for ${trip.destination} is ${Math.round(weather.temperature)} degrees Celsius with ${weather.condition}.`
      : "",
    reasonSentence: reasons[facts.reason],
    delaySentence:
      facts.delayMinutes > 0
        ? ml
          ? `ഏകദേശം ${facts.delayMinutes} മിനിറ്റ് വൈകുമെന്ന് പ്രതീക്ഷിക്കുന്നു.`
          : `We expect to be approximately ${facts.delayMinutes} minutes behind schedule.`
        : "",
    revisedSentence: facts.revisedArrival
      ? ml
        ? `പുതുക്കിയ എത്തിച്ചേരൽ സമയം ${relativeArrival(facts.revisedArrival, facts.referenceTime || trip.departure, lang)} ആണ്.`
        : `Our updated estimated arrival is ${relativeArrival(facts.revisedArrival, facts.referenceTime || trip.departure, lang)}.`
      : "",
  };
  const source =
    template.id === "break" && !facts.breakMinutes
      ? ml
        ? `${facts.stopName ? `${facts.stopName} എന്ന സ്ഥലത്ത് ` : ""}ചായയ്ക്കും ശുചിമുറി ഉപയോഗത്തിനുമായി നിർത്തിയിരിക്കുകയാണ്. ബസിൽ നിന്ന് ഇറങ്ങുമ്പോൾ ശ്രദ്ധിക്കുക. തിരികെ എത്തേണ്ട സമയത്തെക്കുറിച്ചുള്ള ജീവനക്കാരുടെ നിർദ്ദേശങ്ങൾ പാലിക്കുക. വിലപിടിപ്പുള്ള വസ്തുക്കൾ കൈവശം സൂക്ഷിക്കുക.`
        : `We have stopped${facts.stopName ? ` at ${facts.stopName}` : ""} for a refreshment and restroom break. Please take care when leaving the bus, keep your valuables with you, and follow the crew’s instructions about when to return.`
      : template[lang];
  return source
    .replace(/\{(\w+)\}/g, (match, key: string) => fields[key] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}
export const estimatedSeconds = (text: string) =>
  Math.max(5, Math.ceil(text.split(/\s+/).length / 2.15));
