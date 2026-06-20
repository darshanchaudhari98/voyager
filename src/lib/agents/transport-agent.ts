import { generateTransport } from "../providers/transport";
import {
  finishAgentRun,
  mergeContext,
  sendAgentMessage,
  startAgentRun,
} from "../store";
import { money } from "../format";
import type { SharedContext, TransportOption, TravelRequest } from "../types";

/**
 * Transport Agent: recommends ground/local transport with a default selection
 * and cheaper alternatives. Runs concurrently with the other research agents.
 * During negotiation it can switch to a lower-cost option.
 */
export async function runTransportAgent(
  workflowId: string,
  req: TravelRequest,
  parallelGroup?: string
): Promise<SharedContext | null> {
  const runId = await startAgentRun(
    workflowId,
    "transport",
    { destination: req.destination, travelers: req.travelers },
    { parallelGroup, setCurrent: parallelGroup ? false : true }
  );

  try {
    const transport = await generateTransport(req);
    const ctx = await mergeContext(
      workflowId,
      { transport },
      {
        agent: "transport",
        message: `Selected ${transport.selected.mode} (${money(transport.selected.cost, transport.selected.currency)}), ${transport.options.length} options`,
      }
    );
    await finishAgentRun(workflowId, runId, "transport", "completed", {
      selected: transport.selected.mode,
      options: transport.options.length,
    });
    return ctx;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Auxiliary to the core booking — degrade gracefully (no transport cost).
    await finishAgentRun(workflowId, runId, "transport", "skipped", null, msg);
    return null;
  }
}

/**
 * A2A responder: the Budget Agent asks the Transport Agent for a cheaper
 * option. It replies with the cheapest available option (if cheaper than the
 * current selection) and the savings.
 */
export async function proposeCheaperTransport(
  workflowId: string,
  ctx: SharedContext,
  requestId: string
): Promise<TransportOption | null> {
  const plan = ctx.transport;
  if (!plan || !plan.options.length) return null;

  const cheapest = plan.options.reduce((best, o) =>
    o.cost < best.cost ? o : best
  );
  const savings = plan.selected.cost - cheapest.cost;

  if (cheapest.id === plan.selected.id || savings <= 0) {
    await sendAgentMessage(workflowId, {
      sender: "transport",
      recipient: "budget",
      type: "response",
      subject: "Already on the cheapest transport option",
      body: { proposed: null, currentCost: plan.selected.cost },
      inReplyTo: requestId,
    });
    return null;
  }

  await sendAgentMessage(workflowId, {
    sender: "transport",
    recipient: "budget",
    type: "response",
    subject: `Switching to ${cheapest.mode} — saves ${money(savings, cheapest.currency)}`,
    body: {
      proposedId: cheapest.id,
      mode: cheapest.mode,
      from: plan.selected.cost,
      to: cheapest.cost,
      savings,
    },
    inReplyTo: requestId,
  });
  return cheapest;
}
