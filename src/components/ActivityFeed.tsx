"use client";

import { useEffect, useRef } from "react";
import {
  CheckCircle,
  AlertCircle,
  Play,
  FileText,
  Flag,
  Star,
  XCircle,
  ListChecks,
  MousePointerClick,
  CalendarClock,
  Calculator,
} from "lucide-react";
import type { EventRow, EventType } from "@/lib/types";
import { clockTime } from "@/lib/format";

const STYLE: Record<EventType, { color: string; icon: React.ElementType }> = {
  workflow_started: { color: "var(--accent-blue)", icon: Play },
  agent_started: { color: "var(--accent-blue)", icon: Play },
  agent_completed: { color: "var(--accent-green)", icon: CheckCircle },
  context_updated: { color: "var(--accent-gold)", icon: FileText },
  selection_required: { color: "var(--accent-gold)", icon: ListChecks },
  selection_received: { color: "var(--accent-green)", icon: MousePointerClick },
  input_required: { color: "var(--accent-coral)", icon: CalendarClock },
  input_received: { color: "var(--accent-green)", icon: MousePointerClick },
  budget_review_required: { color: "var(--accent-gold)", icon: Calculator },
  approval_required: { color: "var(--accent-coral)", icon: AlertCircle },
  approval_received: { color: "var(--status-waiting)", icon: Flag },
  workflow_completed: { color: "var(--accent-green)", icon: Star },
  workflow_failed: { color: "var(--accent-coral)", icon: XCircle },
};

export function ActivityFeed({ events }: { events: EventRow[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderRadius: "12px",
        padding: "24px",
        height: "540px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="mb-4 flex items-center justify-between" style={{ flexShrink: 0 }}>
        <h2 style={{ fontSize: "20px", fontWeight: 500, color: "var(--text-primary)" }}>
          Activity Log
        </h2>
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full"
            style={{
              width: "6px",
              height: "6px",
              background: "var(--accent-coral)",
              boxShadow: "0 0 6px rgba(232, 93, 62, 0.6)",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            className="font-mono-geist"
            style={{ fontSize: "11px", color: "var(--accent-coral)" }}
          >
            LIVE
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingRight: "6px" }}
      >
        {events.length === 0 && (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            No events yet.
          </p>
        )}
        {events.map((event) => {
          const st = STYLE[event.type] ?? { color: "var(--text-secondary)", icon: FileText };
          const Icon = st.icon;
          return (
            <div
              key={event.id}
              className="flex items-start gap-3"
              style={{ padding: "10px 0", borderBottom: "1px solid var(--border-divider)" }}
            >
              <span
                className="font-mono-geist flex-shrink-0"
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  minWidth: "64px",
                  paddingTop: "2px",
                }}
              >
                {clockTime(event.created_at)}
              </span>
              <Icon size={16} style={{ color: st.color, flexShrink: 0, marginTop: "2px" }} />
              <div className="min-w-0 flex-1">
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-primary)",
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {event.message ?? event.type}
                </p>
                <span
                  className="font-mono-geist mt-1 inline-block"
                  style={{
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-card)",
                    borderRadius: "4px",
                    padding: "1px 6px",
                  }}
                >
                  {event.type}
                  {event.agent ? ` · ${event.agent}` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
