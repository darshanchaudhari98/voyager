import { searchFlights } from "../providers/flights";
import {
  finishAgentRun,
  mergeContext,
  startAgentRun,
} from "../store";
import type { SharedContext, TravelRequest } from "../types";

/**
 * Flight Agent: searches real flights (Amadeus) and selects the best option
 * that fits inside the flight slice of the budget, falling back to cheapest.
 */
export async function runFlightAgent(
  workflowId: string,
  req: TravelRequest
): Promise<SharedContext> {
  const runId = await startAgentRun(workflowId, "flight", {
    route: `${req.originCode}->${req.destinationCode}`,
    travelers: req.travelers,
  });

  try {
    const options = await searchFlights(req);

    // Target ~45% of budget for flights; pick the best within that, else cheapest.
    const flightBudget = req.budget * 0.45;
    const withinBudget = options.filter((o) => o.totalPrice <= flightBudget);
    const selected = (withinBudget.length ? withinBudget : options).reduce(
      (best, o) => {
        // Prefer fewer stops then cheaper among affordable set.
        if (o.stops < best.stops) return o;
        if (o.stops === best.stops && o.totalPrice < best.totalPrice) return o;
        return best;
      }
    );

    const ctx = await mergeContext(
      workflowId,
      { flight: { selected, options } },
      {
        agent: "flight",
        message: `Selected ${selected.airline} flight (${selected.currency} ${selected.totalPrice}, source: ${selected.source})`,
      }
    );

    await finishAgentRun(workflowId, runId, "flight", "completed", {
      selected,
      optionCount: options.length,
    });
    return ctx;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishAgentRun(workflowId, runId, "flight", "failed", null, msg);
    throw err;
  }
}
