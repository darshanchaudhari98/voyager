import { generateWeather } from "../providers/weather";
import { finishAgentRun, mergeContext, startAgentRun } from "../store";
import type { SharedContext, TravelRequest } from "../types";

/**
 * Weather Agent: produces a seasonal weather outlook + packing guidance for the
 * destination and dates. Informational (no cost), independent of flight/hotel,
 * so it runs CONCURRENTLY in the research phase. Auxiliary — it degrades
 * gracefully and never fails the workflow.
 */
export async function runWeatherAgent(
  workflowId: string,
  req: TravelRequest,
  parallelGroup: string
): Promise<SharedContext | null> {
  const runId = await startAgentRun(
    workflowId,
    "weather",
    { destination: req.destination, dates: `${req.departDate}..${req.returnDate}` },
    { parallelGroup, setCurrent: false }
  );

  try {
    const weather = await generateWeather(req);
    const ctx = await mergeContext(
      workflowId,
      { weather },
      {
        agent: "weather",
        message: `Weather outlook ready — ${weather.season}, ${weather.tempRange}`,
      }
    );
    await finishAgentRun(workflowId, runId, "weather", "completed", {
      season: weather.season,
      tempRange: weather.tempRange,
    });
    return ctx;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishAgentRun(workflowId, runId, "weather", "skipped", null, msg);
    return null;
  }
}
