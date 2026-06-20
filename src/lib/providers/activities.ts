import { chatJSON, llmConfigured, llmModel } from "./llm";
import type { ActivityItem, ActivityPlan, TravelRequest } from "../types";

interface RawActivity {
  name?: string;
  category?: string;
  cost?: number;
  optional?: boolean;
}

/** Deterministic activity set derived from preferences (used as a fallback). */
function fallbackActivities(req: TravelRequest): ActivityPlan {
  const perActivity = Math.max(500, Math.round((req.budget * 0.15) / (req.days + 2)));
  const prefs = req.preferences.map((p) => p.toLowerCase());
  const seed: { name: string; category: string; optional: boolean }[] = [
    { name: `City highlights walking tour of ${req.destinationCity}`, category: "sightseeing", optional: false },
    { name: "Local food tasting experience", category: "food", optional: prefs.includes("food") ? false : true },
    { name: "Top museum / landmark entry", category: "culture", optional: false },
    { name: "Half-day guided excursion nearby", category: "adventure", optional: true },
    { name: "Sunset viewpoint visit", category: "sightseeing", optional: true },
    { name: "Evening local market & nightlife stroll", category: "nightlife", optional: true },
  ];
  // A couple extra for longer trips.
  if (req.days >= 5) seed.push({ name: "Day trip to a nearby attraction", category: "adventure", optional: true });

  const items: ActivityItem[] = seed.map((s, i) => ({
    id: `act-${i}`,
    name: s.name,
    category: s.category,
    cost: Math.round(perActivity * (s.optional ? 0.8 : 1.2) * req.travelers),
    optional: s.optional,
    currency: req.currency,
  }));

  return {
    items,
    totalCost: items.reduce((sum, a) => sum + a.cost, 0),
    droppedCount: 0,
    currency: req.currency,
    generatedBy: "heuristic-fallback",
  };
}

/**
 * Activity Agent provider: recommends a set of activities/experiences for the
 * trip with an estimated group cost and an `optional` flag. Optional items are
 * what the agent can trim during budget negotiation. Independent of flight /
 * hotel data, so it runs in the parallel research phase.
 *
 * Always returns a plan — if the LLM is unavailable or fails, a deterministic
 * preference-based set is returned instead of nothing.
 */
export async function generateActivities(
  req: TravelRequest
): Promise<ActivityPlan> {
  if (!llmConfigured()) return fallbackActivities(req);

  // Target ~15% of the budget for paid activities as an anchor for the LLM.
  const anchor = Math.round(req.budget * 0.15);
  try {
    const parsed = await chatJSON<{ activities?: RawActivity[] }>(
      "Activity Agent",
      "You are a precise local-activities planner. Respond with valid JSON only.",
      `Recommend activities for a ${req.days}-day trip to ${req.destination} for
${req.travelers} traveler(s). Preferences: ${
        req.preferences.join(", ") || "general sightseeing"
      }. Currency: ${req.currency}.

Return STRICT JSON only:
{
  "activities": [
    { "name": "string", "category": "sightseeing|food|adventure|culture|relaxation|nightlife", "cost": number, "optional": boolean }
  ]
}
Rules:
- "cost" is the TOTAL cost for all ${req.travelers} traveler(s), in ${req.currency}.
- Include ${req.days + 2} to ${req.days + 5} activities.
- Mark roughly half of them "optional": true (nice-to-have, droppable to save money).
- The sum of all costs should be in the rough range of ${req.currency} ${Math.round(
        anchor * 0.7
      )} to ${req.currency} ${Math.round(anchor * 1.4)}.`,
      0.6
    );

    const raw = Array.isArray(parsed.activities) ? parsed.activities : [];
    const items: ActivityItem[] = raw.map((a, i) => ({
      id: `act-${i}`,
      name: a.name?.trim() || `Activity ${i + 1}`,
      category: a.category?.trim() || "sightseeing",
      cost: Math.max(0, Math.round(Number(a.cost) || 0)),
      optional: a.optional !== false, // default to optional unless explicitly false
      currency: req.currency,
    }));

    if (!items.length) return fallbackActivities(req);

    const totalCost = items.reduce((s, a) => s + a.cost, 0);
    return {
      items,
      totalCost,
      droppedCount: 0,
      currency: req.currency,
      generatedBy: llmModel(),
    };
  } catch {
    return fallbackActivities(req);
  }
}
