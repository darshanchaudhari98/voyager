import { generateItinerary } from "../providers/itinerary";
import {
  finishAgentRun,
  mergeContext,
  startAgentRun,
} from "../store";
import type { SharedContext, TravelRequest } from "../types";

/**
 * Itinerary Agent: uses OpenAI GPT to generate a detailed day-by-day plan,
 * reading flight, hotel, budget and preferences from the shared context.
 */
export async function runItineraryAgent(
  workflowId: string,
  req: TravelRequest,
  ctx: SharedContext
): Promise<SharedContext> {
  const runId = await startAgentRun(workflowId, "itinerary", {
    days: req.days,
    preferences: req.preferences,
  });

  try {
    const itinerary = await generateItinerary(req, ctx);

    const next = await mergeContext(
      workflowId,
      { itinerary },
      {
        agent: "itinerary",
        message: `Generated ${itinerary.days.length}-day itinerary (via ${itinerary.generatedBy})`,
      }
    );

    await finishAgentRun(workflowId, runId, "itinerary", "completed", {
      days: itinerary.days.length,
      generatedBy: itinerary.generatedBy,
    });
    return next;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishAgentRun(workflowId, runId, "itinerary", "failed", null, msg);
    throw err;
  }
}
