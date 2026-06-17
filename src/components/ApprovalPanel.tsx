"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Plane,
  Building,
  Coins,
  Pencil,
  Wand2,
} from "lucide-react";
import type {
  ApprovalRow,
  CommandType,
  SharedContext,
  WorkflowRow,
} from "@/lib/types";
import { money } from "@/lib/format";

export function ApprovalPanel({
  workflow,
  approvals,
  context,
  onCommand,
}: {
  workflow: WorkflowRow;
  approvals: ApprovalRow[];
  context: SharedContext;
  onCommand: (command: CommandType, newBudget?: number) => Promise<void>;
}) {
  const pending = approvals.find((a) => a.status === "pending");
  const currency = workflow.request?.currency ?? "INR";
  const b = context.budget;
  const overBudget = !!b && !b.withinBudget;
  const [busy, setBusy] = useState<CommandType | null>(null);
  const [showBudget, setShowBudget] = useState(overBudget);

  // Default the target to the user's originally specified budget so
  // "auto-match" aims at the budget they actually asked for.
  const suggested = workflow.request?.budget ?? workflow.budget;
  const [newBudget, setNewBudget] = useState<number>(suggested);

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

  const lines = b
    ? [
        { icon: Plane, label: "Flights", value: b.flightCost, color: "var(--accent-blue)" },
        { icon: Building, label: "Hotel", value: b.hotelCost, color: "var(--accent-gold)" },
        { icon: Coins, label: "Miscellaneous", value: b.miscCost, color: "var(--accent-green)" },
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
          maxWidth: "600px",
          maxHeight: "88vh",
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
              Approval Required
            </h2>
            <p
              className="font-mono-geist"
              style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}
            >
              Approve, modify the budget, or reject before the itinerary runs
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "24px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "16px" }}>
            {pending.reason}
          </p>

          {overBudget && (
            <div
              className="flex items-start gap-2.5"
              style={{
                background: "rgba(201, 150, 46, 0.08)",
                border: "1px solid rgba(201, 150, 46, 0.25)",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "16px",
              }}
            >
              <Wand2 size={16} style={{ color: "var(--accent-gold)", flexShrink: 0, marginTop: "2px" }} />
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                This trip is over budget. Set your target below and the agent will
                automatically pick the closest flight &amp; hotel to fit it.
              </p>
            </div>
          )}

          {b && (
            <>
              <div className="flex flex-col gap-2">
                {lines.map((l) => {
                  const Icon = l.icon;
                  return (
                    <div
                      key={l.label}
                      className="flex items-center justify-between"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-card)",
                        borderRadius: "8px",
                        padding: "10px 14px",
                      }}
                    >
                      <span className="flex items-center gap-2" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        <Icon size={15} style={{ color: l.color }} />
                        {l.label}
                      </span>
                      <span className="font-mono-geist" style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                        {money(l.value, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                className="mt-3 grid grid-cols-3 gap-2 text-center"
                style={{ marginTop: "12px" }}
              >
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

          {showBudget && (
            <div
              className="mt-4 flex flex-col gap-3"
              style={{ borderTop: "1px solid var(--border-divider)", paddingTop: "16px", marginTop: "16px" }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Target budget
                </span>
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(Number(e.target.value))}
                  className="font-mono-geist"
                  style={{
                    width: "160px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-card)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => run("auto_match_budget", newBudget)}
                  disabled={!!busy || newBudget <= 0}
                  className="flex items-center gap-2"
                  style={{
                    background: "var(--accent-gold)",
                    border: "none",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: busy ? "not-allowed" : "pointer",
                    padding: "9px 18px",
                    borderRadius: "8px",
                  }}
                >
                  <Wand2 size={14} />
                  {busy === "auto_match_budget"
                    ? "Matching…"
                    : "Auto-match flight & hotel to budget"}
                </button>
                <button
                  onClick={() => run("update_budget", newBudget)}
                  disabled={!!busy || newBudget <= 0}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-card)",
                    color: "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: busy ? "not-allowed" : "pointer",
                    padding: "9px 18px",
                    borderRadius: "8px",
                  }}
                >
                  {busy === "update_budget" ? "Updating…" : "Just raise the limit"}
                </button>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Auto-match keeps you within the target by re-selecting the closest
                available flight and hotel. Raising the limit keeps your current
                picks and simply increases the budget.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between gap-3"
          style={{ padding: "16px 24px", borderTop: "1px solid var(--border-divider)", flexShrink: 0 }}
        >
          <button
            onClick={() => run("reject")}
            disabled={!!busy}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: busy ? "not-allowed" : "pointer",
              padding: "10px 8px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-coral)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBudget((s) => !s)}
              disabled={!!busy}
              className="flex items-center gap-2"
              style={{
                background: "transparent",
                border: "1px solid var(--border-card)",
                color: "var(--text-primary)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: busy ? "not-allowed" : "pointer",
                padding: "10px 20px",
                borderRadius: "8px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--text-secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-card)")}
            >
              <Pencil size={14} /> Modify Budget
            </button>

            <button
              onClick={() => run("approve")}
              disabled={!!busy}
              style={{
                background: "var(--accent-coral)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 500,
                cursor: busy ? "not-allowed" : "pointer",
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                opacity: busy ? 0.6 : 1,
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!busy) e.currentTarget.style.background = "#f06b4a";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-coral)")}
            >
              {busy === "approve" ? "Approving…" : "Approve & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        borderRadius: "8px",
        padding: "10px 8px",
      }}
    >
      <p
        className="font-mono-geist"
        style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}
      >
        {label}
      </p>
      <p
        className="font-mono-geist"
        style={{ fontSize: "14px", fontWeight: 500, color: accent ?? "var(--text-primary)", marginTop: "2px" }}
      >
        {value}
      </p>
    </div>
  );
}
