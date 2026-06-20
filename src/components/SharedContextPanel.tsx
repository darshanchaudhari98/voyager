"use client";

import { useState } from "react";
import {
  MapPin,
  Plane,
  Building,
  Calculator,
  ShieldCheck,
  ChevronDown,
  Copy,
  Check,
  Database,
  Star,
  Compass,
  Handshake,
  Ticket,
  Bus,
  CloudSun,
} from "lucide-react";
import type { AgentRunRow, SharedContext, WorkflowStatus } from "@/lib/types";
import { money } from "@/lib/format";

type Highlight = "coral" | "gold" | "green" | "waiting" | undefined;

const highlightColors: Record<string, string> = {
  coral: "var(--accent-coral)",
  gold: "var(--accent-gold)",
  green: "var(--accent-green)",
  waiting: "var(--status-waiting)",
};

interface Row {
  label: string;
  value: string;
  highlight?: Highlight;
}

interface Section {
  key: string;
  title: string;
  icon: React.ElementType;
  color: string;
  summary: string;
  rows: Row[];
}

function buildSections(ctx: SharedContext): Section[] {
  const cur = ctx.request?.currency ?? "INR";
  const sections: Section[] = [];

  if (ctx.request) {
    const r = ctx.request;
    sections.push({
      key: "request",
      title: "Trip Request",
      icon: MapPin,
      color: "var(--accent-blue)",
      summary: r.destination,
      rows: [
        { label: "destination", value: r.destination },
        { label: "route", value: `${r.originCode} → ${r.destinationCode}` },
        { label: "dates", value: `${r.departDate} → ${r.returnDate}` },
        { label: "travelers", value: String(r.travelers) },
        { label: "duration", value: `${r.days} days` },
        { label: "budget_limit", value: money(r.budget, cur), highlight: "gold" },
        {
          label: "preferences",
          value: r.preferences.length ? r.preferences.join(", ") : "general",
        },
        ...(r.preferredAirline
          ? [{ label: "preferred_airline", value: r.preferredAirline, highlight: "coral" as Highlight }]
          : []),
      ],
    });
  }

  if (ctx.flight) {
    const f = ctx.flight.selected;
    sections.push({
      key: "flight",
      title: "Flight",
      icon: Plane,
      color: "var(--accent-coral)",
      summary: f.airline,
      rows: [
        { label: "airline", value: f.airline },
        { label: "route", value: `${f.from} → ${f.to}` },
        { label: "stops", value: f.stops === 0 ? "Non-stop" : `${f.stops}` },
        { label: "duration", value: f.durationHours ? `${f.durationHours}h` : "—" },
        { label: "baggage", value: f.baggageIncluded ? "Included" : "Not included" },
        { label: "options", value: `${ctx.flight.options.length} found` },
        { label: "total", value: money(f.totalPrice, cur), highlight: "gold" },
      ],
    });
  }

  if (ctx.hotel) {
    const h = ctx.hotel.selected;
    sections.push({
      key: "hotel",
      title: "Hotel",
      icon: Building,
      color: "var(--accent-gold)",
      summary: h.name,
      rows: [
        { label: "name", value: h.name },
        { label: "rating", value: `${h.rating}★${h.reviewCount ? ` (${h.reviewCount})` : ""}` },
        { label: "area", value: h.area },
        { label: "board", value: h.board ?? "Room only" },
        { label: "per_night", value: money(h.pricePerNight, cur) },
        { label: "nights", value: String(h.nights) },
        { label: "total", value: money(h.totalPrice, cur), highlight: "gold" },
      ],
    });
  }

  if (ctx.budget) {
    const b = ctx.budget;
    sections.push({
      key: "budget",
      title: "Budget",
      icon: Calculator,
      color: "var(--accent-green)",
      summary: `${money(b.totalCost, cur)} ${b.withinBudget ? "✓" : "⚠"}`,
      rows: [
        { label: "flight_cost", value: money(b.flightCost, cur) },
        { label: "hotel_cost", value: money(b.hotelCost, cur) },
        { label: "activity_cost", value: money(b.activityCost, cur) },
        { label: "transport_cost", value: money(b.transportCost, cur) },
        { label: "misc_cost", value: money(b.miscCost, cur) },
        { label: "budget", value: money(b.budget, cur), highlight: "gold" },
        {
          label: "total_cost",
          value: money(b.totalCost, cur),
          highlight: b.withinBudget ? "green" : "coral",
        },
        {
          label: "status",
          value: b.withinBudget ? "within budget" : `over by ${money(b.overage, cur)}`,
          highlight: b.withinBudget ? "green" : "coral",
        },
      ],
    });
  }

  if (ctx.activity) {
    const a = ctx.activity;
    sections.push({
      key: "activity",
      title: "Activities",
      icon: Ticket,
      color: "var(--accent-coral)",
      summary: `${a.items.length} · ${money(a.totalCost, cur)}`,
      rows: [
        ...a.items.map((it) => ({
          label: it.optional ? `${it.name} (opt)` : it.name,
          value: money(it.cost, cur),
        })),
        { label: "total", value: money(a.totalCost, cur), highlight: "gold" as Highlight },
        ...(a.droppedCount
          ? [{ label: "dropped", value: `${a.droppedCount} optional`, highlight: "coral" as Highlight }]
          : []),
      ],
    });
  }

  if (ctx.transport) {
    const t = ctx.transport.selected;
    sections.push({
      key: "transport",
      title: "Transport",
      icon: Bus,
      color: "var(--accent-green)",
      summary: t.mode,
      rows: [
        { label: "mode", value: t.mode },
        { label: "details", value: t.description || "—" },
        { label: "options", value: `${ctx.transport.options.length} found` },
        { label: "cost", value: money(t.cost, cur), highlight: "gold" },
      ],
    });
  }

  if (ctx.weather) {
    const w = ctx.weather;
    sections.push({
      key: "weather",
      title: "Weather",
      icon: CloudSun,
      color: "var(--status-waiting)",
      summary: `${w.season} · ${w.tempRange}`,
      rows: [
        { label: "season", value: w.season || "—" },
        { label: "temp_range", value: w.tempRange || "—" },
        { label: "conditions", value: w.conditions || "—" },
        { label: "packing", value: w.packing.join(", ") || "—" },
      ],
    });
  }

  if (ctx.insights) {
    const i = ctx.insights;
    sections.push({
      key: "insights",
      title: "Insights",
      icon: Compass,
      color: "var(--accent-blue)",
      summary: `${i.bestAreas.length} areas`,
      rows: [
        { label: "best_areas", value: i.bestAreas.join(", ") || "—" },
        { label: "getting_around", value: i.gettingAround || "—" },
        { label: "safety", value: i.safety || "—" },
        { label: "season", value: i.seasonalNote || "—" },
        { label: "must_try", value: i.mustTry.join(", ") || "—" },
      ],
    });
  }

  if (ctx.negotiation?.triggered) {
    const n = ctx.negotiation;
    sections.push({
      key: "negotiation",
      title: "Negotiation (A2A)",
      icon: Handshake,
      color: "var(--accent-coral)",
      summary: n.savings > 0 ? `saved ${money(n.savings, cur)}` : "no change",
      rows: [
        { label: "rounds", value: String(n.rounds) },
        {
          label: "swapped",
          value: n.applied.length ? n.applied.join(", ") : "none",
        },
        {
          label: "savings",
          value: money(n.savings, cur),
          highlight: n.savings > 0 ? "green" : undefined,
        },
        { label: "summary", value: n.summary },
      ],
    });
  }

  if (ctx.approval) {
    sections.push({
      key: "approval",
      title: "Approval",
      icon: ShieldCheck,
      color: "var(--status-waiting)",
      summary: ctx.approval.required ? "pending" : ctx.approval.resolution ?? "—",
      rows: [
        {
          label: "status",
          value: ctx.approval.required ? "pending" : "resolved",
          highlight: ctx.approval.required ? "waiting" : "green",
        },
        { label: "resolution", value: ctx.approval.resolution ?? "—" },
        ...(ctx.approval.newBudget
          ? [{ label: "new_budget", value: money(ctx.approval.newBudget, cur) }]
          : []),
      ],
    });
  }

  return sections;
}

