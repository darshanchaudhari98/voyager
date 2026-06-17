"use client";

import { useEffect, useState } from "react";
import {
  Calculator,
  Plane,
  Building,
  Coins,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Wand2,
} from "lucide-react";
import type { SharedContext, WorkflowRow } from "@/lib/types";
import { money } from "@/lib/format";

export function BudgetReviewModal({
  workflow,
  context,
  onContinue,
}: {
  workflow: WorkflowRow;
  context: SharedContext;
  onContinue: () => Promise<void>;
}) {
  const b = context.budget;
  const cur = context.request?.currency ?? workflow.request?.currency ?? "INR";
  const flight = context.flight?.selected;
  const hotel = context.hotel?.selected;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!b) return null;

  const overBudget = !b.withinBudget;
  const pct = b.budget > 0 ? Math.min(100, Math.round((b.totalCost / b.budget) * 100)) : 0;

  const lines = [
    {
      icon: Plane,
      label: "Flights",
      sub: flight ? `${flight.airline}` : "Selected flight",
      value: b.flightCost,
      color: "var(--accent-blue)",
    },
    {
      icon: Building,
      label: "Hotel",
      sub: hotel ? `${hotel.name} · ${hotel.nights} nights` : "Selected hotel",
      value: b.hotelCost,
      color: "var(--accent-gold)",
    },
    {
      icon: Coins,
      label: "Miscellaneous",
      sub: "Food, local transport, activities & contingency",
      value: b.miscCost,
      color: "var(--accent-green)",
    },
  ];

  async function cont() {
    setBusy(true);
    try {
      await onContinue();
    } finally {
      setBusy(false);
    }
  }

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
          border: "1px solid var(--border-card)",
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
              background: "rgba(201, 150, 46, 0.15)",
            }}
          >
            <Calculator size={22} style={{ color: "var(--accent-gold)" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 500, color: "var(--text-primary)" }}>
              Budget Breakdown
            </h2>
            <p
              className="font-mono-geist"
              style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}
            >
              Detailed estimate from the Budget Agent
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "24px" }}>
          {context.autoMatch?.applied && (
            <div
              className="flex items-start gap-3"
              style={{
                background: context.autoMatch.withinBudget
                  ? "rgba(77, 181, 110, 0.08)"
                  : "rgba(201, 150, 46, 0.08)",
                border: `1px solid ${
                  context.autoMatch.withinBudget
                    ? "rgba(77, 181, 110, 0.25)"
                    : "rgba(201, 150, 46, 0.25)"
                }`,
                borderRadius: "12px",
                padding: "14px 16px",
                marginBottom: "20px",
              }}
            >
              <Wand2
                size={18}
                style={{
                  color: context.autoMatch.withinBudget
                    ? "var(--accent-green)"
                    : "var(--accent-gold)",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              />
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                  Agent matched your budget
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {context.autoMatch.message}
                </p>
              </div>
            </div>
          )}

          {/* Expense lines */}
          <div className="flex flex-col gap-2">
            {lines.map((l) => {
              const Icon = l.icon;
              return (
                <div
                  key={l.label}
                  className="flex items-center gap-3"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-card)",
                    borderRadius: "10px",
                    padding: "14px 16px",
                  }}
                >
                  <div
                    className="flex flex-shrink-0 items-center justify-center"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <Icon size={18} style={{ color: l.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {l.label}
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.sub}
                    </p>
                  </div>
                  <span
                    className="font-mono-geist flex-shrink-0"
                    style={{ fontSize: "15px", color: "var(--text-primary)" }}
                  >
                    {money(l.value, cur)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total vs budget */}
          <div
            style={{
              marginTop: "16px",
              background: overBudget ? "rgba(232, 93, 62, 0.06)" : "rgba(77, 181, 110, 0.06)",
              border: `1px solid ${
                overBudget ? "rgba(232, 93, 62, 0.25)" : "rgba(77, 181, 110, 0.25)"
              }`,
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Estimated Total
              </span>
              <span
                className="font-mono-geist"
                style={{
                  fontSize: "22px",
                  fontWeight: 500,
                  color: overBudget ? "var(--accent-coral)" : "var(--accent-green)",
                }}
              >
                {money(b.totalCost, cur)}
              </span>
            </div>

            {/* Bar */}
            <div
              style={{
                height: "6px",
                background: "var(--border-card)",
                borderRadius: "3px",
                overflow: "hidden",
                margin: "12px 0 8px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: overBudget ? "var(--accent-coral)" : "var(--accent-green)",
                  borderRadius: "3px",
                  transition: "width 0.6s ease-out",
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span
                className="font-mono-geist"
                style={{ fontSize: "11px", color: "var(--text-muted)" }}
              >
                Budget limit: {money(b.budget, cur)}
              </span>
              <span
                className="font-mono-geist flex items-center gap-1.5"
                style={{
                  fontSize: "12px",
                  color: overBudget ? "var(--accent-coral)" : "var(--accent-green)",
                }}
              >
                {overBudget ? (
                  <>
                    <AlertTriangle size={13} /> Over by {money(b.overage, cur)}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} /> Within budget
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "16px 24px", borderTop: "1px solid var(--border-divider)", flexShrink: 0 }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Next: review &amp; approve before the itinerary is generated.
          </span>
          <button
            onClick={cont}
            disabled={busy}
            className="flex items-center gap-2"
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
            Continue to Approval <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
