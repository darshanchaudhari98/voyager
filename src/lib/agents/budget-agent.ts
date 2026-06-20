import {
  finishAgentRun,
  mergeContext,
  startAgentRun,
  updateWorkflow,
} from "../store";
import { money } from "../format";
import type { BudgetBreakdown, SharedContext, TravelRequest } from "../types";

/**
 * Budget Agent: computes flight, hotel, miscellaneous and total cost from the
 * shared context and records whether the trip is within budget.
 * `effectiveBudget` lets a resumed workflow recompute against an increased budget.
 */
export async function runBudgetAgent(
  workflowId: string,
  req: TravelRequest,
  ctx: SharedContext,
  effectiveBudget?: number
): Promise<SharedContext> {
  const runId = await startAgentRun(workflowId, "budget", {
    budget: effectiveBudget ?? req.budget,
  });

  try {
    const flightCost = ctx.flight?.selected.totalPrice ?? 0;
    const hotelCost = ctx.hotel?.selected.totalPrice ?? 0;
    const activityCost = ctx.activity?.totalCost ?? 0;
    const transportCost = ctx.transport?.selected.cost ?? 0;

    // Miscellaneous = food, incidentals and a contingency buffer. Activities and
    // local transport now have their own dedicated agents/lines, so misc only
    // covers food/incidentals (~4% of budget per person per day) plus a 10%
    // contingency on the committed travel + stay.
    const perDayPerPerson = Math.round((req.budget * 0.025) / req.days);
    const foodIncidentals = perDayPerPerson * req.days * req.travelers;
    const contingency = Math.round((flightCost + hotelCost) * 0.1);
    const miscCost = foodIncidentals + contingency;

    const onGroundCost = activityCost + transportCost + miscCost;
    const totalCost = flightCost + hotelCost + onGroundCost;
    const budget = effectiveBudget ?? req.budget;
    const overage = Math.max(0, totalCost - budget);

    const breakdown: BudgetBreakdown = {
      flightCost,
      hotelCost,
      activityCost,
      transportCost,
      miscCost,
      onGroundCost,
      totalCost,
      budget,
      overage,
      withinBudget: totalCost <= budget,
      currency: req.currency,
    };

    const next = await mergeContext(
      workflowId,
      { budget: breakdown },
      {
        agent: "budget",
        message: `Total ${money(totalCost, req.currency)} vs budget ${money(budget, req.currency)} (${
          breakdown.withinBudget ? "within" : "over"
        })`,
      }
    );

    await updateWorkflow(workflowId, { total_cost: totalCost, budget });
    await finishAgentRun(workflowId, runId, "budget", "completed", breakdown);
    return next;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishAgentRun(workflowId, runId, "budget", "failed", null, msg);
    throw err;
  }
}
