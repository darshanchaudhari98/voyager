"use client";

import type { WorkflowRow } from "@/lib/types";

export function Footer({ workflow }: { workflow: WorkflowRow | null }) {
  const operational =
    !workflow || (workflow.status !== "failed" && workflow.status !== "rejected");

  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-3"
      style={{
        marginTop: "48px",
        padding: "16px 0",
        borderTop: "1px solid var(--border-card)",
      }}
    >
      <span
        className="font-mono-geist"
        style={{ fontSize: "11px", color: "var(--text-muted)" }}
      >
        Voyager Control Plane
      </span>
      <span
        className="font-mono-geist"
        style={{ fontSize: "11px", color: "var(--text-muted)" }}
      >
        Event Protocol: v1.2
      </span>
      <div className="flex items-center gap-2">
        <span
          className="inline-block rounded-full"
          style={{
            width: "6px",
            height: "6px",
            background: operational ? "var(--accent-green)" : "var(--accent-coral)",
          }}
        />
        <span
          className="font-mono-geist"
          style={{
            fontSize: "11px",
            color: operational ? "var(--accent-green)" : "var(--accent-coral)",
          }}
        >
          {operational ? "All systems operational" : "Workflow halted"}
        </span>
      </div>
    </footer>
  );
}
