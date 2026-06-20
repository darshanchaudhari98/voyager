import { generateInsights } from "../providers/insights";
import { finishAgentRun, mergeContext, startAgentRun } from "../store";
import type { SharedContext, TravelRequest } from "../types";

/**
 * Insights Agent: produces destination insights (best areas, getting around,
 * safety, seasonal notes, must-try) via the LLM. It depends only on the trip
 * request — not on flight or hotel results — so the orchestrator runs it
 * CONCURRENTLY with the Flight and Hotel agents in the research phase.
 *
 * `setCurrent: false` keeps it from fighting the other parallel agents over
 * the workflow's `current_agent` pointer.
 */
export async function runInsightsAgent(
  workflowId: string,
  req: TravelRequest,
  parallelGroup: string
): Promise<SharedContext | null> {
  const runId = await startAgentRun(
    workflowId,
    "insights",
    { destination: req.destination, days: req.days },
    { parallelGroup, setCurrent: false }
  );

  try {
    const insights = await generateInsights(req);
    const ctx = await mergeContext(
      workflowId,
      { insights },
      {
        agent: "insights",
        message: `Destination insights ready for ${req.destination} (${insights.bestAreas.length} areas)`,
      }
    );
    await finishAgentRun(workflowId, runId, "insights", "completed", {
      areas: insights.bestAreas.length,
      generatedBy: insights.generatedBy,
    });
    return ctx;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Insights are auxiliary — degrade gracefully instead of failing the run.
    await finishAgentRun(workflowId, runId, "insights", "skipped", null, msg);
    return null;
  }
}
