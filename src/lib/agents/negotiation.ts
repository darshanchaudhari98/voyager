import { proposeCheaperFlight } from "./flight-agent";
import { proposeCheaperHotel } from "./hotel-agent";
import { proposeReducedActivities } from "./activity-agent";
import { proposeCheaperTransport } from "./transport-agent";
import { runBudgetAgent } from "./budget-agent";
import { getContext, mergeContext, sendAgentMessage } from "../store";
import { money } from "../format";
import type { SharedContext, TravelRequest } from "../types";

const MAX_ROUNDS = 3;

/**
 * Budget negotiation — a DIRECT, multi-party agent-to-agent (A2A) exchange.
 *
 * When the trip is over budget, the Budget Agent does NOT hand the problem
 * straight to the human. It opens a negotiation with its peer agents over the
 * agent_messages channel and they collaboratively optimize the trip:
 *
 *   budget ──request──▶ flight     "propose a cheaper flight"
 *   budget ──request──▶ hotel      "propose a cheaper hotel"
 *   budget ──request──▶ activity   "trim optional activities"
 *   budget ──request──▶ transport  "propose cheaper transport"
 *   (peers respond in parallel; budget applies the best swaps and recomputes)
 *
 * Repeats up to MAX_ROUNDS until the trip fits the budget or no further savings
 * are possible. Everything is recorded as messages + context updates, so the
 * full collaboration is observable. The human still approves afterwards.
 */
export async function runBudgetNegotiation(
  workflowId: string,
  req: TravelRequest,
  ctx: SharedContext,
  effectiveBudget?: number
): Promise<SharedContext> {
  if (!ctx.budget || ctx.budget.withinBudget) return ctx;

  const cur = req.currency;
  const target = effectiveBudget ?? ctx.budget.budget;
  const startTotal = ctx.budget.totalCost;
  const appliedAgents = new Set<string>();
  let rounds = 0;

  await sendAgentMessage(workflowId, {
    sender: "budget",
    recipient: "all",
    type: "broadcast",
    subject: `Over budget by ${money(ctx.budget.overage, cur)} — opening negotiation`,
    body: { totalCost: startTotal, target, overage: ctx.budget.overage },
  });

  let current = ctx;
  while (rounds < MAX_ROUNDS) {
    const b = current.budget;
    if (!b || b.withinBudget) break;
    rounds += 1;
    const needToSave = b.overage;

    // Budget requests proposals from each cost-bearing peer (in parallel).
    const flightReq = await sendAgentMessage(workflowId, {
      sender: "budget",
      recipient: "flight",
      type: "request",
      subject: `Round ${rounds}: can you propose a cheaper flight? (need to save ${money(needToSave, cur)})`,
      body: { needToSave, currentFlightCost: b.flightCost },
    });
    const hotelReq = await sendAgentMessage(workflowId, {
      sender: "budget",
      recipient: "hotel",
      type: "request",
      subject: `Round ${rounds}: can you propose a cheaper hotel? (need to save ${money(needToSave, cur)})`,
      body: { needToSave, currentHotelCost: b.hotelCost },
    });
    const activityReq = await sendAgentMessage(workflowId, {
      sender: "budget",
      recipient: "activity",
      type: "request",
      subject: `Round ${rounds}: can you trim optional activities? (need to save ${money(needToSave, cur)})`,
      body: { needToSave, currentActivityCost: b.activityCost },
    });
    const transportReq = await sendAgentMessage(workflowId, {
      sender: "budget",
      recipient: "transport",
      type: "request",
      subject: `Round ${rounds}: can you suggest cheaper transport? (need to save ${money(needToSave, cur)})`,
      body: { needToSave, currentTransportCost: b.transportCost },
    });

    const [cheaperFlight, cheaperHotel, reducedActivities, cheaperTransport] =
      await Promise.all([
        proposeCheaperFlight(workflowId, current, flightReq),
        proposeCheaperHotel(workflowId, current, hotelReq),
        proposeReducedActivities(workflowId, current, needToSave, activityReq),
        proposeCheaperTransport(workflowId, current, transportReq),
      ]);

    const patch: Partial<SharedContext> = {};
    if (cheaperFlight && cheaperFlight.id !== current.flight?.selected.id) {
      patch.flight = { selected: cheaperFlight, options: current.flight?.options ?? [] };
      appliedAgents.add("flight");
    }
    if (cheaperHotel && cheaperHotel.id !== current.hotel?.selected.id) {
      patch.hotel = { selected: cheaperHotel, options: current.hotel?.options ?? [] };
      appliedAgents.add("hotel");
    }
    if (reducedActivities && reducedActivities.totalCost < (current.activity?.totalCost ?? 0)) {
      patch.activity = reducedActivities;
      appliedAgents.add("activity");
    }
    if (cheaperTransport && cheaperTransport.id !== current.transport?.selected.id) {
      patch.transport = {
        selected: cheaperTransport,
        options: current.transport?.options ?? [],
        generatedBy: current.transport?.generatedBy ?? "",
      };
      appliedAgents.add("transport");
    }

    // No peer could improve anything — negotiation has converged.
    if (!Object.keys(patch).length) break;

    await mergeContext(workflowId, patch, {
      agent: "budget",
      message: `Round ${rounds}: applied proposals from ${Object.keys(patch).join(", ")}`,
    });
    current = await runBudgetAgent(workflowId, req, await getContext(workflowId), effectiveBudget);
  }

  const endTotal = current.budget?.totalCost ?? startTotal;
  const savings = Math.max(0, startTotal - endTotal);
  const within = !!current.budget?.withinBudget;
  const applied = [...appliedAgents];

  const summary = !applied.length
    ? `No cheaper alternatives were available — keeping the original plan (total ${money(endTotal, cur)}).`
    : within
    ? `Negotiation across ${applied.join(", ")} brought the trip within budget over ${rounds} round${
        rounds === 1 ? "" : "s"
      } — saved ${money(savings, cur)} (new total ${money(endTotal, cur)}).`
    : `Negotiation across ${applied.join(", ")} saved ${money(savings, cur)} over ${rounds} round${
        rounds === 1 ? "" : "s"
      } (new total ${money(endTotal, cur)}), still over by ${money(current.budget?.overage ?? 0, cur)}.`;

  await sendAgentMessage(workflowId, {
    sender: "budget",
    recipient: "all",
    type: "broadcast",
    subject: `Negotiation closed — saved ${money(savings, cur)}`,
    body: { applied, savings, newTotal: endTotal, withinBudget: within, rounds },
  });

  return mergeContext(
    workflowId,
    { negotiation: { triggered: true, rounds, savings, summary, applied } },
    { agent: "budget", message: summary }
  );
}
