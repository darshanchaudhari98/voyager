"use client";

import { useState } from "react";
import { MessageSquarePlus, Wand2 } from "lucide-react";

const EXAMPLES = [
  "I prefer Emirates",
  "Make the hotel luxury",
  "Make it 7 days and add nightlife",
  "Raise the budget to ₹3,00,000",
];

/**
 * Refine-plan widget shown once the workflow has completed, so the operator can
 * change preferences in plain language. It re-runs only the affected agents and
 * re-opens the approval gate with the updated, re-optimized plan.
 */
export function RefinePlanCard({
  onSubmit,
}: {
  onSubmit: (prompt: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      await onSubmit(prompt.trim());
      setPrompt("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fade-in"
      style={{
        marginTop: "32px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderRadius: "12px",
        padding: "24px",
      }}
    >
      <div className="mb-1 flex items-center gap-2">
        <MessageSquarePlus size={18} style={{ color: "var(--accent-blue)" }} />
        <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
          Refine this plan
        </span>
      </div>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: 1.5 }}>
        Want to change something? Describe it in plain language. Only the affected
        agents re-run, then the agents re-optimize and present an updated plan for
        your approval.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="e.g. I prefer Emirates and a luxury hotel"
        style={{
          width: "100%",
          resize: "none",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-card)",
          borderRadius: "8px",
          padding: "12px",
          fontSize: "14px",
          color: "var(--text-primary)",
          outline: "none",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-card)")}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || !prompt.trim()}
          className="flex items-center gap-2"
          style={{
            background: "var(--accent-blue)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 500,
            cursor: busy || !prompt.trim() ? "not-allowed" : "pointer",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            opacity: busy || !prompt.trim() ? 0.6 : 1,
          }}
        >
          <Wand2 size={14} />
          {busy ? "Re-planning…" : "Apply & re-plan"}
        </button>

        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => setPrompt(ex)}
            className="font-mono-geist"
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-card)",
              borderRadius: "6px",
              padding: "6px 10px",
              cursor: "pointer",
              background: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
