import { runBudgetAgent } from "./agents/budget-agent";
import { runFlightAgent } from "./agents/flight-agent";
import { runHotelAgent } from "./agents/hotel-agent";
import { runItineraryAgent } from "./agents/itinerary-agent";
import { getServiceClient } from "./supabase/server";
import {
  emitEvent,
  getContext,
  getWorkflow,
  mergeContext,
  updateWorkflow,
} from "./store";
import type { AgentName, SharedContext, TravelRequest } from "./types";

// =============================================================================
// Orchestrator: drives the sequential multi-agent pipeline over the shared
// context with a human decision point BEFORE every task moves forward:
//
//   flight  ─▶ [SELECT a flight]  ─▶ hotel ─▶ [SELECT a hotel]
//           ─▶ budget ─▶ [APPROVE] ─▶ itinerary ─▶ [APPROVE] ─▶ done
//
// Flight & Hotel pause for an interactive selection. Budget & Itinerary pause
// for an approval gate. If the Flight/Hotel providers return no live results
// (typically a date-availability issue), the workflow pauses for INPUT instead
// of failing — the operator supplies new dates and the step is retried.
// =============================================================================

const AGENT_LABEL: Record<AgentName, string> = {
  flight: "Flight Agent",
  hotel: "Hotel Agent",
  budget: "Budget Agent",
  approval: "Approval Agent",
  itinerary: "Itinerary Agent",
};

const STEP_DESC: Record<string, string> = {
  budget: "compute the total trip cost",
  itinerary: "generate the day-by-day itinerary",
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * A "recoverable" failure is a data/availability problem the operator can fix
 * by adjusting the trip dates (e.g. no flights/hotels for the chosen dates).
 * Configuration problems (missing API key) are NOT recoverable this way.
 */
function isRecoverable(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("not configured")) return false;
  return (
    m.includes("no flights") ||
    m.includes("no available") ||
    m.includes("no hotels") ||
    m.includes("none had a bookable") ||
    m.includes("returned") // "returned X but none had a bookable …"
  );
}

// ---------------------------------------------------------------------------
// Pause helpers
// ---------------------------------------------------------------------------

/** Pause so the operator can pick a flight/hotel option. */
async function requestSelection(
  workflowId: string,
  step: AgentName,
  count: number
): Promise<void> {
  await updateWorkflow(workflowId, {
    status: "awaiting_selection",
    current_agent: step,
  });
  await emitEvent(workflowId, "selection_required", {
    agent: step,
    message: `${AGENT_LABEL[step]} found ${count} option${
      count === 1 ? "" : "s"
    } — awaiting your selection`,
    payload: { step, count },
  });
}

/** Pause so the operator can supply corrected input (new trip dates). */
async function requestInput(
  workflowId: string,
  step: AgentName,
  message: string
): Promise<void> {
  await mergeContext(
    workflowId,
    { inputRequest: { agent: step, kind: "dates", message } },
    { agent: step, message: `Input required — ${message}` }
  );
  await updateWorkflow(workflowId, {
    status: "awaiting_input",
    current_agent: step,
  });
  await emitEvent(workflowId, "input_required", {
    agent: step,
    message,
    payload: { step },
  });
}

/** Pause so the operator can review the detailed budget breakdown. */
async function requestBudgetReview(workflowId: string): Promise<void> {
  const ctx = await getContext(workflowId);
  const b = ctx.budget;
  await updateWorkflow(workflowId, {
    status: "awaiting_budget_review",
    current_agent: "budget",
  });
  await emitEvent(workflowId, "budget_review_required", {
    agent: "budget",
    message: b
      ? `Budget computed — total ${b.currency} ${b.totalCost} (${
          b.withinBudget ? "within budget" : `over by ${b.currency} ${b.overage}`
        }). Review the breakdown.`
      : "Budget computed — review the breakdown.",
    payload: { totalCost: b?.totalCost, withinBudget: b?.withinBudget },
  });
}

