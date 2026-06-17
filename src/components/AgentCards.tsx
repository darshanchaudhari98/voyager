"use client";

import { Plane, Building, Calculator, ShieldCheck, Map } from "lucide-react";
import type {
  AgentName,
  AgentRunRow,
  SharedContext,
  WorkflowRow,
} from "@/lib/types";
import { money } from "@/lib/format";

type CardStatus = "running" | "completed" | "waiting" | "idle" | "failed";

const statusConfig: Record<
  CardStatus,
  { label: string; color: string; bg: string }
> = {
  running: { label: "RUNNING", color: "var(--accent-coral)", bg: "rgba(232, 93, 62, 0.12)" },
  completed: { label: "COMPLETED", color: "var(--accent-green)", bg: "rgba(77, 181, 110, 0.12)" },
  waiting: { label: "WAITING", color: "var(--status-waiting)", bg: "rgba(245, 158, 11, 0.12)" },
  idle: { label: "IDLE", color: "var(--accent-blue)", bg: "rgba(96, 165, 250, 0.12)" },
  failed: { label: "FAILED", color: "var(--accent-coral)", bg: "rgba(232, 93, 62, 0.12)" },
};

const PROGRESS: Record<CardStatus, number> = {
  idle: 0,
  waiting: 45,
  running: 70,
  failed: 100,
  completed: 100,
};

interface Metric {
  label: string;
  value: string;
  highlight?: boolean;
}

function agentStatus(
  agent: AgentName,
  runs: AgentRunRow[],
  workflow: WorkflowRow | null,
  context: SharedContext
): CardStatus {
  const awaitingApproval = workflow?.status === "awaiting_approval";
  const awaitingSelection = workflow?.status === "awaiting_selection";
  const awaitingReview = workflow?.status === "awaiting_budget_review";

  if (agent === "approval") {
    if (awaitingApproval) return "waiting";
    if (workflow?.status === "completed") return "completed";
    return "idle";
  }

  if (
    (awaitingApproval || awaitingSelection || awaitingReview) &&
    workflow?.current_agent === agent
  ) {
    // If a selection is pending but the live options haven't arrived yet,
    // the agent is still fetching — keep it RUNNING until the data lands.
    if (awaitingSelection) {
      const loaded =
        agent === "flight"
          ? (context.flight?.options?.length ?? 0) > 0
          : agent === "hotel"
          ? (context.hotel?.options?.length ?? 0) > 0
          : true;
      if (!loaded) return "running";
    }
    return "waiting";
  }

  // While the orchestrator is actively on this agent, keep showing RUNNING.
  // This avoids a brief "COMPLETED" flash between an agent finishing its run
  // and the workflow transitioning into the selection/review pause.
  if (workflow?.status === "running" && workflow?.current_agent === agent) {
    return "running";
  }

  const run = [...runs].reverse().find((r) => r.agent === agent);
  if (!run) return "idle";
  if (run.status === "completed") return "completed";
  if (run.status === "failed") return "failed";
  if (run.status === "running") return "running";
  return "idle";
}

function metricsFor(
  agent: AgentName,
  ctx: SharedContext,
  workflow: WorkflowRow | null
): Metric[] {
  const cur = ctx.request?.currency ?? workflow?.request?.currency ?? "INR";
  switch (agent) {
    case "flight": {
      const f = ctx.flight;
      return [
        { label: "Options Found", value: f ? String(f.options.length) : "—" },
        {
          label: "Selected",
          value: f ? money(f.selected.totalPrice, cur) : "—",
          highlight: true,
        },
      ];
    }
    case "hotel": {
      const h = ctx.hotel;
      return [
        { label: "Properties", value: h ? String(h.options.length) : "—" },
        {
          label: "Per Night",
          value: h ? money(h.selected.pricePerNight, cur) : "—",
          highlight: true,
        },
      ];
    }
    case "budget": {
      const b = ctx.budget;
      return [
        { label: "Total", value: b ? money(b.totalCost, cur) : "—" },
        {
          label: b && !b.withinBudget ? "Over By" : "Status",
          value: b
            ? b.withinBudget
              ? "Within"
              : money(b.overage, cur)
            : "—",
          highlight: !!b && !b.withinBudget,
        },
      ];
    }
    case "approval": {
      const awaiting = workflow?.status === "awaiting_approval";
      const stepLabel: Record<string, string> = {
        flight: "Flight",
        hotel: "Hotel",
        budget: "Budget",
        itinerary: "Itinerary",
      };
      return [
        { label: "Pending", value: awaiting ? "1" : "0" },
        {
          label: "Gating",
          value:
            awaiting && workflow?.current_agent
              ? stepLabel[workflow.current_agent] ?? "—"
              : "—",
        },
      ];
    }
    case "itinerary": {
      const it = ctx.itinerary;
      return [
        { label: "Days", value: it ? String(it.days.length) : "—" },
        { label: "Status", value: it ? "Generated" : "Awaiting" },
      ];
    }
    default:
      return [];
  }
}

const AGENTS: { agent: AgentName; name: string; icon: React.ElementType }[] = [
  { agent: "flight", name: "Flight Agent", icon: Plane },
  { agent: "hotel", name: "Hotel Agent", icon: Building },
  { agent: "budget", name: "Budget Agent", icon: Calculator },
  { agent: "approval", name: "Approval Agent", icon: ShieldCheck },
  { agent: "itinerary", name: "Itinerary Agent", icon: Map },
];

export function AgentCards({
  workflow,
  agentRuns,
  context,
}: {
  workflow: WorkflowRow | null;
  agentRuns: AgentRunRow[];
  context: SharedContext;
}) {
  return (
    <div
      className="agent-cards-grid grid gap-4"
      style={{ marginTop: "32px", gridTemplateColumns: "repeat(5, 1fr)" }}
    >
      {AGENTS.map(({ agent, name, icon: Icon }) => {
        const st = agentStatus(agent, agentRuns, workflow, context);
        const status = statusConfig[st];
        const metrics = metricsFor(agent, context, workflow);

        return (
          <div
            key={agent}
            className="fade-in"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "12px",
              padding: "24px",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)";
              e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = "1px solid var(--border-card)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={20} style={{ color: status.color }} />
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {name}
                </span>
              </div>
              <span
                className="font-mono-geist"
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: status.color,
                  background: status.bg,
                  borderRadius: "4px",
                  padding: "2px 8px",
                }}
              >
                {status.label}
              </span>
            </div>

            <div
              style={{
                height: "1px",
                background: "var(--border-divider)",
                margin: "12px 0",
              }}
            />

            <div
              style={{
                height: "3px",
                background: "var(--border-card)",
                borderRadius: "2px",
                marginBottom: "12px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${PROGRESS[st]}%`,
                  background: status.color,
                  borderRadius: "2px",
                  transition: "width 0.8s ease-out",
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              {metrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span
                    className="font-mono-geist"
                    style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                  >
                    {m.label}
                  </span>
                  <span
                    className="font-mono-geist"
                    style={{
                      fontSize: "11px",
                      color: m.highlight
                        ? "var(--accent-gold)"
                        : "var(--text-primary)",
                    }}
                  >
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
