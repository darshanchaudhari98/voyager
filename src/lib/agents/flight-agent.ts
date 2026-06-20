import { searchFlights } from "../providers/flights";
import {
  finishAgentRun,
  mergeContext,
  sendAgentMessage,
  startAgentRun,
} from "../store";
import { money } from "../format";
import type { FlightOption, SharedContext, TravelRequest } from "../types";

/**
 * Flight Agent: searches real flights (Amadeus) and selects the best option
 * that fits inside the flight slice of the budget, falling back to cheapest.
 *
 * Accepts an optional `parallelGroup` so the orchestrator can run it
 * concurrently with the Hotel and Insights agents in the research phase.
 */
export async function runFlightAgent(
  workflowId: string,
  req: TravelRequest,
  parallelGroup?: string
): Promise<SharedContext> {
  const runId = await startAgentRun(
    workflowId,
    "flight",
    {
      route: `${req.originCode}->${req.destinationCode}`,
      travelers: req.travelers,
    },
    { parallelGroup, setCurrent: parallelGroup ? false : true }
  );

  try {
    const options = await searchFlights(req);
    const selected = selectFlight(options, req);

    const ctx = await mergeContext(
      workflowId,
      { flight: { selected, options } },
      {
        agent: "flight",
        message: `Selected ${selected.airline} flight (${money(selected.totalPrice, selected.currency)}${
          req.preferredAirline ? `, preferred airline: ${req.preferredAirline}` : ""
        }, source: ${selected.source})`,
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

/**
 * Autonomously pick the BEST flight given the traveller's preferences:
 *  - preferred airline (e.g. "Emirates") restricts the pool when matches exist
 *  - "budget"/"cheap" preference  -> cheapest fare
 *  - otherwise quality-first      -> fewest stops, then shortest duration,
 *    with a premium tie-break when the trip is "luxury"
 *
 * Quality-first means the agent may pick a pricier fare than the bare minimum,
 * which is intentional — it lets the Budget Agent open a real negotiation when
 * the combined plan exceeds the budget.
 */
function selectFlight(options: FlightOption[], req: TravelRequest): FlightOption {
  const prefs = req.preferences.map((p) => p.toLowerCase());
  const wantBudget = prefs.some((p) => ["budget", "cheap", "affordable"].includes(p));
  const luxury = prefs.some((p) => ["luxury", "premium", "business"].includes(p));

  // Airline preference: restrict to matching carriers if any exist.
  let pool = options;
  const airline = req.preferredAirline?.trim().toLowerCase();
  if (airline) {
    const matches = options.filter((o) => o.airline.toLowerCase().includes(airline));
    if (matches.length) pool = matches;
  }

  if (wantBudget) {
    return pool.reduce((best, o) => (o.totalPrice < best.totalPrice ? o : best));
  }

  return pool.reduce((best, o) => {
    if (o.stops !== best.stops) return o.stops < best.stops ? o : best;
    const od = o.durationHours || Infinity;
    const bd = best.durationHours || Infinity;
    if (od !== bd) return od < bd ? o : best;
    // Tie-break: luxury favours the premium (pricier) fare, else the cheaper one.
    if (luxury) return o.totalPrice > best.totalPrice ? o : best;
    return o.totalPrice < best.totalPrice ? o : best;
  });
}

/**
 * A2A responder: the Budget Agent asks the Flight Agent (by direct message) for
 * a cheaper option than the current selection. The Flight Agent replies with
 * the cheapest fit from its already-fetched live options. Returns the proposed
 * option (cheaper than current) or null if it cannot do better.
 */
export async function proposeCheaperFlight(
  workflowId: string,
  ctx: SharedContext,
  requestId: string
): Promise<FlightOption | null> {
  const options = ctx.flight?.options ?? [];
  const current = ctx.flight?.selected;
  if (!options.length || !current) return null;

  const cheapest = options.reduce((best, o) =>
    o.totalPrice < best.totalPrice ? o : best
  );
  const savings = current.totalPrice - cheapest.totalPrice;

  if (cheapest.id === current.id || savings <= 0) {
    await sendAgentMessage(workflowId, {
      sender: "flight",
      recipient: "budget",
      type: "response",
      subject: "No cheaper flight available — keeping the current pick",
      body: { proposed: null, currentPrice: current.totalPrice },
      inReplyTo: requestId,
    });
    return null;
  }

  await sendAgentMessage(workflowId, {
    sender: "flight",
    recipient: "budget",
    type: "response",
    subject: `Proposing ${cheapest.airline} instead — saves ${money(savings, cheapest.currency)}`,
    body: {
      proposedId: cheapest.id,
      airline: cheapest.airline,
      from: current.totalPrice,
      to: cheapest.totalPrice,
      savings,
    },
    inReplyTo: requestId,
  });
  return cheapest;
}
