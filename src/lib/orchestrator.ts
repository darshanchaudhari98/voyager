import { runBudgetAgent } from "./agents/budget-agent";
import { runFlightAgent } from "./agents/flight-agent";
import { runHotelAgent } from "./agents/hotel-agent";
import { runActivityAgent } from "./agents/activity-agent";
import { runTransportAgent } from "./agents/transport-agent";
import { runWeatherAgent } from "./agents/weather-agent";
import { runInsightsAgent } from "./agents/insights-agent";
import { runItineraryAgent } from "./agents/itinerary-agent";
import { runBudgetNegotiation } from "./agents/negotiation";
import { parsePreferenceChange } from "./parse-request";
import { getServiceClient } from "./supabase/server";
import {
  emitEvent,
  getContext,
  getWorkflow,
  mergeContext,
  updateWorkflow,
} from "./store";
import { money } from "./format";
import type { AgentName, SharedContext, TravelRequest } from "./types";

// =============================================================================
// Orchestrator — a TRUE multi-agent control plane.
//
//   ┌─ Flight ─┐
//   ├─ Hotel  ─┤
//   ├─ Activity┤  RESEARCH PHASE — all six planning agents run CONCURRENTLY
//   ├─ Weather ┤  (Promise.all, one parallel_group). Each autonomously finds
//   ├─ Transport  and recommends its best option; results land in shared context.
//   └─ Insights┘
//        │
//        ▼
//     Budget Agent  — combines the plan and computes the total cost
//        │
//        ▼  (if over budget) A2A NEGOTIATION — Budget ⇄ Flight/Hotel/Activity/Transport
//        │  collaboratively optimize via direct messages, up to 3 rounds
//        ▼
//   AWAITING APPROVAL — the optimized plan + reasoning is presented to the human,
//        who can: approve · reject · modify budget · change preferences (prompt).
//        │  (changing preferences re-runs ONLY the affected agents)
//        ▼  approve
//     Itinerary Agent ─▶ completed
//
// The ONLY pauses are the single approval gate and an input-recovery pause when
// flight/hotel have no live availability for the chosen dates.
// =============================================================================

const ALL_PLANNING: AgentName[] = [
  "flight",
  "hotel",
  "activity",
  "weather",
  "transport",
  "insights",
];

const AGENT_LABEL: Record<AgentName, string> = {
  flight: "Flight Agent",
  hotel: "Hotel Agent",
  activity: "Activity Agent",
  weather: "Weather Agent",
  transport: "Transport Agent",
  insights: "Insights Agent",
  budget: "Budget Agent",
  approval: "Approval Agent",
  itinerary: "Itinerary Agent",
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A "recoverable" failure is a date/availability problem the operator can fix. */
function isRecoverable(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("not configured")) return false;
  return (
    m.includes("no flights") ||
    m.includes("no available") ||
    m.includes("no hotels") ||
    m.includes("none had a bookable") ||
    m.includes("returned")
  );
}

// ---------------------------------------------------------------------------
// Pause / gate helpers
// ---------------------------------------------------------------------------

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
  await updateWorkflow(workflowId, { status: "awaiting_input", current_agent: step });
  await emitEvent(workflowId, "input_required", {
    agent: step,
    message,
    payload: { step },
  });
}