/** Pause at a budget/itinerary approval gate. */
async function requestApproval(
  workflowId: string,
  step: AgentName,
  ctx: SharedContext
): Promise<void> {
  const db = getServiceClient();
  const budget = ctx.budget;
  const overBudget = budget && !budget.withinBudget;

  const reason = overBudget
    ? `Budget exceeded by ${budget.currency} ${budget.overage}. Approve to run the ${AGENT_LABEL[step]} — ${STEP_DESC[step]}.`
    : `Approval required to run the ${AGENT_LABEL[step]} — ${STEP_DESC[step]}.`;

  const { data, error } = await db
    .from("approvals")
    .insert({
      workflow_id: workflowId,
      status: "pending",
      reason,
      budget: budget?.budget ?? null,
      total_cost: budget?.totalCost ?? null,
      overage: budget?.overage ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`create approval: ${error.message}`);

  await updateWorkflow(workflowId, {
    status: "awaiting_approval",
    current_agent: step,
  });
  await emitEvent(workflowId, "approval_required", {
    agent: "approval",
    message: reason,
    payload: {
      approvalId: data.id,
      step,
      budget: budget?.budget,
      totalCost: budget?.totalCost,
      overage: budget?.overage,
    },
  });
}

async function finalize(workflowId: string): Promise<void> {
  const ctx = await getContext(workflowId);
  await updateWorkflow(workflowId, {
    status: "completed",
    current_agent: null,
    result: ctx,
  });
  await emitEvent(workflowId, "workflow_completed", {
    message: "Workflow completed successfully",
    payload: { totalCost: ctx.budget?.totalCost },
  });
}

async function fail(workflowId: string, err: unknown): Promise<void> {
  const msg = errMsg(err);
  await updateWorkflow(workflowId, {
    status: "failed",
    current_agent: null,
    error: msg,
  });
  await emitEvent(workflowId, "workflow_failed", {
    message: `Workflow failed: ${msg}`,
    payload: { error: msg },
  });
}

// ---------------------------------------------------------------------------
// Step execution: runs one task and sets up the next pause. Flight/Hotel data
// failures are routed to an input-recovery pause rather than failing the run.
// ---------------------------------------------------------------------------
async function executeStep(
  workflowId: string,
  step: AgentName,
  req: TravelRequest
): Promise<void> {
  switch (step) {
    case "flight": {
      try {
        await runFlightAgent(workflowId, req);
      } catch (err) {
        const msg = errMsg(err);
        if (isRecoverable(msg)) return requestInput(workflowId, "flight", msg);
        throw err;
      }
      const ctx = await getContext(workflowId);
      await requestSelection(workflowId, "flight", ctx.flight?.options.length ?? 0);
      return;
    }
    case "hotel": {
      try {
        await runHotelAgent(workflowId, req);
      } catch (err) {
        const msg = errMsg(err);
        if (isRecoverable(msg)) return requestInput(workflowId, "hotel", msg);
        throw err;
      }
      const ctx = await getContext(workflowId);
      await requestSelection(workflowId, "hotel", ctx.hotel?.options.length ?? 0);
      return;
    }
    case "budget": {
      const ctx = await getContext(workflowId);
      await runBudgetAgent(workflowId, req, ctx);
      await requestBudgetReview(workflowId);
      return;
    }
    case "itinerary": {
      const ctx = await getContext(workflowId);
      await runItineraryAgent(workflowId, req, ctx);
      await finalize(workflowId);
      return;
    }
    default:
      throw new Error(`Unknown step: ${step}`);
  }
}

// ---------------------------------------------------------------------------
// Pipeline entrypoints
// ---------------------------------------------------------------------------

/** Start the pipeline at the Flight Agent. */
export async function runWorkflow(workflowId: string): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    await executeStep(workflowId, "flight", wf.request);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/**
 * Apply the operator's flight/hotel selection, then advance:
 *  - after a flight is chosen -> run the Hotel Agent, pause for hotel selection
 *  - after a hotel is chosen  -> open the Budget Agent approval gate
 */
export async function submitSelection(
  workflowId: string,
  optionId: string
): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    const req = wf.request;
    const step = wf.current_agent as AgentName;
    let ctx = await getContext(workflowId);

    await updateWorkflow(workflowId, { status: "running" });

    if (step === "flight") {
      const chosen =
        ctx.flight?.options.find((o) => o.id === optionId) ?? ctx.flight?.selected;
      if (!chosen) throw new Error("Selected flight option not found");
      await mergeContext(
        workflowId,
        { flight: { selected: chosen, options: ctx.flight?.options ?? [] } },
        {
          agent: "flight",
          message: `Operator selected ${chosen.airline} (${chosen.currency} ${chosen.totalPrice})`,
        }
      );
      await emitEvent(workflowId, "selection_received", {
        agent: "flight",
        message: `Flight selected: ${chosen.airline}`,
        payload: { optionId: chosen.id },
      });

      await executeStep(workflowId, "hotel", req);
      return;
    }

    if (step === "hotel") {
      const chosen =
        ctx.hotel?.options.find((o) => o.id === optionId) ?? ctx.hotel?.selected;
      if (!chosen) throw new Error("Selected hotel option not found");
      ctx = await mergeContext(
        workflowId,
        { hotel: { selected: chosen, options: ctx.hotel?.options ?? [] } },
        {
          agent: "hotel",
          message: `Operator selected ${chosen.name} (${chosen.currency} ${chosen.totalPrice})`,
        }
      );
      await emitEvent(workflowId, "selection_received", {
        agent: "hotel",
        message: `Hotel selected: ${chosen.name}`,
        payload: { optionId: chosen.id },
      });

      await executeStep(workflowId, "budget", req);
      return;
    }

    throw new Error(`Cannot submit a selection for step: ${step}`);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/**
 * Apply corrected input (new trip dates) and retry the step that needed it.
 */
export async function provideInput(
  workflowId: string,
  input: { departDate: string; returnDate: string }
): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    const step = (wf.current_agent ?? "flight") as AgentName;

    const depart = input.departDate;
    const ret = input.returnDate;
    if (!depart || !ret) throw new Error("Both departure and return dates are required");
    if (new Date(ret).getTime() <= new Date(depart).getTime()) {
      throw new Error("Return date must be after the departure date");
    }

    const dayMs = 86_400_000;
    const days = Math.max(
      1,
      Math.round((new Date(ret).getTime() - new Date(depart).getTime()) / dayMs)
    );
    const newReq: TravelRequest = {
      ...wf.request,
      departDate: depart,
      returnDate: ret,
      days,
    };

    await updateWorkflow(workflowId, { request: newReq, status: "running" });
    await mergeContext(
      workflowId,
      { request: newReq, inputRequest: null },
      { agent: step, message: `Trip dates updated to ${depart} → ${ret}` }
    );
    await emitEvent(workflowId, "input_received", {
      agent: step,
      message: `Dates updated: ${depart} → ${ret}`,
      payload: { departDate: depart, returnDate: ret, days },
    });

    await executeStep(workflowId, step, newReq);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/**
 * The operator has reviewed the budget breakdown — open the approval gate
 * (approve / modify budget / reject) before the Itinerary Agent runs.
 */
export async function acknowledgeBudget(workflowId: string): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    const ctx = await getContext(workflowId);
    await updateWorkflow(workflowId, { status: "running" });
    await requestApproval(workflowId, "itinerary", ctx);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/**
 * Estimate the total cost for a (flight, hotel) pair using the same formula as
 * the Budget Agent so the optimizer's choice matches the recomputed breakdown.
 */
function estimateTotal(
  req: TravelRequest,
  targetBudget: number,
  flightCost: number,
  hotelCost: number
): number {
  const perDayPerPerson = Math.round((targetBudget * 0.04) / req.days);
  const activities = perDayPerPerson * req.days * req.travelers;
  const contingency = Math.round((flightCost + hotelCost) * 0.1);
  const misc = activities + contingency;
  return flightCost + hotelCost + misc;
}

/**
 * Auto-match the trip to a target budget: pick the flight + hotel combination
 * (from the already-fetched live options) whose estimated total is as close as
 * possible to — and preferably within — the target. Then recompute the budget
 * and pause on the budget review so the operator sees what the agent matched.
 */
export async function autoMatchBudget(
  workflowId: string,
  targetBudget: number
): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    if (!targetBudget || targetBudget <= 0) {
      throw new Error("A positive target budget is required to auto-match");
    }

    const ctx = await getContext(workflowId);
    const flightOptions = ctx.flight?.options ?? [];
    const hotelOptions = ctx.hotel?.options ?? [];
    if (!flightOptions.length || !hotelOptions.length) {
      throw new Error("No flight/hotel options available to auto-match");
    }

    const previousTotal = ctx.budget?.totalCost ?? 0;
    const newReq: TravelRequest = { ...wf.request, budget: targetBudget };

    // Search every flight × hotel combination for the best fit.
    let best: { flightId: string; hotelId: string; total: number } | null = null;
    for (const f of flightOptions) {
      for (const h of hotelOptions) {
        const total = estimateTotal(newReq, targetBudget, f.totalPrice, h.totalPrice);
        if (!best) {
          best = { flightId: f.id, hotelId: h.id, total };
          continue;
        }
        const within = total <= targetBudget;
        const bestWithin = best.total <= targetBudget;
        // Prefer the combination closest to the target without exceeding it.
        if (within && bestWithin) {
          if (total > best.total) best = { flightId: f.id, hotelId: h.id, total };
        } else if (within && !bestWithin) {
          best = { flightId: f.id, hotelId: h.id, total };
        } else if (!within && !bestWithin) {
          if (total < best.total) best = { flightId: f.id, hotelId: h.id, total };
        }
      }
    }
    if (!best) throw new Error("Could not determine a matching combination");

    const flight = flightOptions.find((o) => o.id === best!.flightId)!;
    const hotel = hotelOptions.find((o) => o.id === best!.hotelId)!;

    await mergeContext(
      workflowId,
      {
        flight: { selected: flight, options: flightOptions },
        hotel: { selected: hotel, options: hotelOptions },
      },
      {
        agent: "budget",
        message: `Auto-matched selections: ${flight.airline} + ${hotel.name}`,
      }
    );

    await updateWorkflow(workflowId, { request: newReq, budget: targetBudget });

    // Recompute the budget with the new selections + target budget.
    const recomputed = await runBudgetAgent(workflowId, newReq, await getContext(workflowId), targetBudget);
    const b = recomputed.budget;
    const withinBudget = !!b && b.withinBudget;

    const message = withinBudget
      ? `Matched your budget of ${newReq.currency} ${targetBudget}. Selected the closest flight (${flight.airline}) and hotel (${hotel.name}) — new estimated total ${newReq.currency} ${b?.totalCost}.`
      : `Optimized as close as possible to ${newReq.currency} ${targetBudget}. Picked the most affordable flight (${flight.airline}) and hotel (${hotel.name}) — estimated total ${newReq.currency} ${b?.totalCost}.`;

    await mergeContext(
      workflowId,
      {
        autoMatch: {
          applied: true,
          message,
          targetBudget,
          previousTotal,
          newTotal: b?.totalCost ?? 0,
          withinBudget,
        },
      },
      { agent: "budget", message }
    );

    await requestBudgetReview(workflowId);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/**
 * Resume after a budget/itinerary approval decision.
 *  - approve        -> run the gated step, then open the next gate (or finish)
 *  - update_budget  -> recompute the budget breakdown against the new budget
 *                      and re-open the SAME gate with refreshed numbers
 *  - reject         -> handled in the command route (marks workflow rejected)
 */
export async function resumeWorkflow(
  workflowId: string,
  opts: { newBudget?: number } = {}
): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    const req = wf.request;
    const step = (wf.current_agent ?? "budget") as AgentName;

    // --- Modify budget: recompute and re-gate the same step. ---------------
    if (opts.newBudget && opts.newBudget > 0) {
      let ctx = await getContext(workflowId);
      await updateWorkflow(workflowId, { budget: opts.newBudget });

      if (ctx.budget) {
        ctx = await runBudgetAgent(workflowId, req, ctx, opts.newBudget);
      }

      await mergeContext(
        workflowId,
        {
          approval: {
            required: true,
            resolution: "update_budget",
            newBudget: opts.newBudget,
          },
        },
        {
          agent: "approval",
          message: `Budget updated to ${req.currency} ${opts.newBudget}`,
        }
      );

      await requestApproval(workflowId, step, ctx);
      return;
    }

    // --- Approve: run the gated step, then advance. ------------------------
    await updateWorkflow(workflowId, { status: "running" });
    await mergeContext(
      workflowId,
      { approval: { required: false, resolution: "approve" } },
      { agent: "approval", message: `${AGENT_LABEL[step]} approved` }
    );

    await executeStep(workflowId, step, req);
  } catch (err) {
    await fail(workflowId, err);
  }
}
