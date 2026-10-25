import type { Trip, Weather } from "@/domain/models";
export interface WeatherProvider {
  forecast(trip: Trip): Promise<Weather>;
}
export class MetNorwayWeatherProvider implements WeatherProvider {
  async forecast(trip: Trip): Promise<Weather> {
    const destination = /bengaluru|bangalore/i.test(trip.destination)
      ? "bengaluru"
      : /kozhikode|calicut/i.test(trip.destination)
        ? "kozhikode"
        : null;
    if (!destination)
      throw new Error(
        "Weather is available for Bengaluru and Kozhikode in this pilot.",
      );
    const response = await fetch(
      `/api/weather?destination=${destination}&arrival=${encodeURIComponent(trip.arrival)}`,
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "Forecast unavailable. Journey announcements still work.",
      );
    return { ...data, destination: trip.destination };
  }
}
