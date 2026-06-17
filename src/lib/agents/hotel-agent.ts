import { searchHotels } from "../providers/hotels";
import {
  finishAgentRun,
  mergeContext,
  startAgentRun,
} from "../store";
import type { SharedContext, TravelRequest } from "../types";

/**
 * Hotel Agent: searches real hotels (Amadeus) and selects a suitable option,
 * preferring the highest-rated stay that fits the hotel budget slice.
 */
export async function runHotelAgent(
  workflowId: string,
  req: TravelRequest
): Promise<SharedContext> {
  const runId = await startAgentRun(workflowId, "hotel", {
    city: req.destinationCode,
    nights: Math.max(1, req.days - 1),
  });

  try {
    const options = await searchHotels(req);

    // Target ~30% of budget for hotels.
    const hotelBudget = req.budget * 0.3;
    const affordable = options.filter((o) => o.totalPrice <= hotelBudget);
    const pool = affordable.length ? affordable : options;
    // Pick best rating within affordable pool; tie-break on lower price.
    const selected = pool.reduce((best, o) => {
      if (o.rating > best.rating) return o;
      if (o.rating === best.rating && o.totalPrice < best.totalPrice) return o;
      return best;
    });

    const ctx = await mergeContext(
      workflowId,
      { hotel: { selected, options } },
      {
        agent: "hotel",
        message: `Selected ${selected.name} (${selected.rating}★, ${selected.currency} ${selected.totalPrice}, source: ${selected.source})`,
      }
    );

    await finishAgentRun(workflowId, runId, "hotel", "completed", {
      selected,
      optionCount: options.length,
    });
    return ctx;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishAgentRun(workflowId, runId, "hotel", "failed", null, msg);
    throw err;
  }
}
