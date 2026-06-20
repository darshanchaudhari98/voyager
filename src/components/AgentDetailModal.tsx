"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plane,
  Building,
  Ticket,
  CloudSun,
  Bus,
  Compass,
  Calculator,
  ShieldCheck,
  Map,
  Check,
  Star,
  CircleDot,
  ListFilter,
} from "lucide-react";
import type { AgentName, SharedContext } from "@/lib/types";
import { money } from "@/lib/format";

const META: Record<AgentName, { name: string; icon: React.ElementType; color: string }> = {
  flight: { name: "Flight Agent", icon: Plane, color: "var(--accent-blue)" },
  hotel: { name: "Hotel Agent", icon: Building, color: "var(--accent-gold)" },
  activity: { name: "Activity Agent", icon: Ticket, color: "var(--accent-coral)" },
  weather: { name: "Weather Agent", icon: CloudSun, color: "var(--status-waiting)" },
  transport: { name: "Transport Agent", icon: Bus, color: "var(--accent-green)" },
  insights: { name: "Insights Agent", icon: Compass, color: "var(--accent-blue)" },
  budget: { name: "Budget Agent", icon: Calculator, color: "var(--accent-green)" },
  approval: { name: "Approval Agent", icon: ShieldCheck, color: "var(--status-waiting)" },
  itinerary: { name: "Itinerary Agent", icon: Map, color: "var(--accent-coral)" },
};

