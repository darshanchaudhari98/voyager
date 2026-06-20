"use client";

import { useEffect, useRef } from "react";
import {
  ArrowRight,
  Radio,
  Send,
  CornerDownRight,
  Info,
  Plane,
  Building,
  Ticket,
  Bus,
  CloudSun,
  Compass,
  Calculator,
  Handshake,
  TrendingDown,
} from "lucide-react";
import type { AgentMessageRow, MessageType } from "@/lib/types";
import { clockTime } from "@/lib/format";
import { money } from "@/lib/format";

// ---------------------------------------------------------------------------
// Per-agent visual identity so the conversation is easy to scan.
// ---------------------------------------------------------------------------
const AGENT_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  flight: { label: "Flight", color: "var(--accent-blue)", icon: Plane },
  hotel: { label: "Hotel", color: "var(--accent-gold)", icon: Building },
  activity: { label: "Activity", color: "var(--accent-coral)", icon: Ticket },
  transport: { label: "Transport", color: "var(--accent-green)", icon: Bus },
  weather: { label: "Weather", color: "var(--status-waiting)", icon: CloudSun },
  insights: { label: "Insights", color: "var(--accent-blue)", icon: Compass },
  budget: { label: "Budget", color: "var(--accent-gold)", icon: Calculator },
  approval: { label: "Approval", color: "var(--status-waiting)", icon: Handshake },
  all: { label: "All agents", color: "var(--text-secondary)", icon: Radio },
};

const TYPE_META: Record<MessageType, { color: string; icon: React.ElementType; label: string }> = {
  request: { color: "var(--accent-coral)", icon: Send, label: "REQUEST" },
  response: { color: "var(--accent-green)", icon: CornerDownRight, label: "RESPONSE" },
  broadcast: { color: "var(--accent-gold)", icon: Radio, label: "BROADCAST" },
  info: { color: "var(--accent-blue)", icon: Info, label: "INFO" },
};

function meta(agent: string) {
  return AGENT_META[agent] ?? { label: agent, color: "var(--text-secondary)", icon: Info };
}

interface DetailRow {
  label: string;
  value: string;
  good?: boolean;
}

/** Turn a message body into readable, human-friendly detail rows. */
function describe(m: AgentMessageRow, cur: string): DetailRow[] {
  const b = m.body ?? {};
  const rows: DetailRow[] = [];
  const n = (v: unknown) => (typeof v === "number" ? v : undefined);

  const overage = n(b.overage);
  const target = n(b.target);
  const totalCost = n(b.totalCost);
  const needToSave = n(b.needToSave);
  const from = n(b.from);
  const to = n(b.to);
  const savings = n(b.savings);
  const newTotal = n(b.newTotal);
  const dropped = n(b.dropped);
  const rounds = n(b.rounds);
  const applied = Array.isArray(b.applied) ? (b.applied as string[]) : undefined;

  if (totalCost != null) rows.push({ label: "Current total", value: money(totalCost, cur) });
  if (target != null) rows.push({ label: "Target budget", value: money(target, cur) });
  if (overage != null) rows.push({ label: "Over budget by", value: money(overage, cur) });
  if (needToSave != null) rows.push({ label: "Needs to save", value: money(needToSave, cur) });

  if (from != null && to != null) {
    rows.push({ label: "Price change", value: `${money(from, cur)} → ${money(to, cur)}` });
  }
  if (dropped != null) rows.push({ label: "Optional items dropped", value: String(dropped) });
  if (savings != null && savings > 0) {
    rows.push({ label: "Saves", value: money(savings, cur), good: true });
  }
  if (applied) {
    rows.push({
      label: "Applied changes",
      value: applied.length ? applied.join(", ") : "none",
    });
  }
  if (newTotal != null) rows.push({ label: "New total", value: money(newTotal, cur) });
  if (rounds != null) rows.push({ label: "Rounds", value: String(rounds) });
  if (typeof b.withinBudget === "boolean") {
    rows.push({
      label: "Result",
      value: b.withinBudget ? "within budget ✓" : "still over budget",
      good: b.withinBudget,
    });
  }
  if (b.proposed === null) {
    rows.push({ label: "Outcome", value: "no cheaper option available" });
  }
  return rows;
}

/**
 * Observability panel for the DIRECT agent-to-agent (A2A) message channel.
 * Renders the budget negotiation as a readable conversation: who is talking to
 * whom, the request/response type, and the concrete numbers (price changes,
 * savings, new totals) so it's obvious the agents are negotiating.
 */
