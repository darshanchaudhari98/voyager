import { searchHotels } from "../providers/hotels";
import {
  finishAgentRun,
  mergeContext,
  sendAgentMessage,
  startAgentRun,
} from "../store";
import { money } from "../format";
import type { HotelOption, SharedContext, TravelRequest } from "../types";

/**
 * Hotel Agent: searches real hotels (Amadeus) and selects a suitable option,
 * preferring the highest-rated stay that fits the hotel budget slice.
 *
 * Accepts an optional `parallelGroup` so the orchestrator can run it
 * concurrently with the Flight and Insights agents in the research phase.
 */
export async function runHotelAgent(
  workflowId: string,
  req: TravelRequest,
  parallelGroup?: string
): Promise<SharedContext> {
  const runId = await startAgentRun(
    workflowId,
    "hotel",
    {
      city: req.destinationCode,
      nights: Math.max(1, req.days - 1),
    },
    { parallelGroup, setCurrent: parallelGroup ? false : true }
  );

  try {
    const options = await searchHotels(req);
    const selected = selectHotel(options, req);

    const ctx = await mergeContext(
      workflowId,
      { hotel: { selected, options } },
      {
        agent: "hotel",
        message: `Selected ${selected.name} (${selected.rating}★, ${money(selected.totalPrice, selected.currency)}, source: ${selected.source})`,
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

/**
 * Autonomously pick the BEST stay given the traveller's preferences:
 *  - "budget"/"cheap"   -> cheapest stay
 *  - "luxury"/"premium" -> highest rating, tie-broken to the pricier (premium) hotel
 *  - otherwise           -> highest rating, tie-broken to the cheaper hotel
 *
 * As with flights, the default is quality-first (not the absolute cheapest), so
 * a combined plan can legitimately exceed the budget and trigger negotiation.
 */
function selectHotel(options: HotelOption[], req: TravelRequest): HotelOption {
  const prefs = req.preferences.map((p) => p.toLowerCase());
  const wantBudget = prefs.some((p) => ["budget", "cheap", "affordable"].includes(p));
  const luxury = prefs.some((p) =>
    ["luxury", "premium", "5-star", "five star"].includes(p)
  );

  if (wantBudget) {
    return options.reduce((best, o) => (o.totalPrice < best.totalPrice ? o : best));
  }

  return options.reduce((best, o) => {
    if (o.rating !== best.rating) return o.rating > best.rating ? o : best;
    if (luxury) return o.totalPrice > best.totalPrice ? o : best;
    return o.totalPrice < best.totalPrice ? o : best;
  });
}

/**
 * A2A responder: the Budget Agent asks the Hotel Agent (by direct message) for
 * a cheaper stay than the current selection. The Hotel Agent replies with the
 * cheapest option from its already-fetched live options. Returns the proposed
 * option (cheaper than current) or null if it cannot do better.
 */
export async function proposeCheaperHotel(
  workflowId: string,
  ctx: SharedContext,
  requestId: string
): Promise<HotelOption | null> {
  const options = ctx.hotel?.options ?? [];
  const current = ctx.hotel?.selected;
  if (!options.length || !current) return null;

  const cheapest = options.reduce((best, o) =>
    o.totalPrice < best.totalPrice ? o : best
  );
  const savings = current.totalPrice - cheapest.totalPrice;

  if (cheapest.id === current.id || savings <= 0) {
    await sendAgentMessage(workflowId, {
      sender: "hotel",
      recipient: "budget",
      type: "response",
      subject: "No cheaper hotel available — keeping the current pick",
      body: { proposed: null, currentPrice: current.totalPrice },
      inReplyTo: requestId,
    });
    return null;
  }

  await sendAgentMessage(workflowId, {
    sender: "hotel",
    recipient: "budget",
    type: "response",
    subject: `Proposing ${cheapest.name} instead — saves ${money(savings, cheapest.currency)}`,
    body: {
      proposedId: cheapest.id,
      name: cheapest.name,
      from: current.totalPrice,
      to: cheapest.totalPrice,
      savings,
    },
    inReplyTo: requestId,
  });
  return cheapest;
}
