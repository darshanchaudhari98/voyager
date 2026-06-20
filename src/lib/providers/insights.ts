import OpenAI from "openai";
import type { DestinationInsights, TravelRequest } from "../types";

function model(): string {
  return process.env.OPENAI_MODEL || "openai/gpt-4o-mini";
}

function client(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. The Insights Agent requires an LLM key."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://ai-travel-control-plane.vercel.app",
      "X-Title": "AI Travel Agent Control Plane",
    },
  });
}

function buildPrompt(req: TravelRequest): string {
  return `You are a destination expert. Provide concise, practical insights for a
trip to ${req.destination} (${req.days} days, ${req.travelers} traveler(s),
preferences: ${req.preferences.join(", ") || "general sightseeing"},
dates: ${req.departDate} to ${req.returnDate}).

Return STRICT JSON only, no markdown, matching this shape:
{
  "bestAreas": ["3-4 neighbourhoods or zones good for a visitor to stay/explore"],
  "gettingAround": "1-2 sentences on local transport",
  "safety": "1 sentence safety note",
  "seasonalNote": "1 sentence about weather/season for the given dates",
  "mustTry": ["3-5 signature foods or experiences"]
}`;
}

/**
 * Insights Agent provider: produces destination insights via the configured
 * LLM. Independent of flight/hotel data, so it runs in the parallel research
 * phase. Throws on failure (the orchestrator treats this agent as non-fatal).
 */
export async function generateInsights(
  req: TravelRequest
): Promise<DestinationInsights> {
  const completion = await client().chat.completions.create({
    model: model(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a precise destination insights generator. Respond with valid JSON only.",
      },
      { role: "user", content: buildPrompt(req) },
    ],
    temperature: 0.6,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Insights LLM returned an empty response.");

  let parsed: Omit<DestinationInsights, "generatedBy">;
  try {
    parsed = JSON.parse(raw) as Omit<DestinationInsights, "generatedBy">;
  } catch {
    throw new Error("Insights LLM returned invalid JSON.");
  }

  return {
    bestAreas: Array.isArray(parsed.bestAreas) ? parsed.bestAreas : [],
    gettingAround: parsed.gettingAround ?? "",
    safety: parsed.safety ?? "",
    seasonalNote: parsed.seasonalNote ?? "",
    mustTry: Array.isArray(parsed.mustTry) ? parsed.mustTry : [],
    generatedBy: model(),
  };
}
