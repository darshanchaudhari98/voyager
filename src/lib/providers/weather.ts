import { chatJSON, llmConfigured, llmModel } from "./llm";
import type { TravelRequest, WeatherForecast } from "../types";

const SEASONS: Record<string, { season: string; tempRange: string; conditions: string; packing: string[] }> = {
  winter: {
    season: "winter",
    tempRange: "5–15°C",
    conditions: "cool and crisp, occasional rain",
    packing: ["warm layers", "a light jacket", "comfortable shoes", "an umbrella"],
  },
  spring: {
    season: "spring",
    tempRange: "15–24°C",
    conditions: "mild and pleasant with the odd shower",
    packing: ["light layers", "a light jacket", "comfortable walking shoes", "sunglasses"],
  },
  summer: {
    season: "summer",
    tempRange: "26–35°C",
    conditions: "warm to hot, mostly sunny",
    packing: ["light breathable clothes", "sunscreen", "a hat", "a refillable water bottle"],
  },
  autumn: {
    season: "autumn",
    tempRange: "14–23°C",
    conditions: "mild days, cooler evenings",
    packing: ["layers", "a light sweater", "comfortable shoes", "a compact umbrella"],
  },
};

/** Deterministic seasonal outlook from the travel month (used as a fallback). */
function fallbackWeather(req: TravelRequest): WeatherForecast {
  const month = new Date(req.departDate).getMonth(); // 0-11
  const key =
    month <= 1 || month === 11
      ? "winter"
      : month <= 4
      ? "spring"
      : month <= 7
      ? "summer"
      : "autumn";
  const s = SEASONS[key];
  return {
    summary: `Expect ${s.conditions} in ${req.destination} during your ${s.season} trip. Plan outdoor activities around the milder parts of the day.`,
    season: s.season,
    tempRange: s.tempRange,
    conditions: s.conditions,
    packing: s.packing,
    generatedBy: "heuristic-fallback",
  };
}

/**
 * Weather Agent provider: produces a seasonal weather outlook + packing
 * guidance for the destination and travel dates. Informational only (no cost),
 * independent of flight/hotel data → runs in the parallel research phase.
 *
 * Always returns a forecast — if the LLM is unavailable or fails, a
 * deterministic season-based outlook is returned instead of nothing.
 */
export async function generateWeather(
  req: TravelRequest
): Promise<WeatherForecast> {
  if (!llmConfigured()) return fallbackWeather(req);

  try {
    const parsed = await chatJSON<Omit<WeatherForecast, "generatedBy">>(
      "Weather Agent",
      "You are a precise travel-weather advisor. Respond with valid JSON only.",
      `Give a seasonal weather outlook for ${req.destination} for the dates
${req.departDate} to ${req.returnDate}.

Return STRICT JSON only:
{
  "summary": "1-2 sentence outlook",
  "season": "e.g. spring / monsoon / winter",
  "tempRange": "e.g. 12-19°C",
  "conditions": "e.g. mostly sunny, occasional showers",
  "packing": ["3-5 short packing suggestions"]
}`,
      0.4
    );

    const fb = fallbackWeather(req);
    return {
      summary: parsed.summary?.trim() || fb.summary,
      season: parsed.season?.trim() || fb.season,
      tempRange: parsed.tempRange?.trim() || fb.tempRange,
      conditions: parsed.conditions?.trim() || fb.conditions,
      packing: Array.isArray(parsed.packing) && parsed.packing.length ? parsed.packing : fb.packing,
      generatedBy: llmModel(),
    };
  } catch {
    return fallbackWeather(req);
  }
}
