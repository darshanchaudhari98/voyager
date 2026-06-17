"use client";

import { useEffect, useState } from "react";
import {
  Plane,
  Building,
  Star,
  Clock,
  Luggage,
  Check,
  Sparkles,
} from "lucide-react";
import type {
  FlightOption,
  HotelOption,
  SharedContext,
  WorkflowRow,
} from "@/lib/types";
import { money } from "@/lib/format";

export function SelectionModal({
  workflow,
  context,
  onSelect,
}: {
  workflow: WorkflowRow;
  context: SharedContext;
  onSelect: (optionId: string) => Promise<void>;
}) {
  const step = workflow.current_agent;
  const isFlight = step === "flight";
  const currency = workflow.request?.currency ?? "INR";

  const flightOptions = context.flight?.options ?? [];
  const hotelOptions = context.hotel?.options ?? [];
  const options: (FlightOption | HotelOption)[] = isFlight
    ? flightOptions
    : hotelOptions;

  // Pre-select the first option. Use a key on the modal itself (step) so the
  // state resets when the modal switches from flight to hotel selection.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => options[0]?.id ?? null
  );
  const [busy, setBusy] = useState(false);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function confirm() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await onSelect(selectedId);
    } finally {
      setBusy(false);
    }
  }

  const Icon = isFlight ? Plane : Building;
  const title = isFlight ? "Select Your Flight" : "Select Your Hotel";
  const subtitle = isFlight
    ? `${flightOptions.length} live options for ${
        workflow.request?.originCode ?? ""
      } → ${workflow.request?.destinationCode ?? ""}`
    : `${hotelOptions.length} live options in ${
        workflow.request?.destinationCity ?? workflow.request?.destination ?? ""
      }`;

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
          maxWidth: "920px",
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
          className="flex items-center justify-between"
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-divider)",
            flexShrink: 0,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "rgba(232, 93, 62, 0.15)",
              }}
            >
              <Icon size={22} style={{ color: "var(--accent-coral)" }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h2>
              <p
                className="font-mono-geist"
                style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}
              >
                {subtitle}
              </p>
            </div>
          </div>
          <span
            className="font-mono-geist flex items-center gap-1.5"
            style={{
              fontSize: "11px",
              color: "var(--accent-green)",
              background: "rgba(77, 181, 110, 0.12)",
              border: "1px solid rgba(77, 181, 110, 0.25)",
              borderRadius: "20px",
              padding: "4px 12px",
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: "6px", height: "6px", background: "var(--accent-green)" }}
            />
            LIVE DATA
          </span>
        </div>

        {/* Options list */}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "16px 24px" }}>
          {options.length === 0 && (
            <p style={{ fontSize: "14px", color: "var(--text-muted)", padding: "24px 0" }}>
              No options were returned.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {isFlight
              ? flightOptions.map((opt, i) => (
                  <FlightCard
                    key={opt.id}
                    opt={opt}
                    currency={currency}
                    selected={selectedId === opt.id}
                    cheapest={i === 0}
                    onClick={() => setSelectedId(opt.id)}
                  />
                ))
              : hotelOptions.map((opt, i) => (
                  <HotelCard
                    key={opt.id}
                    opt={opt}
                    currency={currency}
                    selected={selectedId === opt.id}
                    cheapest={i === 0}
                    onClick={() => setSelectedId(opt.id)}
                  />
                ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-divider)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Select an option to continue the workflow.
          </span>
          <button
            onClick={confirm}
            disabled={!selectedId || busy}
            className="flex items-center gap-2"
            style={{
              background: "var(--accent-coral)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              cursor: !selectedId || busy ? "not-allowed" : "pointer",
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              opacity: !selectedId || busy ? 0.6 : 1,
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (selectedId && !busy) e.currentTarget.style.background = "#f06b4a";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-coral)")}
          >
            <Check size={16} />
            {busy
              ? "Confirming…"
              : `Confirm ${isFlight ? "Flight" : "Hotel"} & Continue`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheapestTag() {
  return (
    <span
      className="font-mono-geist flex items-center gap-1"
      style={{
        fontSize: "10px",
        color: "var(--accent-gold)",
        background: "rgba(201, 150, 46, 0.12)",
        border: "1px solid rgba(201, 150, 46, 0.3)",
        borderRadius: "4px",
        padding: "1px 6px",
      }}
    >
      <Sparkles size={10} /> BEST VALUE
    </span>
  );
}

function cardStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? "rgba(232, 93, 62, 0.08)" : "var(--bg-card)",
    border: `1px solid ${selected ? "var(--accent-coral)" : "var(--border-card)"}`,
    borderRadius: "12px",
    padding: "16px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  };
}

function SelectDot({ selected }: { selected: boolean }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center"
      style={{
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        border: `2px solid ${selected ? "var(--accent-coral)" : "var(--border-divider)"}`,
        background: selected ? "var(--accent-coral)" : "transparent",
      }}
    >
      {selected && <Check size={12} style={{ color: "#fff" }} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span
        className="font-mono-geist"
        style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}
      >
        {label}
      </span>
      <span
        className="font-mono-geist"
        style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "2px" }}
      >
        {value}
      </span>
    </div>
  );
}

function FlightCard({
  opt,
  currency,
  selected,
  cheapest,
  onClick,
}: {
  opt: FlightOption;
  currency: string;
  selected: boolean;
  cheapest: boolean;
  onClick: () => void;
}) {
  return (
    <div style={cardStyle(selected)} onClick={onClick}>
      <div className="flex items-center gap-4">
        <SelectDot selected={selected} />
        <Plane size={18} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)" }}>
              {opt.airline}
            </span>
            {cheapest && <CheapestTag />}
          </div>
          <div
            className="mt-3 grid gap-3"
            style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
          >
            <Field label="Departure" value={opt.departDate} />
            <Field label="Return" value={opt.returnDate} />
            <Field
              label="Duration"
              value={opt.durationHours ? `${opt.durationHours}h` : "—"}
            />
            <Field
              label="Stops"
              value={opt.stops === 0 ? "Non-stop" : `${opt.stops} stop${opt.stops > 1 ? "s" : ""}`}
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="font-mono-geist flex items-center gap-1"
              style={{ fontSize: "11px", color: "var(--text-secondary)" }}
            >
              <Clock size={11} /> {opt.from} → {opt.to}
            </span>
            <span
              className="font-mono-geist flex items-center gap-1"
              style={{ fontSize: "11px", color: "var(--text-secondary)" }}
            >
              <Luggage size={11} />{" "}
              {opt.baggageIncluded ? "Baggage included" : "No baggage"}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end">
          <span
            className="font-mono-geist"
            style={{ fontSize: "18px", fontWeight: 500, color: "var(--accent-gold)" }}
          >
            {money(opt.totalPrice, currency)}
          </span>
          <span
            className="font-mono-geist"
            style={{ fontSize: "10px", color: "var(--text-muted)" }}
          >
            {money(opt.pricePerPerson, currency)} / person
          </span>
        </div>
      </div>
    </div>
  );
}

function HotelCard({
  opt,
  currency,
  selected,
  cheapest,
  onClick,
}: {
  opt: HotelOption;
  currency: string;
  selected: boolean;
  cheapest: boolean;
  onClick: () => void;
}) {
  return (
    <div style={cardStyle(selected)} onClick={onClick}>
      <div className="flex items-center gap-4">
        <SelectDot selected={selected} />
        {opt.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={opt.photo}
            alt={opt.name}
            style={{
              width: "96px",
              height: "72px",
              borderRadius: "8px",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{
              width: "96px",
              height: "72px",
              borderRadius: "8px",
              background: "var(--bg-elevated)",
              flexShrink: 0,
            }}
          >
            <Building size={24} style={{ color: "var(--text-muted)" }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)" }}>
              {opt.name}
            </span>
            {cheapest && <CheapestTag />}
          </div>
          <div className="mt-1 flex items-center gap-1">
            {Array.from({ length: Math.round(opt.rating) }).map((_, i) => (
              <Star
                key={i}
                size={12}
                style={{ color: "var(--accent-gold)", fill: "var(--accent-gold)" }}
              />
            ))}
            {opt.reviewCount ? (
              <span
                className="font-mono-geist ml-1"
                style={{ fontSize: "11px", color: "var(--text-muted)" }}
              >
                ({opt.reviewCount})
              </span>
            ) : null}
          </div>
          <div
            className="mt-3 grid gap-3"
            style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            <Field label="Area" value={opt.area} />
            <Field label="Board" value={opt.board ?? "Room only"} />
            <Field label="Nights" value={String(opt.nights)} />
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end">
          <span
            className="font-mono-geist"
            style={{ fontSize: "18px", fontWeight: 500, color: "var(--accent-gold)" }}
          >
            {money(opt.totalPrice, currency)}
          </span>
          <span
            className="font-mono-geist"
            style={{ fontSize: "10px", color: "var(--text-muted)" }}
          >
            {money(opt.pricePerNight, currency)} / night
          </span>
        </div>
      </div>
    </div>
  );
}
