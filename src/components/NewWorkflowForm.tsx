"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

const EXAMPLES = [
  "Plan a 5-day trip to Japan for 2 people with a budget of ₹100,000",
  "Plan a 7-day luxury trip to Dubai for 2 with budget ₹100,000",
  "Plan a 4-day family beach holiday to Bali for 4 people, budget ₹100,000",
];

export function NewWorkflowForm({
  onCreated,
}: {
  onCreated: (workflowId: string) => void;
}) {
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!prompt.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/workflows/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create workflow");
      onCreated(json.workflowId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderRadius: "12px",
        padding: "24px",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={16} style={{ color: "var(--accent-gold)" }} />
        <span style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)" }}>
          New Travel Plan Request
        </span>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="Plan a 5-day trip to Japan for 2 people with a budget of ₹100,000"
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
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-coral)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-card)")}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          style={{
            background: "var(--accent-coral)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 500,
            cursor: submitting ? "not-allowed" : "pointer",
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            opacity: submitting ? 0.6 : 1,
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!submitting) e.currentTarget.style.background = "#f06b4a";
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-coral)")}
        >
          {submitting ? "Launching agents…" : "Launch Workflow"}
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
            Example {i + 1}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--accent-coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
