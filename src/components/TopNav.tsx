"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import type { WorkflowRow } from "@/lib/types";

const STATUS_PILL: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: "PENDING",
    color: "var(--accent-blue)",
    bg: "rgba(96, 165, 250, 0.12)",
    border: "rgba(96, 165, 250, 0.25)",
  },
  running: {
    label: "RUNNING",
    color: "var(--accent-green)",
    bg: "rgba(77, 181, 110, 0.12)",
    border: "rgba(77, 181, 110, 0.25)",
  },
  awaiting_approval: {
    label: "AWAITING APPROVAL",
    color: "var(--status-waiting)",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.25)",
  },
  awaiting_selection: {
    label: "AWAITING SELECTION",
    color: "var(--accent-gold)",
    bg: "rgba(201, 150, 46, 0.12)",
    border: "rgba(201, 150, 46, 0.3)",
  },
  awaiting_input: {
    label: "ACTION NEEDED",
    color: "var(--accent-coral)",
    bg: "rgba(232, 93, 62, 0.1)",
    border: "rgba(232, 93, 62, 0.25)",
  },
  awaiting_budget_review: {
    label: "BUDGET REVIEW",
    color: "var(--accent-gold)",
    bg: "rgba(201, 150, 46, 0.12)",
    border: "rgba(201, 150, 46, 0.3)",
  },
  completed: {
    label: "COMPLETED",
    color: "var(--accent-green)",
    bg: "rgba(77, 181, 110, 0.12)",
    border: "rgba(77, 181, 110, 0.25)",
  },
  failed: {
    label: "FAILED",
    color: "var(--accent-coral)",
    bg: "rgba(232, 93, 62, 0.1)",
    border: "rgba(232, 93, 62, 0.25)",
  },
  rejected: {
    label: "REJECTED",
    color: "var(--accent-coral)",
    bg: "rgba(232, 93, 62, 0.1)",
    border: "rgba(232, 93, 62, 0.25)",
  },
};

export function TopNav({ workflow }: { workflow: WorkflowRow | null }) {
  const [utcTime, setUtcTime] = useState("");

  useEffect(() => {
    const update = () =>
      setUtcTime(new Date().toISOString().slice(11, 19) + " UTC");
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const status = workflow ? STATUS_PILL[workflow.status] ?? STATUS_PILL.pending : null;
  const breadcrumb = workflow?.request?.destination ?? "New Operation";

  return (
    <header
      className="fixed left-0 right-0 top-0 flex items-center justify-between px-6"
      style={{
        height: "60px",
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border-card)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 50,
      }}
    >
      {/* Left cluster */}
      <div className="flex items-center">
        <div className="flex items-center gap-2">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            stroke="#f5f5f0"
            strokeWidth="1.5"
          >
            <circle cx="14" cy="14" r="10" />
            <line x1="14" y1="4" x2="14" y2="24" />
            <line x1="4" y1="14" x2="24" y2="14" />
            <circle cx="14" cy="14" r="4" />
          </svg>
          <span
            className="font-medium"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--text-primary)",
            }}
          >
            VOYAGER
          </span>
        </div>

        <div
          style={{
            width: "1px",
            height: "20px",
            background: "var(--border-divider)",
            margin: "0 16px",
          }}
        />

        <div className="hidden items-center gap-2 sm:flex">
          <span
            className="font-mono-geist"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.04em",
              color: "var(--text-secondary)",
            }}
          >
            Operations
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>/</span>
          <span
            className="font-mono-geist"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.04em",
              color: "var(--text-primary)",
            }}
          >
            {breadcrumb}
          </span>
        </div>
      </div>

      {/* Center cluster - status pills */}
      <div className="hidden items-center gap-3 md:flex">
        {status && (
          <div
            className="flex items-center gap-2"
            style={{
              background: status.bg,
              border: `1px solid ${status.border}`,
              borderRadius: "20px",
              padding: "4px 12px",
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: "6px",
                height: "6px",
                background: status.color,
                boxShadow: `0 0 6px ${status.color}`,
                animation: "pulse 2s infinite",
              }}
            />
            <span
              className="font-mono-geist"
              style={{ fontSize: "11px", color: status.color }}
            >
              {status.label}
            </span>
          </div>
        )}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-4">
        <span
          className="font-mono-geist hidden sm:inline"
          style={{ fontSize: "11px", color: "var(--text-secondary)" }}
        >
          {utcTime}
        </span>

        <div className="relative cursor-pointer">
          <Bell size={20} style={{ color: "var(--text-secondary)" }} />
          {(workflow?.status === "awaiting_approval" ||
            workflow?.status === "awaiting_selection" ||
            workflow?.status === "awaiting_budget_review" ||
            workflow?.status === "awaiting_input") && (
            <span
              className="absolute rounded-full"
              style={{
                width: "6px",
                height: "6px",
                background: "var(--accent-coral)",
                top: 0,
                right: 0,
              }}
            />
          )}
        </div>

        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: "32px",
            height: "32px",
            border: "2px solid var(--accent-gold)",
            background: "linear-gradient(135deg, #c9962e 0%, #e85d3e 100%)",
            fontSize: "12px",
            fontWeight: 600,
            color: "#fff",
          }}
        >
          OP
        </div>
      </div>
    </header>
  );
}