// The nine agents whose output populates the shared context.
const AGENT_KEYS = [
  "flight",
  "hotel",
  "activity",
  "weather",
  "transport",
  "insights",
  "budget",
  "approval",
  "itinerary",
];
const TOTAL_STAGES = AGENT_KEYS.length; // 9

export function SharedContextPanel({
  context,
  agentRuns = [],
  workflowStatus,
}: {
  context: SharedContext;
  agentRuns?: AgentRunRow[];
  workflowStatus?: WorkflowStatus;
}) {
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const sections = buildSections(context);
  const synced = sections.length > 0;

  // All sections expanded by default.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(context, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  // An agent counts as "done" if it left data in the shared context OR it has
  // a finished run. Approval is a human gate (no run), so it's done once the
  // approval has been resolved or the whole workflow has completed.
  const ranAgents = new Set(
    agentRuns
      .filter((r) => r.status === "completed" || r.status === "skipped")
      .map((r) => r.agent)
  );
  const completed = workflowStatus === "completed";
  const filled = AGENT_KEYS.filter((k) => {
    if (k === "approval") {
      return completed || context.approval != null || workflowStatus === "awaiting_approval";
    }
    return context[k] != null || ranAgents.has(k as never) || completed;
  }).length;
  const pct = Math.round((filled / TOTAL_STAGES) * 100);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderRadius: "12px",
        padding: "24px",
        height: "600px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <Database size={16} style={{ color: "var(--accent-green)" }} />
          <h2 style={{ fontSize: "20px", fontWeight: 500, color: "var(--text-primary)" }}>
            Shared Context
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn onClick={copyJson} title="Copy JSON">
            {copied ? (
              <Check size={13} style={{ color: "var(--accent-green)" }} />
            ) : (
              <Copy size={13} />
            )}
          </IconBtn>
          <button
            onClick={() => setRaw((r) => !r)}
            className="font-mono-geist"
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-card)",
              borderRadius: "6px",
              padding: "4px 10px",
              cursor: "pointer",
              background: "transparent",
            }}
          >
            {raw ? "Structured" : "Raw JSON"}
          </button>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-full"
              style={{
                width: "6px",
                height: "6px",
                background: synced ? "var(--accent-green)" : "var(--text-muted)",
                boxShadow: synced ? "0 0 6px rgba(77, 181, 110, 0.6)" : "none",
                animation: synced ? "pulse 2.5s infinite" : "none",
              }}
            />
            <span
              className="font-mono-geist"
              style={{ fontSize: "11px", color: synced ? "var(--accent-green)" : "var(--text-muted)" }}
            >
              {synced ? "SYNCED" : "EMPTY"}
            </span>
          </div>
        </div>
      </div>

      {/* Fill meter */}
      {synced && !raw && (
        <div className="mb-4" style={{ flexShrink: 0 }}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono-geist" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              CONTEXT POPULATED
            </span>
            <span className="font-mono-geist" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {filled}/{TOTAL_STAGES} agents
            </span>
          </div>
          <div
            style={{
              height: "3px",
              background: "var(--border-card)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "linear-gradient(90deg, var(--accent-green), var(--accent-gold))",
                borderRadius: "2px",
                transition: "width 0.6s ease-out",
              }}
            />
          </div>
        </div>
      )}

      {/* Body */}
      {raw ? (
        <pre
          className="font-mono-geist"
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "rgba(0,0,0,0.4)",
            borderRadius: "8px",
            padding: "14px",
            fontSize: "12.5px",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            margin: 0,
          }}
        >
          {JSON.stringify(context, null, 2)}
        </pre>
      ) : !synced ? (
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Context is empty. Launch a workflow to populate it.
        </p>
      ) : (
        <div
          className="flex flex-col gap-2"
          style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingRight: "6px" }}
        >
          {sections.map((s) => {
            const isCollapsed = collapsed.has(s.key);
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                style={{
                  flexShrink: 0,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-card)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  transition: "border-color 0.2s ease",
                }}
              >
                {/* Section header */}
                <button
                  onClick={() => toggle(s.key)}
                  className="flex w-full items-center gap-2.5 text-left"
                  style={{ padding: "12px 14px", background: "transparent", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    className="flex flex-shrink-0 items-center justify-center"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      background: "var(--bg-card)",
                    }}
                  >
                    <Icon size={15} style={{ color: s.color }} />
                  </span>
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {s.title}
                  </span>
                  <span
                    className="font-mono-geist ml-auto"
                    style={{
                      fontSize: "12.5px",
                      color: "var(--text-secondary)",
                      maxWidth: "140px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.summary}
                  </span>
                  <ChevronDown
                    size={15}
                    style={{
                      color: "var(--text-muted)",
                      flexShrink: 0,
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>

                {/* Section rows */}
                {!isCollapsed && (
                  <div style={{ padding: "0 14px 12px 14px" }}>
                    <div
                      style={{
                        borderTop: "1px solid var(--border-divider)",
                        paddingTop: "10px",
                        display: "grid",
                        gridTemplateColumns: "minmax(96px, auto) 1fr",
                        gap: "9px 18px",
                      }}
                    >
                      {s.rows.map((row) => (
                        <div key={row.label} style={{ display: "contents" }}>
                          <span
                            className="font-mono-geist flex items-center gap-1.5"
                            style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.45 }}
                          >
                            {row.label === "rating" && (
                              <Star size={12} style={{ color: "var(--accent-gold)" }} />
                            )}
                            {row.label}
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              color: row.highlight
                                ? highlightColors[row.highlight]
                                : "var(--text-primary)",
                              textAlign: "right",
                              fontWeight: row.highlight ? 600 : 500,
                              wordBreak: "break-word",
                              lineHeight: 1.45,
                            }}
                          >
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center"
      style={{
        width: "26px",
        height: "26px",
        borderRadius: "6px",
        border: "1px solid var(--border-card)",
        background: "transparent",
        color: "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--text-primary)";
        e.currentTarget.style.borderColor = "var(--text-secondary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--text-secondary)";
        e.currentTarget.style.borderColor = "var(--border-card)";
      }}
    >
      {children}
    </button>
  );
}