export function AgentDetailModal({
  agent,
  context,
  currency,
  onClose,
  onSelectOption,
}: {
  agent: AgentName;
  context: SharedContext;
  currency: string;
  onClose: () => void;
  onSelectOption: (kind: "flight" | "hotel", optionId: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const m = META[agent];
  const Icon = m.icon;

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function choose(kind: "flight" | "hotel", id: string) {
    setBusyId(id);
    try {
      await onSelectOption(kind, id);
      onClose();
    } finally {
      setBusyId(null);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        className="fade-in flex flex-col"
        style={{
          width: "100%",
          maxWidth: "660px",
          maxHeight: "88vh",
          background: "#141414",
          border: "1px solid var(--border-card)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-divider)", flexShrink: 0 }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: "38px", height: "38px", borderRadius: "10px", background: "var(--bg-elevated)" }}
            >
              <Icon size={20} style={{ color: m.color }} />
            </div>
            <div>
              <h2 style={{ fontSize: "19px", fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Full agent output</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid var(--border-card)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "22px" }}>
          <Body agent={agent} context={context} currency={currency} busyId={busyId} onChoose={choose} />
        </div>
      </div>
    </div>,
    document.body
  );
}

function Body({
  agent,
  context,
  currency,
  busyId,
  onChoose,
}: {
  agent: AgentName;
  context: SharedContext;
  currency: string;
  busyId: string | null;
  onChoose: (kind: "flight" | "hotel", id: string) => void;
}) {
  const [showOptions, setShowOptions] = useState(false);

  switch (agent) {
    case "flight": {
      const f = context.flight;
      if (!f) return <Empty label="No flight options yet." />;
      const s = f.selected;
      return (
        <>
          <SectionTitle>Recommended flight</SectionTitle>
          <div style={{ ...rowStyle, marginBottom: "14px" }}>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>{s.airline}</p>
            <KV label="Route" value={`${s.from} → ${s.to}`} />
            <KV label="Stops" value={s.stops === 0 ? "Non-stop" : `${s.stops} stop(s)`} />
            {s.durationHours ? <KV label="Duration" value={`${s.durationHours}h`} /> : null}
            <KV label="Baggage" value={s.baggageIncluded ? "Included" : "Not included"} />
            <KV label="Price (total)" value={money(s.totalPrice, s.currency)} strong />
          </div>

          <MoreOptionsToggle
            open={showOptions}
            count={f.options.length}
            label="flights"
            onToggle={() => setShowOptions((v) => !v)}
          />

          {showOptions && (
            <div className="flex flex-col gap-2" style={{ marginTop: "12px" }}>
              {f.options.map((o) => (
                <OptionRow
                  key={o.id}
                  selected={o.id === f.selected.id}
                  busy={busyId === o.id}
                  onChoose={() => onChoose("flight", o.id)}
                  title={o.airline}
                  meta={`${o.from} → ${o.to} · ${o.stops === 0 ? "non-stop" : `${o.stops} stop(s)`}${
                    o.durationHours ? ` · ${o.durationHours}h` : ""
                  }${o.baggageIncluded ? " · baggage" : ""}`}
                  price={money(o.totalPrice, o.currency)}
                />
              ))}
            </div>
          )}
        </>
      );
    }
    case "hotel": {
      const h = context.hotel;
      if (!h) return <Empty label="No hotel options yet." />;
      const s = h.selected;
      return (
        <>
          <SectionTitle>Recommended hotel</SectionTitle>
          <div style={{ ...rowStyle, marginBottom: "14px" }}>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</p>
            <KV label="Rating" value={`${s.rating}★${s.reviewCount ? ` (${s.reviewCount} reviews)` : ""}`} />
            <KV label="Area" value={s.area} />
            <KV label="Board" value={s.board ?? "Room only"} />
            <KV label="Per night" value={money(s.pricePerNight, s.currency)} />
            <KV label="Nights" value={String(s.nights)} />
            <KV label="Price (total)" value={money(s.totalPrice, s.currency)} strong />
          </div>

          <MoreOptionsToggle
            open={showOptions}
            count={h.options.length}
            label="hotels"
            onToggle={() => setShowOptions((v) => !v)}
          />

          {showOptions && (
            <div className="flex flex-col gap-2" style={{ marginTop: "12px" }}>
              {h.options.map((o) => (
                <OptionRow
                  key={o.id}
                  selected={o.id === h.selected.id}
                  busy={busyId === o.id}
                  onChoose={() => onChoose("hotel", o.id)}
                  title={o.name}
                  meta={`${o.rating}★${o.reviewCount ? ` (${o.reviewCount})` : ""} · ${o.area} · ${
                    o.board ?? "Room only"
                  } · ${money(o.pricePerNight, o.currency)}/night`}
                  price={money(o.totalPrice, o.currency)}
                />
              ))}
            </div>
          )}
        </>
      );
    }
    case "activity": {
      const a = context.activity;
      if (!a) return <Empty label="No activities yet." />;
      return (
        <>
          <SectionTitle>Recommended activities — total {money(a.totalCost, a.currency)}</SectionTitle>
          <div className="flex flex-col gap-2">
            {a.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between" style={rowStyle}>
                <div className="min-w-0">
                  <p style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>{it.name}</p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {it.category}
                    {it.optional ? " · optional" : " · core"}
                  </p>
                </div>
                <span className="font-mono-geist" style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                  {money(it.cost, it.currency)}
                </span>
              </div>
            ))}
          </div>
          {a.droppedCount > 0 && (
            <p style={{ fontSize: "13px", color: "var(--accent-coral)", marginTop: "10px" }}>
              {a.droppedCount} optional activit{a.droppedCount === 1 ? "y" : "ies"} dropped during negotiation.
            </p>
          )}
        </>
      );
    }
    case "transport": {
      const t = context.transport;
      if (!t) return <Empty label="No transport options yet." />;
      return (
        <>
          <SectionTitle>Transport options (selected: {t.selected.mode})</SectionTitle>
          <div className="flex flex-col gap-2">
            {t.options.map((o) => {
              const selected = o.id === t.selected.id;
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between"
                  style={{ ...rowStyle, borderColor: selected ? "var(--accent-green)" : "var(--border-card)" }}
                >
                  <div className="min-w-0">
                    <p style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>
                      {o.mode} {selected && <span style={{ color: "var(--accent-green)", fontSize: "12px" }}>· selected</span>}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{o.description}</p>
                  </div>
                  <span className="font-mono-geist" style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                    {money(o.cost, o.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      );
    }
    case "weather": {
      const w = context.weather;
      if (!w) return <Empty label="No weather outlook yet." />;
      return (
        <>
          <p style={{ fontSize: "15px", color: "var(--text-primary)", lineHeight: 1.6, marginBottom: "14px" }}>{w.summary}</p>
          <KV label="Season" value={w.season} />
          <KV label="Temperature" value={w.tempRange} />
          <KV label="Conditions" value={w.conditions} />
          <SectionTitle style={{ marginTop: "16px" }}>What to pack</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {w.packing.map((p, i) => (
              <li key={i} style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>{p}</li>
            ))}
          </ul>
        </>
      );
    }
    case "insights": {
      const i = context.insights;
      if (!i) return <Empty label="No insights yet." />;
      return (
        <>
          <SectionTitle>Best areas</SectionTitle>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "12px" }}>
            {i.bestAreas.join(" · ")}
          </p>
          <KV label="Getting around" value={i.gettingAround} block />
          <KV label="Safety" value={i.safety} block />
          <KV label="Season note" value={i.seasonalNote} block />
          <SectionTitle style={{ marginTop: "16px" }}>Must try</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {i.mustTry.map((p, idx) => (
              <li key={idx} style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>{p}</li>
            ))}
          </ul>
        </>
      );
    }
    case "budget": {
      const b = context.budget;
      if (!b) return <Empty label="Budget not computed yet." />;
      return (
        <>
          <SectionTitle>Cost breakdown</SectionTitle>
          <KV label="Flights" value={money(b.flightCost, currency)} />
          <KV label="Hotel" value={money(b.hotelCost, currency)} />
          <KV label="Activities" value={money(b.activityCost, currency)} />
          <KV label="Transport" value={money(b.transportCost, currency)} />
          <KV label="Food & misc" value={money(b.miscCost, currency)} />
          <div style={{ height: "1px", background: "var(--border-divider)", margin: "12px 0" }} />
          <KV label="Total" value={money(b.totalCost, currency)} strong />
          <KV label="Budget" value={money(b.budget, currency)} />
          <KV
            label={b.withinBudget ? "Headroom" : "Over budget by"}
            value={money(b.withinBudget ? b.budget - b.totalCost : b.overage, currency)}
            color={b.withinBudget ? "var(--accent-green)" : "var(--accent-coral)"}
            strong
          />
        </>
      );
    }
    case "itinerary": {
      const it = context.itinerary;
      if (!it) return <Empty label="Itinerary is generated after you approve the plan." />;
      return (
        <>
          <p style={{ fontSize: "15px", color: "var(--text-primary)", lineHeight: 1.6, marginBottom: "14px" }}>{it.summary}</p>
          <div className="flex flex-col gap-2">
            {it.days.map((d) => (
              <div key={d.day} style={rowStyle}>
                <p style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>
                  Day {d.day}: {d.title}
                  {d.estimatedCost != null && (
                    <span className="font-mono-geist" style={{ float: "right", color: "var(--accent-gold)", fontSize: "13px" }}>
                      {money(d.estimatedCost, currency)}
                    </span>
                  )}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginTop: "4px" }}>
                  {d.activities.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </>
      );
    }
    case "approval": {
      return <Empty label="The Approval Agent is a human gate — review and approve the plan in the approval panel." />;
    }
    default:
      return <Empty label="No details available." />;
  }
}

const rowStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-card)",
  borderRadius: "10px",
  padding: "12px 14px",
};

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="font-mono-geist"
      style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px", ...style }}
    >
      {children}
    </p>
  );
}

function KV({
  label,
  value,
  strong,
  color,
  block,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
  block?: boolean;
}) {
  if (block) {
    return (
      <div style={{ marginBottom: "10px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "2px" }}>{label}</p>
        <p style={{ fontSize: "14px", color: color ?? "var(--text-primary)", lineHeight: 1.55 }}>{value || "—"}</p>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between" style={{ padding: "6px 0" }}>
      <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{label}</span>
      <span
        className="font-mono-geist"
        style={{ fontSize: "14px", fontWeight: strong ? 700 : 500, color: color ?? "var(--text-primary)" }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function OptionRow({
  selected,
  busy,
  onChoose,
  title,
  meta,
  price,
}: {
  selected: boolean;
  busy: boolean;
  onChoose: () => void;
  title: string;
  meta: string;
  price: string;
}) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        background: selected ? "rgba(77, 181, 110, 0.08)" : "var(--bg-card)",
        border: `1px solid ${selected ? "rgba(77, 181, 110, 0.4)" : "var(--border-card)"}`,
        borderRadius: "10px",
        padding: "12px 14px",
      }}
    >
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>{title}</p>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{meta}</p>
      </div>
      <span className="font-mono-geist flex-shrink-0" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
        {price}
      </span>
      {selected ? (
        <span
          className="flex flex-shrink-0 items-center gap-1"
          style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-green)" }}
        >
          <Check size={14} /> Selected
        </span>
      ) : (
        <button
          onClick={onChoose}
          disabled={busy}
          className="flex flex-shrink-0 items-center gap-1.5"
          style={{
            background: "var(--accent-coral)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "7px 14px",
            fontSize: "12.5px",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? <CircleDot size={13} /> : <Star size={13} />}
          {busy ? "Applying…" : "Choose"}
        </button>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{label}</p>
  );
}

function MoreOptionsToggle({
  open,
  count,
  label,
  onToggle,
}: {
  open: boolean;
  count: number;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2"
      style={{
        background: open ? "var(--bg-elevated)" : "transparent",
        border: "1px solid var(--border-card)",
        color: "var(--text-primary)",
        borderRadius: "8px",
        padding: "9px 14px",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        width: "100%",
        justifyContent: "center",
      }}
    >
      <ListFilter size={15} />
      {open ? "Hide options" : `More options — choose from ${count} ${label}`}
    </button>
  );
}
