import { chatJSON, llmConfigured, llmModel } from "./llm";
import type { TransportOption, TransportPlan, TravelRequest } from "../types";

interface RawTransport {
  mode?: string;
  description?: string;
  cost?: number;
}

/** Deterministic local-transport options derived from trip size (fallback). */
function fallbackTransport(req: TravelRequest): TransportPlan {
  const base = Math.round((req.budget * 0.05) / Math.max(1, req.days)); // per-day anchor
  const days = Math.max(1, req.days);
  const pax = Math.max(1, req.travelers);

  const options: TransportOption[] = [
    {
      id: "trn-0",
      mode: "public transport pass",
      description: `Metro / bus day passes for ${pax} traveler(s) across ${days} days`,
      cost: Math.round(base * days * 0.6),
      currency: req.currency,
    },
    {
      id: "trn-1",
      mode: "ride-hailing",
      description: "On-demand taxis / ride-hailing for daily getting around",
      cost: Math.round(base * days * 1.2),
      currency: req.currency,
    },
    {
      id: "trn-2",
      mode: "private transfer",
      description: "Private car with driver for airport transfers and day trips",
      cost: Math.round(base * days * 2.2),
      currency: req.currency,
    },
  ].sort((a, b) => a.cost - b.cost);

  return {
    selected: options[Math.min(1, options.length - 1)],
    options,
    generatedBy: "heuristic-fallback",
  };
}

/**
 * Transport Agent provider: recommends ground/local transport options for the
 * trip (e.g. metro pass, car rental, private transfers) with a total cost,
 * ranked cheapest first. The cheaper alternatives are what the agent offers
 * during budget negotiation. Independent of flight/hotel data → runs in the
 * parallel research phase.
 *
 * Always returns options — if the LLM is unavailable or fails, a deterministic
 * set of transport options is returned instead of nothing.
 */
export async function generateTransport(
  req: TravelRequest
): Promise<TransportPlan> {
  if (!llmConfigured()) return fallbackTransport(req);

  const anchor = Math.round(req.budget * 0.06);
  try {
    const parsed = await chatJSON<{ options?: RawTransport[] }>(
      "Transport Agent",
      "You are a precise local-transport planner. Respond with valid JSON only.",
      `Recommend ground/local transport options for a ${req.days}-day trip to
${req.destination} for ${req.travelers} traveler(s). Currency: ${req.currency}.

Return STRICT JSON only:
{
  "options": [
    { "mode": "metro pass|car rental|private transfer|taxi|bus pass|ride-hailing", "description": "string", "cost": number }
  ]
}
Rules:
- "cost" is the TOTAL ground-transport cost for the whole trip for all
  ${req.travelers} traveler(s), in ${req.currency}.
- Provide 3 to 4 distinct options spanning a clear price range, roughly
  ${req.currency} ${Math.round(anchor * 0.4)} to ${req.currency} ${Math.round(
        anchor * 2
      )}.
- Order them however; the system will rank by cost.`,
      0.5
    );

    const raw = Array.isArray(parsed.options) ? parsed.options : [];
    const options: TransportOption[] = raw
      .map((o, i) => ({
        id: `trn-${i}`,
        mode: o.mode?.trim() || "local transport",
        description: o.description?.trim() || "",
        cost: Math.max(0, Math.round(Number(o.cost) || 0)),
        currency: req.currency,
      }))
      .filter((o) => o.cost > 0)
      .sort((a, b) => a.cost - b.cost);

    if (!options.length) return fallbackTransport(req);

    const selected = options[Math.min(1, options.length - 1)];
    return { selected, options, generatedBy: llmModel() };
  } catch {
    return fallbackTransport(req);
  }
}
