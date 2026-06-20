"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Plane,
  Building,
  Ticket,
  Bus,
  CloudSun,
  Coins,
  Handshake,
  Pencil,
  Wand2,
  MessageSquarePlus,
} from "lucide-react";
import type {
  ApprovalRow,
  CommandType,
  SharedContext,
  WorkflowRow,
} from "@/lib/types";
import { money } from "@/lib/format";

const PREF_EXAMPLES = [
  "Make it 7 days and add nightlife",
  "Raise the budget to ₹3,00,000",
  "Switch the destination to Bali",
  "Make it a luxury trip for 4 people",
];

export function ApprovalPanel({
  workflow,
  approvals,
  context,
  onCommand,
  onChangePreferences,
}: {
  workflow: WorkflowRow;
  approvals: ApprovalRow[];
  context: SharedContext;
  onCommand: (command: CommandType, newBudget?: number) => Promise<void>;
  onChangePreferences: (prompt: string) => Promise<void>;
}) {
  const pending = approvals.find((a) => a.status === "pending");
  const currency = workflow.request?.currency ?? "INR";
  const b = context.budget;
  const overBudget = !!b && !b.withinBudget;
  const neg = context.negotiation;

  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "budget" | "prefs">("none");
  const [newBudget, setNewBudget] = useState<number>(
    workflow.request?.budget ?? workflow.budget
  );
  const [prefsPrompt, setPrefsPrompt] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!pending) return null;

  async function run(cmd: CommandType, budgetArg?: number) {
    setBusy(cmd);
    try {
      await onCommand(cmd, budgetArg);
    } finally {
      setBusy(null);
    }
  }

  async function applyPrefs() {
    if (!prefsPrompt.trim()) return;
    setBusy("change_preferences");
    try {
      await onChangePreferences(prefsPrompt.trim());
    } finally {
      setBusy(null);
    }
  }

  const flight = context.flight?.selected;
  const hotel = context.hotel?.selected;
  const activity = context.activity;
  const transport = context.transport?.selected;
  const weather = context.weather;

  const planRows = [
    flight && {
      icon: Plane,
      color: "var(--accent-blue)",
      label: flight.airline,
      sub: `${flight.from} → ${flight.to} · ${flight.stops === 0 ? "non-stop" : `${flight.stops} stop`}`,
      value: money(flight.totalPrice, currency),
    },
    hotel && {
      icon: Building,
      color: "var(--accent-gold)",
      label: hotel.name,
      sub: `${hotel.rating}★ · ${hotel.nights} nights`,
      value: money(hotel.totalPrice, currency),
    },
    activity && {
      icon: Ticket,
      color: "var(--accent-coral)",
      label: `${activity.items.length} activities`,
      sub: activity.droppedCount ? `${activity.droppedCount} trimmed in negotiation` : "curated experiences",
      value: money(activity.totalCost, currency),
    },
    transport && {
      icon: Bus,
      color: "var(--accent-green)",
      label: transport.mode,
      sub: transport.description || "local transport",
      value: money(transport.cost, currency),
    },
    weather && {
      icon: CloudSun,
      color: "var(--status-waiting)",
      label: `${weather.season} · ${weather.tempRange}`,
      sub: weather.conditions || "weather outlook",
      value: "",
    },
  ].filter(Boolean) as {
    icon: React.ElementType;
    color: string;
    label: string;
    sub: string;
    value: string;
  }[];

  const budgetLines = b
    ? [
        { icon: Plane, label: "Flights", value: b.flightCost, color: "var(--accent-blue)" },
        { icon: Building, label: "Hotel", value: b.hotelCost, color: "var(--accent-gold)" },
        { icon: Ticket, label: "Activities", value: b.activityCost, color: "var(--accent-coral)" },
        { icon: Bus, label: "Transport", value: b.transportCost, color: "var(--accent-green)" },
        { icon: Coins, label: "Food & misc", value: b.miscCost, color: "var(--text-secondary)" },
      ]
    : [];

  const accent = overBudget ? "var(--accent-coral)" : "var(--accent-green)";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 100,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: "24px",
      }}
    >
      <div
        className="fade-in flex flex-col"
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          background: "#141414",
          border: `1px solid ${overBudget ? "rgba(232, 93, 62, 0.4)" : "var(--border-card)"}`,
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3"
          style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-divider)", flexShrink: 0 }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: overBudget ? "rgba(232, 93, 62, 0.15)" : "rgba(77, 181, 110, 0.15)",
            }}
          >
            {overBudget ? (
              <ShieldAlert size={22} style={{ color: "var(--accent-coral)" }} />
            ) : (
              <ShieldCheck size={22} style={{ color: "var(--accent-green)" }} />
            )}
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 500, color: accent }}>
              Optimized Plan Ready
            </h2>
            <p
              className="font-mono-geist"
              style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}
            >
              The agents planned & negotiated autonomously — your call now
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "24px" }}>
          {/* Negotiation reasoning */}
          {neg?.triggered && (
            <div
              className="flex items-start gap-3"
              style={{
                background: neg.savings > 0 ? "rgba(77, 181, 110, 0.08)" : "rgba(201, 150, 46, 0.08)",
                border: `1px solid ${neg.savings > 0 ? "rgba(77, 181, 110, 0.25)" : "rgba(201, 150, 46, 0.25)"}`,
                borderRadius: "12px",
                padding: "14px 16px",
                marginBottom: "20px",
              }}
            >
              <Handshake
                size={18}
                style={{ color: neg.savings > 0 ? "var(--accent-green)" : "var(--accent-gold)", flexShrink: 0, marginTop: "1px" }}
              />
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                  Agent negotiation · {neg.rounds} round{neg.rounds === 1 ? "" : "s"}
                  {neg.applied.length ? ` · ${neg.applied.join(", ")}` : ""}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {neg.summary}
                </p>
              </div>
            </div>
          )}

          {/* Plan summary */}
          <p className="font-mono-geist" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
            The Plan
          </p>
          <div className="flex flex-col gap-2" style={{ marginBottom: "20px" }}>
            {planRows.map((l, i) => {
              const Icon = l.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "10px", padding: "12px 14px" }}
                >
                  <div
                    className="flex flex-shrink-0 items-center justify-center"
                    style={{ width: "34px", height: "34px", borderRadius: "8px", background: "var(--bg-elevated)" }}
                  >
                    <Icon size={17} style={{ color: l.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.label}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.sub}
                    </p>
                  </div>
                  {l.value && (
                    <span className="font-mono-geist flex-shrink-0" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                      {l.value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Budget breakdown */}
          {b && (
            <>
              <p className="font-mono-geist" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                Budget
              </p>
              <div className="flex flex-col gap-1.5">
                {budgetLines.map((l) => {
                  const Icon = l.icon;
                  return (
                    <div key={l.label} className="flex items-center justify-between" style={{ padding: "6px 4px" }}>
                      <span className="flex items-center gap-2" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        <Icon size={14} style={{ color: l.color }} />
                        {l.label}
                      </span>
                      <span className="font-mono-geist" style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                        {money(l.value, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center" style={{ marginTop: "12px" }}>
                <Stat label="Budget" value={money(b.budget, currency)} />
                <Stat label="Total" value={money(b.totalCost, currency)} accent={accent} />
                <Stat
                  label={overBudget ? "Over by" : "Headroom"}
                  value={money(overBudget ? b.overage : b.budget - b.totalCost, currency)}
                  accent={accent}
                />
              </div>
            </>
          )}

          {/* Modify budget panel */}
          {panel === "budget" && (
            <div className="mt-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border-divider)", paddingTop: "16px", marginTop: "16px" }}>
              <div className="flex flex-wrap items-center gap-3">
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>New budget</span>
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(Number(e.target.value))}
                  className="font-mono-geist"
                  style={{ width: "180px", background: "var(--bg-elevated)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", color: "var(--text-primary)", outline: "none" }}
                />
                <button
                  onClick={() => run("update_budget", newBudget)}
                  disabled={!!busy || newBudget <= 0}
                  className="flex items-center gap-2"
                  style={{ background: "var(--accent-gold)", border: "none", color: "#fff", fontSize: "13px", fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", padding: "9px 18px", borderRadius: "8px" }}
                >
                  <Wand2 size={14} />
                  {busy === "update_budget" ? "Re-optimizing…" : "Update & re-optimize"}
                </button>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                The Budget Agent recomputes against the new limit and re-runs negotiation if needed.
              </p>
            </div>
          )}

          {/* Change preferences panel */}
          {panel === "prefs" && (
            <div className="mt-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border-divider)", paddingTop: "16px", marginTop: "16px" }}>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Describe what to change — only the affected agents re-run.
              </span>
              <textarea
                value={prefsPrompt}
                onChange={(e) => setPrefsPrompt(e.target.value)}
                rows={2}
                placeholder="e.g. Make it 7 days and add nightlife"
                style={{ width: "100%", resize: "none", background: "var(--bg-elevated)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "var(--text-primary)", outline: "none" }}
              />
              <div className="flex flex-wrap items-center gap-2">
                {PREF_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setPrefsPrompt(ex)}
                    className="font-mono-geist"
                    style={{ fontSize: "11px", color: "var(--text-secondary)", border: "1px solid var(--border-card)", borderRadius: "6px", padding: "5px 9px", cursor: "pointer", background: "transparent" }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <button
                onClick={applyPrefs}
                disabled={!!busy || !prefsPrompt.trim()}
                className="flex items-center gap-2 self-start"
                style={{ background: "var(--accent-blue)", border: "none", color: "#fff", fontSize: "13px", fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", padding: "9px 18px", borderRadius: "8px", opacity: !prefsPrompt.trim() ? 0.6 : 1 }}
              >
                <MessageSquarePlus size={14} />
                {busy === "change_preferences" ? "Re-planning…" : "Apply & re-plan"}
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between gap-3"
          style={{ padding: "16px 24px", borderTop: "1px solid var(--border-divider)", flexShrink: 0, flexWrap: "wrap" }}
        >
          <button
            onClick={() => run("reject")}
            disabled={!!busy}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "13px", fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", padding: "10px 8px" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-coral)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </button>

          <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
            <button
              onClick={() => setPanel((p) => (p === "prefs" ? "none" : "prefs"))}
              disabled={!!busy}
              className="flex items-center gap-2"
              style={{ background: "transparent", border: "1px solid var(--border-card)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", padding: "10px 16px", borderRadius: "8px" }}
            >
              <MessageSquarePlus size={14} /> Change Preferences
            </button>
            <button
              onClick={() => setPanel((p) => (p === "budget" ? "none" : "budget"))}
              disabled={!!busy}
              className="flex items-center gap-2"
              style={{ background: "transparent", border: "1px solid var(--border-card)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", padding: "10px 16px", borderRadius: "8px" }}
            >
              <Pencil size={14} /> Modify Budget
            </button>
            <button
              onClick={() => run("approve")}
              disabled={!!busy}
              style={{ background: "var(--accent-coral)", color: "#fff", fontSize: "13px", fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", padding: "10px 24px", borderRadius: "8px", border: "none", opacity: busy ? 0.6 : 1, transition: "background 0.2s ease" }}
              onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#f06b4a"; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-coral)")}
            >
              {busy === "approve" ? "Approving…" : "Approve & Generate Itinerary"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", borderRadius: "8px", padding: "10px 8px" }}>
      <p className="font-mono-geist" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
        {label}
      </p>
      <p className="font-mono-geist" style={{ fontSize: "14px", fontWeight: 500, color: accent ?? "var(--text-primary)", marginTop: "2px" }}>
        {value}
      </p>
    </div>
  );
}