/** Present the optimized plan and open the single human approval gate. */
async function requestApproval(
  workflowId: string,
  ctx: SharedContext
): Promise<void> {
  const db = getServiceClient();
  const budget = ctx.budget;
  const overBudget = budget && !budget.withinBudget;
  const neg = ctx.negotiation;

  let reason = "The agents have planned and optimized your trip. Review the plan.";
  if (neg?.triggered) reason = neg.summary;
  else if (overBudget && budget)
    reason = `Plan ready — total ${money(budget.totalCost, budget.currency)}, over budget by ${money(budget.overage, budget.currency)}.`;
  else if (budget)
    reason = `Plan ready and within budget — total ${money(budget.totalCost, budget.currency)} of ${money(budget.budget, budget.currency)}.`;

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

  // Itinerary is the next agent to run once the human approves.
  await updateWorkflow(workflowId, {
    status: "awaiting_approval",
    current_agent: "itinerary",
  });
  await emitEvent(workflowId, "approval_required", {
    agent: "approval",
    message: reason,
    payload: {
      approvalId: data.id,
      budget: budget?.budget,
      totalCost: budget?.totalCost,
      overage: budget?.overage,
      withinBudget: budget?.withinBudget,
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
  await updateWorkflow(workflowId, { status: "failed", current_agent: null, error: msg });
  await emitEvent(workflowId, "workflow_failed", {
    message: `Workflow failed: ${msg}`,
    payload: { error: msg },
  });
}

// ---------------------------------------------------------------------------
// Research phase: fan out the requested planning agents CONCURRENTLY. Flight &
// Hotel use live data and may pause for date-recovery; Activity, Transport,
// Weather and Insights are auxiliary and degrade gracefully (never fail the run).
// ---------------------------------------------------------------------------
type WrapResult = { ok: true } | { ok: false; err: unknown };

async function runResearchPhase(
  workflowId: string,
  req: TravelRequest,
  agents: AgentName[]
): Promise<{ paused: boolean }> {
  const group = `research-${Date.now()}`;
  await updateWorkflow(workflowId, { status: "running", current_agent: agents[0] ?? "flight" });
  await emitEvent(workflowId, "parallel_started", {
    message: `Research phase: ${agents.join(", ")} dispatched in parallel`,
    payload: { parallelGroup: group, agents },
  });

  const wrap = (p: Promise<unknown>): Promise<WrapResult> =>
    p.then(() => ({ ok: true as const }), (err) => ({ ok: false as const, err }));

  const jobs: Promise<unknown>[] = [];
  let flightJob: Promise<WrapResult> | null = null;
  let hotelJob: Promise<WrapResult> | null = null;

  if (agents.includes("flight")) {
    flightJob = wrap(runFlightAgent(workflowId, req, group));
    jobs.push(flightJob);
  }
  if (agents.includes("hotel")) {
    hotelJob = wrap(runHotelAgent(workflowId, req, group));
    jobs.push(hotelJob);
  }
  if (agents.includes("activity")) jobs.push(runActivityAgent(workflowId, req, group));
  if (agents.includes("transport")) jobs.push(runTransportAgent(workflowId, req, group));
  if (agents.includes("weather")) jobs.push(runWeatherAgent(workflowId, req, group));
  if (agents.includes("insights")) jobs.push(runInsightsAgent(workflowId, req, group));

  await Promise.all(jobs);

  if (flightJob) {
    const r = await flightJob;
    if (!r.ok) {
      const msg = errMsg(r.err);
      if (isRecoverable(msg)) {
        await requestInput(workflowId, "flight", msg);
        return { paused: true };
      }
      throw r.err;
    }
  }
  if (hotelJob) {
    const r = await hotelJob;
    if (!r.ok) {
      const msg = errMsg(r.err);
      if (isRecoverable(msg)) {
        await requestInput(workflowId, "hotel", msg);
        return { paused: true };
      }
      throw r.err;
    }
  }

  await emitEvent(workflowId, "parallel_completed", {
    message: "Research phase complete — all agent recommendations are in",
    payload: { parallelGroup: group },
  });
  return { paused: false };
}

/**
 * Combine the agent results with the Budget Agent, run an A2A negotiation if
 * over budget, then open the approval gate with the optimized plan.
 */
async function runPlanningToApproval(
  workflowId: string,
  req: TravelRequest
): Promise<void> {
  let ctx = await getContext(workflowId);
  await runBudgetAgent(workflowId, req, ctx);
  ctx = await getContext(workflowId);
  if (ctx.budget && !ctx.budget.withinBudget) {
    ctx = await runBudgetNegotiation(workflowId, req, ctx);
  }
  await requestApproval(workflowId, ctx);
}

// ---------------------------------------------------------------------------
// Pipeline entrypoints
// ---------------------------------------------------------------------------

/** Start the pipeline: parallel research → budget → negotiation → approval. */
export async function runWorkflow(workflowId: string): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    const { paused } = await runResearchPhase(workflowId, wf.request, ALL_PLANNING);
    if (paused) return;
    await runPlanningToApproval(workflowId, wf.request);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/** Apply corrected input (new trip dates) and re-run the full research phase. */
export async function provideInput(
  workflowId: string,
  input: { departDate: string; returnDate: string }
): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");

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
      { agent: "flight", message: `Trip dates updated to ${depart} → ${ret}` }
    );
    await emitEvent(workflowId, "input_received", {
      agent: "flight",
      message: `Dates updated: ${depart} → ${ret}`,
      payload: { departDate: depart, returnDate: ret, days },
    });

    const { paused } = await runResearchPhase(workflowId, newReq, ALL_PLANNING);
    if (paused) return;
    await runPlanningToApproval(workflowId, newReq);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/**
 * Manual override: the operator picks a specific flight or hotel option from
 * the agent's list. We set it as the selection, then recompute the budget and
 * re-run negotiation so the plan (and approval gate) reflect their choice.
 */
export async function overrideSelection(
  workflowId: string,
  kind: "flight" | "hotel",
  optionId: string
): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    const ctx = await getContext(workflowId);
    await updateWorkflow(workflowId, { status: "running" });

    if (kind === "flight") {
      const chosen = ctx.flight?.options.find((o) => o.id === optionId);
      if (!chosen) throw new Error("Selected flight option not found");
      await mergeContext(
        workflowId,
        { flight: { selected: chosen, options: ctx.flight?.options ?? [] } },
        {
          agent: "flight",
          message: `Operator manually selected ${chosen.airline} (${money(chosen.totalPrice, chosen.currency)})`,
        }
      );
      await emitEvent(workflowId, "selection_received", {
        agent: "flight",
        message: `Flight manually selected: ${chosen.airline}`,
        payload: { optionId: chosen.id },
      });
    } else {
      const chosen = ctx.hotel?.options.find((o) => o.id === optionId);
      if (!chosen) throw new Error("Selected hotel option not found");
      await mergeContext(
        workflowId,
        { hotel: { selected: chosen, options: ctx.hotel?.options ?? [] } },
        {
          agent: "hotel",
          message: `Operator manually selected ${chosen.name} (${money(chosen.totalPrice, chosen.currency)})`,
        }
      );
      await emitEvent(workflowId, "selection_received", {
        agent: "hotel",
        message: `Hotel manually selected: ${chosen.name}`,
        payload: { optionId: chosen.id },
      });
    }

    await runPlanningToApproval(workflowId, wf.request);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/**
 * Determine which planning agents are affected by a change in the request, so
 * that "change preferences" only re-runs what actually changed.
 */
function affectedAgents(
  oldReq: TravelRequest,
  newReq: TravelRequest
): AgentName[] {
  const set = new Set<AgentName>();
  const destChanged =
    oldReq.destinationCode !== newReq.destinationCode ||
    oldReq.destinationCity !== newReq.destinationCity ||
    oldReq.destinationCountry !== newReq.destinationCountry;
  const datesChanged =
    oldReq.departDate !== newReq.departDate ||
    oldReq.returnDate !== newReq.returnDate ||
    oldReq.days !== newReq.days;
  const originChanged = oldReq.originCode !== newReq.originCode;
  const travelersChanged = oldReq.travelers !== newReq.travelers;
  const prefsChanged =
    JSON.stringify([...oldReq.preferences].sort()) !==
    JSON.stringify([...newReq.preferences].sort());
  const airlineChanged = (oldReq.preferredAirline ?? "") !== (newReq.preferredAirline ?? "");

  if (destChanged || datesChanged) {
    ALL_PLANNING.forEach((a) => set.add(a));
  }
  if (originChanged) set.add("flight");
  if (airlineChanged) set.add("flight");
  if (travelersChanged) {
    ["flight", "hotel", "activity", "transport"].forEach((a) => set.add(a as AgentName));
  }
  if (prefsChanged) {
    // Preferences (luxury/budget/airline/interests) influence what the Flight,
    // Hotel, Activity and Insights agents recommend — re-run all four.
    ["flight", "hotel", "activity", "insights"].forEach((a) => set.add(a as AgentName));
  }
  // budget-only changes affect no planning agent — just a budget recompute.
  return [...set];
}

/**
 * Apply a free-text preference change. Re-parses the request, re-runs ONLY the
 * affected agents in parallel, then recomputes/negotiates and re-gates approval.
 */
export async function changePreferences(
  workflowId: string,
  prompt: string
): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");
    const oldReq = wf.request;
    const newReq = await parsePreferenceChange(oldReq, prompt);
    const affected = affectedAgents(oldReq, newReq);

    await updateWorkflow(workflowId, {
      request: newReq,
      budget: newReq.budget,
      status: "running",
      current_agent: affected[0] ?? "budget",
    });
    await mergeContext(
      workflowId,
      { request: newReq },
      {
        agent: "budget",
        message: `Preferences updated — re-running ${
          affected.length ? affected.join(", ") : "budget only"
        }`,
      }
    );
    await emitEvent(workflowId, "input_received", {
      agent: "budget",
      message: `Preference change applied: "${prompt}"`,
      payload: { affected, prompt },
    });

    if (affected.length) {
      const { paused } = await runResearchPhase(workflowId, newReq, affected);
      if (paused) return;
    }
    await runPlanningToApproval(workflowId, newReq);
  } catch (err) {
    await fail(workflowId, err);
  }
}

