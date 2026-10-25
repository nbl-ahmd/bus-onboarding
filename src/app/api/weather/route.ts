import { NextRequest } from "next/server";
export async function GET(request: NextRequest) {
  const contact = process.env.WEATHER_CONTACT;
  if (!contact)
    return Response.json(
      {
        error:
          "Weather is optional. Set WEATHER_CONTACT on the server to enable forecasts.",
      },
      { status: 503 },
    );
  const destination = request.nextUrl.searchParams.get("destination");
  const locations: Record<string, { lat: number; lon: number }> = {
    bengaluru: { lat: 12.9716, lon: 77.5946 },
    kozhikode: { lat: 11.2588, lon: 75.7804 },
  };
  const point = locations[destination || ""];
  const arrival = Date.parse(request.nextUrl.searchParams.get("arrival") || "");
  if (!point || !Number.isFinite(arrival))
    return Response.json(
      { error: "Choose a supported destination and valid arrival time." },
      { status: 400 },
    );
  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${point.lat}&lon=${point.lon}`,
      {
        headers: { "User-Agent": `Nightline/0.1 ${contact}` },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) throw new Error("Forecast unavailable");
    const data = await response.json();
    const series = data.properties.timeseries as {
      time: string;
      data: {
        instant: { details: { air_temperature: number } };
        next_1_hours?: { summary: { symbol_code: string } };
        next_6_hours?: { summary: { symbol_code: string } };
      };
    }[];
    const nearest = series.reduce((a, b) =>
      Math.abs(Date.parse(a.time) - arrival) <
      Math.abs(Date.parse(b.time) - arrival)
        ? a
        : b,
    );
    if (Math.abs(Date.parse(nearest.time) - arrival) > 3 * 3600_000)
      throw new Error("Arrival is outside the available forecast range");
    const code =
      nearest.data.next_1_hours?.summary.symbol_code ||
      nearest.data.next_6_hours?.summary.symbol_code ||
      "";
    const condition = /thunder/.test(code)
      ? "thunderstorms"
      : /rain/.test(code)
        ? "rain"
        : /showers/.test(code)
          ? "showers"
          : /fog/.test(code)
            ? "fog"
            : /partly|fair/.test(code)
              ? "partly cloudy"
              : /cloud/.test(code)
                ? "cloudy"
                : "clear skies";
    return Response.json(
      {
        temperature: nearest.data.instant.details.air_temperature,
        condition,
        forecastAt: nearest.time,
        fetchedAt: new Date().toISOString(),
        destination,
        source: "MET Norway",
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Destination forecast unavailable. You can continue without weather.",
      },
      { status: 502 },
    );
  }
}
