"use client";

import {
  LayoutDashboard,
  Plane,
  Building,
  Ticket,
  CloudSun,
  Bus,
  Compass,
  Calculator,
  ShieldCheck,
  Map,
} from "lucide-react";
import type { AgentName, AgentRunRow, WorkflowRow } from "@/lib/types";

const AGENT_NAV: { icon: React.ElementType; label: string; agent: AgentName }[] = [
  { icon: Plane, label: "Flight Agent", agent: "flight" },
  { icon: Building, label: "Hotel Agent", agent: "hotel" },
  { icon: Ticket, label: "Activity Agent", agent: "activity" },
  { icon: CloudSun, label: "Weather Agent", agent: "weather" },
  { icon: Bus, label: "Transport Agent", agent: "transport" },
  { icon: Compass, label: "Insights Agent", agent: "insights" },
  { icon: Calculator, label: "Budget Agent", agent: "budget" },
  { icon: ShieldCheck, label: "Approval Agent", agent: "approval" },
  { icon: Map, label: "Itinerary Agent", agent: "itinerary" },
];

function dotColor(
  agent: AgentName,
  runs: AgentRunRow[],
  workflow: WorkflowRow | null
): string | null {
  if (agent === "approval") {
    return workflow?.status === "awaiting_approval" ? "var(--status-waiting)" : null;
  }
  const run = [...runs].reverse().find((r) => r.agent === agent);
  if (!run) return null;
  if (run.status === "completed") return "var(--accent-green)";
  if (run.status === "failed") return "var(--accent-coral)";
  if (run.status === "running") return "var(--accent-coral)";
  return null;
}

export function Sidebar({
  workflow,
  agentRuns,
}: {
  workflow: WorkflowRow | null;
  agentRuns: AgentRunRow[];
}) {
  const approvalBadge = workflow?.status === "awaiting_approval" ? "1" : null;

  return (
    <aside
      className="app-sidebar fixed flex flex-col"
      style={{
        width: "260px",
        top: "60px",
        bottom: 0,
        left: 0,
        background: "var(--bg-primary)",
        borderRight: "1px solid var(--border-card)",
        zIndex: 40,
        padding: "16px",
      }}
    >
      <nav className="flex flex-col gap-1">
        <NavButton icon={LayoutDashboard} label="Control Plane" active />
        {AGENT_NAV.map((item) => (
          <NavButton
            key={item.label}
            icon={item.icon}
            label={item.label}
            dot={dotColor(item.agent, agentRuns, workflow)}
            badge={item.agent === "approval" ? approvalBadge : null}
          />
        ))}
      </nav>

      <div
        className="mt-auto pt-4"
        style={{ borderTop: "1px solid var(--border-divider)" }}
      >
        <span
          className="font-mono-geist block"
          style={{ fontSize: "11px", color: "var(--text-muted)" }}
        >
          System Version
        </span>
        <span
          className="font-mono-geist mt-1 block"
          style={{ fontSize: "11px", color: "var(--text-secondary)" }}
        >
          v2.4.1-stable
        </span>
      </div>
    </aside>
  );
}

function NavButton({
  icon: Icon,
  label,
  active = false,
  badge = null,
  dot = null,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string | null;
  dot?: string | null;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 text-left transition-all duration-200"
      style={{
        height: "44px",
        borderRadius: "8px",
        padding: "0 12px",
        background: active ? "var(--bg-elevated)" : "transparent",
        borderLeft: active
          ? "2px solid var(--accent-coral)"
          : "2px solid transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.background = "var(--bg-elevated)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <Icon size={16} />
      <span style={{ fontSize: "13px", fontWeight: 500 }}>{label}</span>
      {dot && !badge && (
        <span
          className="ml-auto inline-block rounded-full"
          style={{ width: "6px", height: "6px", background: dot }}
        />
      )}
      {badge && (
        <span
          className="font-mono-geist ml-auto flex items-center justify-center"
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            background: "var(--accent-coral)",
            color: "#fff",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
