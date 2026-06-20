"use client";

import type { AgentRunRow, SharedContext, WorkflowRow } from "@/lib/types";
import { money } from "@/lib/format";

const PIPELINE = [
  "flight",
  "hotel",
  "activity",
  "weather",
  "transport",
  "insights",
  "budget",
  "itinerary",
] as const;
const LABEL: Record<string, string> = {
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

export function TripSummary({
  workflow,
  context,
  agentRuns,
}: {
  workflow: WorkflowRow;
  context: SharedContext;
  agentRuns: AgentRunRow[];
}) {
  const req = workflow.request;
  const currency = req?.currency ?? "INR";

  const completed = new Set(
    agentRuns.filter((r) => r.status === "completed").map((r) => r.agent)
  );
  // 9 agents total: 6 planning agents (parallel) + budget + approval + itinerary.
  // The Approval Agent is a human gate (no run row); it counts as done once the
  // approval is resolved or the workflow has completed.
  let done = PIPELINE.filter((a) => completed.has(a)).length;
  const approvalResolved =
    workflow.status === "completed" ||
    (!!context.approval && context.approval.required === false);
  if (approvalResolved) done += 1;
  const total = 9;
  const pct = Math.round((done / total) * 100);

  let stageLabel = "Workflow complete";
  if (workflow.status === "awaiting_input" && workflow.current_agent) {
    stageLabel = `Action needed — adjust dates for ${
      LABEL[workflow.current_agent] ?? "search"
    }`;
  } else if (workflow.status === "awaiting_approval") {
    stageLabel = "Optimized plan ready — awaiting your decision";
  } else if (workflow.status === "running" && workflow.current_agent) {
    stageLabel = `Agents working — ${LABEL[workflow.current_agent] ?? "planning"}…`;
  } else if (workflow.status === "pending" || workflow.status === "running") {
    stageLabel = "Dispatching planning agents in parallel…";
  } else if (workflow.status === "failed") {
    stageLabel = "Workflow failed";
  } else if (workflow.status === "rejected") {
    stageLabel = "Workflow rejected";
  } else if (workflow.status === "completed") {
    stageLabel = "All agents completed";
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--border-card)",
        background:
          "linear-gradient(135deg, rgba(13,13,13,0.78), rgba(13,13,13,0.55)), url(/hero-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "32px",
        minHeight: "240px",
      }}
    >
      <div style={{ position: "relative", zIndex: 1 }}>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 500,
            color: "var(--text-primary)",
            lineHeight: 1.3,
            marginBottom: "12px",
          }}
        >
          Trip Planning Operation
        </h2>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              Destination: {req?.destination ?? "—"}
            </span>
            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              Duration: {req ? `${req.days} Days` : "—"} · Travelers:{" "}
              {req?.travelers ?? "—"}
            </span>
            <span
              className="font-mono-geist"
              style={{
                fontSize: "28px",
                color: "var(--accent-gold)",
                lineHeight: 1.1,
                marginTop: "4px",
              }}
            >
              {money(workflow.budget, currency)}
            </span>
          </div>

          <div style={{ minWidth: "240px", flex: "1 1 240px", maxWidth: "420px" }}>
            <div
              style={{
                height: "4px",
                background: "var(--border-card)",
                borderRadius: "2px",
                overflow: "hidden",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "var(--accent-coral)",
                  borderRadius: "2px",
                  boxShadow: "0 0 12px rgba(232, 93, 62, 0.4)",
                  transition: "width 0.6s ease-out",
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span
                className="font-mono-geist"
                style={{ fontSize: "11px", color: "var(--text-secondary)" }}
              >
                {stageLabel}
              </span>
              <span
                className="font-mono-geist"
                style={{ fontSize: "11px", color: "var(--text-muted)" }}
              >
                {done} / {total} tasks
              </span>
            </div>
          </div>
        </div>

        {workflow.error && (
          <p
            className="font-mono-geist"
            style={{
              marginTop: "16px",
              fontSize: "12px",
              color: "var(--accent-coral)",
            }}
          >
            {workflow.error}
          </p>
        )}
      </div>
    </div>
  );
}
