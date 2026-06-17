"use client";

import {
  Map,
  Sparkles,
  CalendarDays,
  Wallet,
  UtensilsCrossed,
  Lightbulb,
  MapPin,
  Plane,
  Building,
} from "lucide-react";
import type { BudgetBreakdown, Itinerary } from "@/lib/types";
import { money } from "@/lib/format";

export function ItineraryView({
  itinerary,
  budget,
  currency,
}: {
  itinerary: Itinerary;
  budget?: BudgetBreakdown;
  currency: string;
}) {
  const daysTotal = itinerary.days.reduce(
    (sum, d) => sum + (d.estimatedCost ?? 0),
    0
  );
  const hasCost = daysTotal > 0;
  const grandTotal = budget?.totalCost ?? daysTotal;

  return (
    <div
      className="fade-in"
      style={{
        marginTop: "32px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header banner */}
      <div
        style={{
          padding: "24px 28px",
          borderBottom: "1px solid var(--border-divider)",
          background:
            "linear-gradient(135deg, rgba(201,150,46,0.10), rgba(232,93,62,0.06))",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "rgba(201, 150, 46, 0.15)",
                border: "1px solid rgba(201, 150, 46, 0.3)",
              }}
            >
              <Map size={22} style={{ color: "var(--accent-gold)" }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  lineHeight: 1.2,
                }}
              >
                Your Itinerary
              </h2>
              <span
                className="font-mono-geist flex items-center gap-1.5"
                style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}
              >
                <Sparkles size={11} style={{ color: "var(--accent-gold)" }} />
                AI-generated travel plan
              </span>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex flex-wrap items-center gap-2">
            <StatChip
              icon={CalendarDays}
              label={`${itinerary.days.length} day${itinerary.days.length === 1 ? "" : "s"}`}
            />
            <StatChip
              icon={Wallet}
              label={`Total ~${money(grandTotal, currency)}`}
              accent
            />
          </div>
        </div>

        <p
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginTop: "16px",
            maxWidth: "820px",
          }}
        >
          {itinerary.summary}
        </p>

        {/* Cost breakdown — matches the approved budget */}
        {budget && (
          <div
            className="mt-4 grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
          >
            <CostCard
              icon={Plane}
              label="Flights"
              value={money(budget.flightCost, currency)}
              color="var(--accent-blue)"
            />
            <CostCard
              icon={Building}
              label="Hotel"
              value={money(budget.hotelCost, currency)}
              color="var(--accent-gold)"
            />
            <CostCard
              icon={MapPin}
              label="Activities & meals"
              value={money(hasCost ? daysTotal : budget.miscCost, currency)}
              color="var(--accent-coral)"
            />
            <CostCard
              icon={Wallet}
              label="Approved total"
              value={money(budget.totalCost, currency)}
              color="var(--accent-green)"
              strong
            />
          </div>
        )}
      </div>

      {/* Timeline of days */}
      <div style={{ padding: "24px 28px" }}>
        <div className="flex flex-col">
          {itinerary.days.map((d, idx) => {
            const last = idx === itinerary.days.length - 1;
            return (
              <div key={d.day} className="flex gap-4">
                {/* Timeline rail */}
                <div className="flex flex-col items-center" style={{ width: "44px" }}>
                  <div
                    className="flex flex-shrink-0 flex-col items-center justify-center"
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background:
                        "linear-gradient(135deg, var(--accent-coral), var(--accent-gold))",
                      color: "#fff",
                      boxShadow: "0 4px 14px rgba(232,93,62,0.3)",
                    }}
                  >
                    <span
                      className="font-mono-geist"
                      style={{ fontSize: "9px", opacity: 0.85, lineHeight: 1 }}
                    >
                      DAY
                    </span>
                    <span style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1.1 }}>
                      {d.day}
                    </span>
                  </div>
                  {!last && (
                    <div
                      style={{
                        width: "2px",
                        flex: 1,
                        minHeight: "24px",
                        background:
                          "linear-gradient(var(--border-divider), transparent)",
                        marginTop: "4px",
                      }}
                    />
                  )}
                </div>

                {/* Day card */}
                <div
                  style={{
                    flex: 1,
                    marginBottom: last ? 0 : "16px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-card)",
                    borderRadius: "14px",
                    padding: "18px 20px",
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        lineHeight: 1.3,
                      }}
                    >
                      {d.title}
                    </h3>
                    {d.estimatedCost != null && (
                      <span
                        className="font-mono-geist flex items-center gap-1.5"
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--accent-gold)",
                          background: "rgba(201, 150, 46, 0.12)",
                          border: "1px solid rgba(201, 150, 46, 0.3)",
                          borderRadius: "8px",
                          padding: "5px 12px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Wallet size={13} />~{money(d.estimatedCost, currency)}
                      </span>
                    )}
                  </div>

                  {/* Activities */}
                  <ul className="mt-3 flex flex-col gap-2">
                    {d.activities.map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <MapPin
                          size={14}
                          style={{
                            color: "var(--accent-coral)",
                            flexShrink: 0,
                            marginTop: "3px",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "14px",
                            color: "var(--text-secondary)",
                            lineHeight: 1.5,
                          }}
                        >
                          {a}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Meals */}
                  {d.meals && d.meals.length > 0 && (
                    <div
                      className="mt-3 flex flex-wrap items-center gap-2"
                      style={{
                        borderTop: "1px solid var(--border-divider)",
                        paddingTop: "12px",
                      }}
                    >
                      <UtensilsCrossed
                        size={14}
                        style={{ color: "var(--accent-green)", flexShrink: 0 }}
                      />
                      {d.meals.map((m, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-card)",
                            borderRadius: "6px",
                            padding: "3px 10px",
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips */}
        {itinerary.tips.length > 0 && (
          <div
            className="mt-6"
            style={{
              background: "rgba(96, 165, 250, 0.06)",
              border: "1px solid rgba(96, 165, 250, 0.2)",
              borderRadius: "14px",
              padding: "18px 20px",
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb size={16} style={{ color: "var(--accent-blue)" }} />
              <span
                style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}
              >
                Travel Tips
              </span>
            </div>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
            >
              {itinerary.tips.map((t, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className="flex flex-shrink-0 items-center justify-center"
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "rgba(96, 165, 250, 0.15)",
                      color: "var(--accent-blue)",
                      fontSize: "10px",
                      fontWeight: 700,
                      marginTop: "1px",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      className="font-mono-geist flex items-center gap-1.5"
      style={{
        fontSize: "12px",
        fontWeight: 500,
        color: accent ? "var(--accent-gold)" : "var(--text-secondary)",
        background: accent ? "rgba(201, 150, 46, 0.12)" : "var(--bg-elevated)",
        border: `1px solid ${accent ? "rgba(201, 150, 46, 0.3)" : "var(--border-card)"}`,
        borderRadius: "20px",
        padding: "6px 14px",
      }}
    >
      <Icon size={13} />
      {label}
    </span>
  );
}

function CostCard({
  icon: Icon,
  label,
  value,
  color,
  strong = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        background: strong ? "rgba(77, 181, 110, 0.08)" : "var(--bg-elevated)",
        border: `1px solid ${strong ? "rgba(77, 181, 110, 0.25)" : "var(--border-card)"}`,
        borderRadius: "12px",
        padding: "12px 14px",
      }}
    >
      <span
        className="flex items-center gap-1.5"
        style={{ fontSize: "11px", color: "var(--text-muted)" }}
      >
        <Icon size={13} style={{ color }} />
        {label}
      </span>
      <p
        className="font-mono-geist"
        style={{
          fontSize: strong ? "18px" : "16px",
          fontWeight: 600,
          color: strong ? "var(--accent-green)" : "var(--text-primary)",
          marginTop: "4px",
        }}
      >
        {value}
      </p>
    </div>
  );
}
