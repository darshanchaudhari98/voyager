import OpenAI from "openai";
import type { Itinerary, SharedContext, TravelRequest } from "../types";

function model(): string {
  return process.env.OPENAI_MODEL || "openai/gpt-4o-mini";
}

function client(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. The Itinerary Agent requires an LLM key."
    );
  }
  // OpenAI-compatible. Defaults to OpenRouter if OPENAI_BASE_URL is set.
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    defaultHeaders: {
      // Optional OpenRouter attribution headers (ignored by OpenAI).
      "HTTP-Referer": "https://ai-travel-control-plane.vercel.app",
      "X-Title": "AI Travel Agent Control Plane",
    },
  });
}

function buildPrompt(req: TravelRequest, ctx: SharedContext): string {
  const flight = ctx.flight?.selected;
  const hotel = ctx.hotel?.selected;
  const budget = ctx.budget;
  return `You are an expert travel planner. Produce a detailed day-by-day itinerary.

Trip:
- Destination: ${req.destination}
- Duration: ${req.days} days
- Travelers: ${req.travelers}
- Budget: ${req.currency} ${budget?.budget ?? req.budget}
- Preferences: ${req.preferences.join(", ") || "general sightseeing"}

Booked context:
- Flight: ${flight ? `${flight.airline} (${flight.from}->${flight.to}), ${flight.currency} ${flight.totalPrice}` : "n/a"}
- Hotel: ${hotel ? `${hotel.name}, ${hotel.currency} ${hotel.totalPrice} for ${hotel.nights} nights` : "n/a"}
- Budget breakdown: flights ${budget?.flightCost}, hotel ${budget?.hotelCost}, misc ${budget?.miscCost}, total ${budget?.totalCost}

Return STRICT JSON only, no markdown, matching this shape:
{
  "summary": "2-3 sentence overview",
  "days": [
    { "day": 1, "title": "string", "activities": ["..."], "meals": ["..."], "estimatedCost": number }
  ],
  "tips": ["..."]
}
Make exactly ${req.days} day objects. Costs in ${req.currency}.
IMPORTANT: each day's "estimatedCost" is the on-the-ground spend (activities,
meals, local transport) for that day. The sum of all days' "estimatedCost" must
equal the miscellaneous budget of ${req.currency} ${budget?.miscCost ?? "the remaining budget"}
(flights and hotel are already booked separately). Distribute that amount
sensibly across the days.`;
}

/**
 * Generates a day-by-day itinerary using the configured LLM (OpenRouter/OpenAI).
 * Throws on failure — there is no sample/fallback itinerary.
 */
export async function generateItinerary(
  req: TravelRequest,
  ctx: SharedContext
): Promise<Itinerary> {
  const completion = await client().chat.completions.create({
    model: model(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a precise travel itinerary generator. Respond with valid JSON only.",
      },
      { role: "user", content: buildPrompt(req, ctx) },
    ],
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Itinerary LLM returned an empty response.");
  }

  let parsed: Omit<Itinerary, "generatedBy">;
  try {
    parsed = JSON.parse(raw) as Omit<Itinerary, "generatedBy">;
  } catch {
    throw new Error("Itinerary LLM returned invalid JSON.");
  }

  if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
    throw new Error("Itinerary LLM response did not include any days.");
  }

  return {
    summary: parsed.summary ?? "",
    days: normalizeDayCosts(parsed.days, ctx.budget?.miscCost),
    tips: parsed.tips ?? [],
    generatedBy: model(),
  };
}

/**
 * Aligns the itinerary's day-by-day spend with the approved budget. The
 * day `estimatedCost` figures cover on-the-ground spending (activities, meals,
 * local transport) — i.e. the "miscellaneous" budget slice (flights and hotel
 * are already booked). We rescale the LLM's numbers so they sum exactly to that
 * approved miscellaneous amount, so the itinerary total always matches the
 * budget the user approved.
 */
function normalizeDayCosts(
  days: Itinerary["days"],
  miscBudget: number | undefined
): Itinerary["days"] {
  if (!days.length || !miscBudget || miscBudget <= 0) return days;

  const current = days.reduce((sum, d) => sum + (Number(d.estimatedCost) || 0), 0);

  // Scale existing costs proportionally; if the model gave none, split evenly.
  const scaled = days.map((d) => {
    const base =
      current > 0
        ? (Number(d.estimatedCost) || 0) * (miscBudget / current)
        : miscBudget / days.length;
    return { ...d, estimatedCost: Math.max(0, Math.round(base)) };
  });

  // Correct any rounding drift so the totals match the budget to the rupee.
  const rounded = scaled.reduce((sum, d) => sum + (d.estimatedCost ?? 0), 0);
  const drift = Math.round(miscBudget) - rounded;
  if (drift !== 0) {
    const last = scaled[scaled.length - 1];
    last.estimatedCost = Math.max(0, (last.estimatedCost ?? 0) + drift);
  }

  return scaled;
}