export function AgentMessages({
  messages,
  currency = "INR",
}: {
  messages: AgentMessageRow[];
  currency?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const savedTotal = messages
    .filter((m) => m.type === "broadcast" && typeof m.body?.savings === "number")
    .reduce((max, m) => Math.max(max, Number(m.body.savings)), 0);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderRadius: "12px",
        padding: "24px",
        marginTop: "32px",
        display: "flex",
        flexDirection: "column",
        maxHeight: "560px",
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2.5">
          <Handshake size={20} style={{ color: "var(--accent-coral)" }} />
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>
              Agent Negotiation
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "1px" }}>
              Direct agent-to-agent messages
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedTotal > 0 && (
            <span
              className="flex items-center gap-1.5"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--accent-green)",
                background: "rgba(77, 181, 110, 0.12)",
                borderRadius: "6px",
                padding: "4px 10px",
              }}
            >
              <TrendingDown size={14} /> saved {money(savedTotal, currency)}
            </span>
          )}
          <span
            className="font-mono-geist"
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-card)",
              borderRadius: "6px",
              padding: "4px 10px",
            }}
          >
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingRight: "8px" }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--border-divider)",
              borderRadius: "12px",
              padding: "28px 20px",
              textAlign: "center",
            }}
          >
            <Handshake size={28} style={{ color: "var(--text-muted)", margin: "0 auto 10px" }} />
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: "420px", margin: "0 auto" }}>
              No negotiation yet. When the trip goes over budget, the Budget Agent
              messages the Flight, Hotel, Activity and Transport agents here — and
              they reply with cheaper options in real time.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const tm = TYPE_META[m.type] ?? TYPE_META.info;
              const sender = meta(m.sender);
              const recipient = meta(m.recipient);
              const SenderIcon = sender.icon;
              const RecipientIcon = recipient.icon;
              const TypeIcon = tm.icon;
              const details = describe(m, currency);
              const isResponse = m.type === "response";

              const tint =
                m.type === "response"
                  ? "rgba(77, 181, 110, 0.07)"
                  : m.type === "broadcast"
                  ? "rgba(201, 150, 46, 0.07)"
                  : m.type === "request"
                  ? "rgba(232, 93, 62, 0.05)"
                  : "var(--bg-elevated)";

              // Headline figure: savings (good) or the amount that needs saving.
              const savings = typeof m.body?.savings === "number" ? Number(m.body.savings) : undefined;
              const need = typeof m.body?.needToSave === "number" ? Number(m.body.needToSave) : undefined;

              return (
                <div
                  key={m.id}
                  style={{
                    background: tint,
                    border: `1px solid ${
                      m.type === "broadcast" ? "rgba(201, 150, 46, 0.3)" : "var(--border-card)"
                    }`,
                    borderLeft: `4px solid ${tm.color}`,
                    borderRadius: "10px",
                    padding: "16px 18px",
                    marginLeft: isResponse ? "28px" : "0",
                  }}
                >
                  {/* Top row: sender → recipient + type + time */}
                  <div className="flex items-center justify-between gap-2" style={{ flexWrap: "wrap" }}>
                    <div className="flex items-center gap-2.5" style={{ flexWrap: "wrap" }}>
                      <span
                        className="flex items-center gap-1.5"
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-card)",
                          borderRadius: "999px",
                          padding: "4px 11px 4px 9px",
                        }}
                      >
                        <SenderIcon size={15} style={{ color: sender.color }} />
                        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {sender.label}
                        </span>
                      </span>
                      <ArrowRight size={15} style={{ color: tm.color }} />
                      <span
                        className="flex items-center gap-1.5"
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-card)",
                          borderRadius: "999px",
                          padding: "4px 11px 4px 9px",
                        }}
                      >
                        <RecipientIcon size={15} style={{ color: recipient.color }} />
                        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {recipient.label}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1"
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          color: tm.color,
                          background: "color-mix(in srgb, transparent, currentColor 12%)",
                          border: `1px solid ${tm.color}`,
                          borderRadius: "5px",
                          padding: "3px 8px",
                        }}
                      >
                        <TypeIcon size={11} /> {tm.label}
                      </span>
                      <span
                        className="font-mono-geist"
                        style={{ fontSize: "11px", color: "var(--text-muted)" }}
                      >
                        {clockTime(m.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Subject + headline figure */}
                  <div className="flex items-start justify-between gap-3" style={{ marginTop: "12px" }}>
                    {m.subject && (
                      <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.5 }}>
                        {m.subject}
                      </p>
                    )}
                    {savings != null && savings > 0 ? (
                      <span
                        className="flex flex-shrink-0 items-center gap-1"
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--accent-green)",
                          background: "rgba(77, 181, 110, 0.12)",
                          borderRadius: "7px",
                          padding: "5px 10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        − {money(savings, currency)}
                      </span>
                    ) : need != null && m.type === "request" ? (
                      <span
                        className="flex flex-shrink-0 items-center gap-1"
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--accent-coral)",
                          background: "rgba(232, 93, 62, 0.12)",
                          borderRadius: "7px",
                          padding: "5px 10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        save {money(need, currency)}
                      </span>
                    ) : null}
                  </div>

                  {/* Detail rows */}
                  {details.length > 0 && (
                    <div
                      style={{
                        marginTop: "12px",
                        display: "grid",
                        gridTemplateColumns: "minmax(120px, auto) 1fr",
                        gap: "8px 18px",
                        borderTop: "1px solid var(--border-divider)",
                        paddingTop: "12px",
                      }}
                    >
                      {details.map((d, i) => (
                        <div key={i} style={{ display: "contents" }}>
                          <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                            {d.label}
                          </span>
                          <span
                            className="font-mono-geist"
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              textAlign: "right",
                              color: d.good ? "var(--accent-green)" : "var(--text-primary)",
                              lineHeight: 1.4,
                            }}
                          >
                            {d.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
