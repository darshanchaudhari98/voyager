import { generateActivities } from "../providers/activities";
import {
  finishAgentRun,
  mergeContext,
  sendAgentMessage,
  startAgentRun,
} from "../store";
import { money } from "../format";
import type { ActivityPlan, SharedContext, TravelRequest } from "../types";

/**
 * Activity Agent: recommends experiences/activities with estimated costs and an
 * `optional` flag. Runs concurrently with the other research agents. During
 * budget negotiation it can drop optional items to save money.
 */
export async function runActivityAgent(
  workflowId: string,
  req: TravelRequest,
  parallelGroup?: string
): Promise<SharedContext | null> {
  const runId = await startAgentRun(
    workflowId,
    "activity",
    { destination: req.destination, preferences: req.preferences },
    { parallelGroup, setCurrent: parallelGroup ? false : true }
  );

  try {
    const activity = await generateActivities(req);
    const ctx = await mergeContext(
      workflowId,
      { activity },
      {
        agent: "activity",
        message: `Recommended ${activity.items.length} activities (${money(activity.totalCost, activity.currency)})`,
      }
    );
    await finishAgentRun(workflowId, runId, "activity", "completed", {
      count: activity.items.length,
      totalCost: activity.totalCost,
    });
    return ctx;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Auxiliary to the core booking — degrade gracefully (no activity cost).
    await finishAgentRun(workflowId, runId, "activity", "skipped", null, msg);
    return null;
  }
}

/**
 * A2A responder: the Budget Agent asks the Activity Agent to trim spend. The
 * Activity Agent drops its most expensive OPTIONAL items until it has freed up
 * roughly the requested amount, and replies with the reduced plan + savings.
 */
export async function proposeReducedActivities(
  workflowId: string,
  ctx: SharedContext,
  needToSave: number,
  requestId: string
): Promise<ActivityPlan | null> {
  const plan = ctx.activity;
  if (!plan || !plan.items.length) return null;

  const optional = plan.items
    .filter((i) => i.optional)
    .sort((a, b) => b.cost - a.cost);

  if (!optional.length) {
    await sendAgentMessage(workflowId, {
      sender: "activity",
      recipient: "budget",
      type: "response",
      subject: "No optional activities left to cut",
      body: { proposed: null, totalCost: plan.totalCost },
      inReplyTo: requestId,
    });
    return null;
  }

  const dropIds = new Set<string>();
  let saved = 0;
  for (const item of optional) {
    if (saved >= needToSave) break;
    dropIds.add(item.id);
    saved += item.cost;
  }

  const remaining = plan.items.filter((i) => !dropIds.has(i.id));
  const reduced: ActivityPlan = {
    ...plan,
    items: remaining,
    totalCost: remaining.reduce((s, a) => s + a.cost, 0),
    droppedCount: plan.droppedCount + dropIds.size,
  };

  await sendAgentMessage(workflowId, {
    sender: "activity",
    recipient: "budget",
    type: "response",
    subject: `Dropping ${dropIds.size} optional activit${
      dropIds.size === 1 ? "y" : "ies"
    } — saves ${money(saved, plan.currency)}`,
    body: {
      dropped: dropIds.size,
      from: plan.totalCost,
      to: reduced.totalCost,
      savings: saved,
    },
    inReplyTo: requestId,
  });
  return reduced;
}