/**
 * Resume after an approval decision.
 *  - approve       -> run the Itinerary Agent and finish
 *  - update_budget -> recompute against the new budget, re-negotiate, re-gate
 */
export async function resumeWorkflow(
  workflowId: string,
  opts: { newBudget?: number } = {}
): Promise<void> {
  try {
    const wf = await getWorkflow(workflowId);
    if (!wf) throw new Error("Workflow not found");

    // --- Modify budget: recompute + re-negotiate, then re-open the gate. ---
    if (opts.newBudget && opts.newBudget > 0) {
      const newReq: TravelRequest = { ...wf.request, budget: opts.newBudget };
      await updateWorkflow(workflowId, { request: newReq, budget: opts.newBudget });
      await mergeContext(
        workflowId,
        {
          request: newReq,
          approval: { required: true, resolution: "update_budget", newBudget: opts.newBudget },
        },
        { agent: "approval", message: `Budget updated to ${money(opts.newBudget, newReq.currency)}` }
      );
      await runPlanningToApproval(workflowId, newReq);
      return;
    }

    // --- Approve: generate the itinerary and complete. ---------------------
    await updateWorkflow(workflowId, { status: "running", current_agent: "itinerary" });
    await mergeContext(
      workflowId,
      { approval: { required: false, resolution: "approve" } },
      { agent: "approval", message: "Plan approved — generating itinerary" }
    );
    const ctx = await getContext(workflowId);
    await runItineraryAgent(workflowId, wf.request, ctx);
    await finalize(workflowId);
  } catch (err) {
    await fail(workflowId, err);
  }
}
