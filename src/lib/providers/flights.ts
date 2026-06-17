import type { FlightOption, TravelRequest } from "../types";
import { liteapiConfigured, liteapiPost } from "./liteapi";

// ---------------------------------------------------------------------------
// LiteAPI Flights — POST /flights/rates
// Body: { legs: [{ origin, destination, date }], adults, currency }
// ---------------------------------------------------------------------------
interface LiteSegment {
  carrier?: { marketingName?: string; marketingCode?: string };
  originCode?: string;
  destinationCode?: string;
  direction?: "OUTBOUND" | "INBOUND";
}
interface LiteOffer {
  offerId: string;
  pricing?: { display?: { total?: number; currency?: string } };
  baggage?: { included?: unknown[] };
}
interface LiteJourney {
  cheapestOffer?: LiteOffer;
  offers?: LiteOffer[];
  isCheapest?: boolean;
  segments?: LiteSegment[];
  totalDuration?: { minutes?: number };
}
interface LiteFlightResponse {
  data?: Array<{ journeys?: LiteJourney[] }>;
}

function countStops(segments: LiteSegment[]): number {
  const out = segments.filter((s) => s.direction !== "INBOUND").length;
  return Math.max(0, out - 1);
}

async function fetchLiteFlights(req: TravelRequest): Promise<FlightOption[]> {
  if (!liteapiConfigured()) {
    throw new Error(
      "LITEAPI_API_KEY is not configured. The Flight Agent requires live LiteAPI data."
    );
  }
  const resp = await liteapiPost<LiteFlightResponse>("/flights/rates", {
    legs: [
      { origin: req.originCode, destination: req.destinationCode, date: req.departDate },
      { origin: req.destinationCode, destination: req.originCode, date: req.returnDate },
    ],
    adults: req.travelers,
    currency: req.currency,
  });

  const journeys = resp?.data?.flatMap((d) => d.journeys ?? []) ?? [];
  if (!journeys.length) {
    throw new Error(
      `No flights found for ${req.originCode} → ${req.destinationCode} on ${req.departDate}.`
    );
  }

  const options: FlightOption[] = [];
  const seenIds = new Set<string>();
  for (const [i, j] of journeys.entries()) {
    const offer = j.cheapestOffer ?? j.offers?.[0];
    if (!offer?.pricing?.display?.total) continue;
    const segments = j.segments ?? [];
    const first = segments[0];
    const total = Math.round(offer.pricing.display.total);

    // Use the full offerId to avoid collisions caused by shared prefixes.
    // Fall back to a guaranteed-unique index key when offerId is absent.
    let id = offer.offerId || `lite-${i}`;
    // Guard against duplicate IDs in the same response.
    if (seenIds.has(id)) id = `${id}-${i}`;
    seenIds.add(id);

    options.push({
      id,
      airline: first?.carrier?.marketingName || first?.carrier?.marketingCode || "Multiple",
      from: req.originCode,
      to: req.destinationCode,
      departDate: req.departDate,
      returnDate: req.returnDate,
      stops: countStops(segments),
      durationHours: j.totalDuration?.minutes
        ? Math.round((j.totalDuration.minutes / 60) * 10) / 10
        : 0,
      pricePerPerson: Math.round(total / req.travelers),
      totalPrice: total,
      currency: offer.pricing.display.currency || req.currency,
      baggageIncluded: (offer.baggage?.included?.length ?? 0) > 0,
      source: "liteapi",
    });
  }
  if (!options.length) {
    throw new Error("LiteAPI returned flight journeys but none had a bookable price.");
  }
  return options;
}

/**
 * Returns ranked flight options (cheapest first) from live LiteAPI data.
 * Throws if no live data is available — there is no sample fallback.
 */
export async function searchFlights(req: TravelRequest): Promise<FlightOption[]> {
  const options = await fetchLiteFlights(req);
  return options.sort((a, b) => a.totalPrice - b.totalPrice);
}
