"use client";

import { useEffect, useState } from "react";
import { CalendarClock, AlertTriangle, ArrowRight } from "lucide-react";
import type { SharedContext, WorkflowRow } from "@/lib/types";

export function InputModal({
  workflow,
  context,
  onSubmit,
}: {
  workflow: WorkflowRow;
  context: SharedContext;
  onSubmit: (departDate: string, returnDate: string) => Promise<void>;
}) {
  const req = workflow.request;
  const issue = context.inputRequest;
  const agentLabel =
    issue?.agent === "hotel" ? "Hotel Agent" : "Flight Agent";

  const [depart, setDepart] = useState(req?.departDate ?? "");
  const [ret, setRet] = useState(req?.returnDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const nights =
    depart && ret
      ? Math.max(
          0,
          Math.round(
            (new Date(ret).getTime() - new Date(depart).getTime()) / 86_400_000
          )
        )
      : 0;

  async function submit() {
    setError(null);
    if (!depart || !ret) {
      setError("Please choose both a departure and a return date.");
      return;
    }
    if (new Date(ret).getTime() <= new Date(depart).getTime()) {
      setError("Return date must be after the departure date.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(depart, ret);
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
        className="fade-in"
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#141414",
          border: "1px solid var(--border-card)",
          borderRadius: "16px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3"
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-divider)",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(245, 158, 11, 0.15)",
            }}
          >
            <CalendarClock size={22} style={{ color: "var(--status-waiting)" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 500, color: "var(--text-primary)" }}>
              Adjust Trip Dates
            </h2>
            <p
              className="font-mono-geist"
              style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}
            >
              {agentLabel} needs different dates
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px" }}>
          {/* The problem */}
          <div
            className="flex items-start gap-3"
            style={{
              background: "rgba(232, 93, 62, 0.06)",
              border: "1px solid rgba(232, 93, 62, 0.25)",
              borderRadius: "10px",
              padding: "12px 14px",
              marginBottom: "20px",
            }}
          >
            <AlertTriangle
              size={16}
              style={{ color: "var(--accent-coral)", flexShrink: 0, marginTop: "2px" }}
            />
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {issue?.message ??
                "No availability was found for the selected dates. Please pick new travel dates and we'll search again."}
            </p>
          </div>

          {/* Date inputs */}
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-1 flex-col gap-1" style={{ minWidth: "160px" }}>
              <span
                className="font-mono-geist"
                style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}
              >
                Departure
              </span>
              <input
                type="date"
                value={depart}
                onChange={(e) => setDepart(e.target.value)}
                className="font-mono-geist"
                style={inputStyle}
              />
            </label>
            <ArrowRight
              size={16}
              style={{ color: "var(--text-muted)", marginBottom: "10px", flexShrink: 0 }}
            />
            <label className="flex flex-1 flex-col gap-1" style={{ minWidth: "160px" }}>
              <span
                className="font-mono-geist"
                style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}
              >
                Return
              </span>
              <input
                type="date"
                value={ret}
                min={depart || undefined}
                onChange={(e) => setRet(e.target.value)}
                className="font-mono-geist"
                style={inputStyle}
              />
            </label>
          </div>

          {nights > 0 && (
            <p
              className="font-mono-geist"
              style={{ marginTop: "12px", fontSize: "11px", color: "var(--text-muted)" }}
            >
              {nights} night{nights === 1 ? "" : "s"} ·{" "}
              {req?.travelers ?? 1} traveler{(req?.travelers ?? 1) === 1 ? "" : "s"}
            </p>
          )}

          {error && (
            <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--accent-coral)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end"
          style={{ padding: "16px 24px", borderTop: "1px solid var(--border-divider)" }}
        >
          <button
            onClick={submit}
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
            {busy ? "Searching again…" : "Update Dates & Retry"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-card)",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "13px",
  color: "var(--text-primary)",
  outline: "none",
  colorScheme: "dark",
};
