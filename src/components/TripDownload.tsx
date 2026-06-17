"use client";

import { useState } from "react";
import { FileDown, CheckCircle2 } from "lucide-react";
import type { SharedContext, WorkflowRow } from "@/lib/types";
import { money } from "@/lib/format";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(workflow: WorkflowRow, ctx: SharedContext): string {
  const req = ctx.request ?? workflow.request;
  const cur = req?.currency ?? "INR";
  const flight = ctx.flight?.selected;
  const hotel = ctx.hotel?.selected;
  const b = ctx.budget;
  const it = ctx.itinerary;

  const row = (label: string, value: string) =>
    `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(value)}</td></tr>`;

  const flightBlock = flight
    ? `<section>
        <h2>✈ Flight</h2>
        <table>
          ${row("Airline", flight.airline)}
          ${row("Route", `${flight.from} → ${flight.to}`)}
          ${row("Departure", flight.departDate)}
          ${row("Return", flight.returnDate)}
          ${row("Stops", flight.stops === 0 ? "Non-stop" : `${flight.stops}`)}
          ${row("Duration", flight.durationHours ? `${flight.durationHours}h` : "—")}
          ${row("Baggage", flight.baggageIncluded ? "Included" : "Not included")}
          ${row("Total", money(flight.totalPrice, cur))}
        </table>
      </section>`
    : "";

  const hotelBlock = hotel
    ? `<section>
        <h2>🏨 Hotel</h2>
        <table>
          ${row("Name", hotel.name)}
          ${row("Rating", `${hotel.rating}★${hotel.reviewCount ? ` (${hotel.reviewCount} reviews)` : ""}`)}
          ${row("Area", hotel.area)}
          ${row("Board", hotel.board ?? "Room only")}
          ${row("Nights", String(hotel.nights))}
          ${row("Per night", money(hotel.pricePerNight, cur))}
          ${row("Total", money(hotel.totalPrice, cur))}
        </table>
      </section>`
    : "";

  const budgetBlock = b
    ? `<section>
        <h2>💰 Budget</h2>
        <table>
          ${row("Flights", money(b.flightCost, cur))}
          ${row("Hotel", money(b.hotelCost, cur))}
          ${row("Activities & misc", money(b.miscCost, cur))}
          ${row("Estimated total", money(b.totalCost, cur))}
          ${row("Budget limit", money(b.budget, cur))}
          ${row("Status", b.withinBudget ? "Within budget" : `Over by ${money(b.overage, cur)}`)}
        </table>
      </section>`
    : "";

  const itineraryBlock = it
    ? `<section>
        <h2>🗺 Itinerary</h2>
        <p class="summary">${esc(it.summary)}</p>
        ${it.days
          .map(
            (d) => `
          <div class="day">
            <div class="day-head">
              <span class="day-badge">Day ${d.day}</span>
              <span class="day-title">${esc(d.title)}</span>
              ${
                d.estimatedCost != null
                  ? `<span class="day-cost">~${esc(money(d.estimatedCost, cur))}</span>`
                  : ""
              }
            </div>
            <ul>${d.activities.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
            ${
              d.meals && d.meals.length
                ? `<p class="meals"><strong>Meals:</strong> ${esc(d.meals.join(" · "))}</p>`
                : ""
            }
          </div>`
          )
          .join("")}
        ${
          it.tips.length
            ? `<div class="tips"><h3>Travel Tips</h3><ul>${it.tips
                .map((t) => `<li>${esc(t)}</li>`)
                .join("")}</ul></div>`
            : ""
        }
      </section>`
    : "";

  const generated = new Date().toLocaleString();

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Trip Plan — ${esc(req?.destination ?? "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; }
  .header { border-bottom: 3px solid #e85d3e; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 12px; letter-spacing: 0.15em; color: #e85d3e; font-weight: 700; }
  h1 { font-size: 28px; margin: 6px 0 10px; }
  .meta { color: #555; font-size: 14px; }
  .meta strong { color: #1a1a1a; }
  .budget-hero { font-size: 22px; color: #c9962e; font-weight: 700; margin-top: 8px; }
  section { margin-top: 28px; page-break-inside: avoid; }
  h2 { font-size: 18px; border-left: 4px solid #e85d3e; padding-left: 10px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; border-bottom: 1px solid #eee; font-size: 14px; vertical-align: top; }
  td.lbl { color: #777; text-transform: capitalize; width: 40%; }
  td.val { text-align: right; font-weight: 600; }
  .summary { font-size: 14px; color: #333; line-height: 1.6; background: #faf7f0; padding: 12px 14px; border-radius: 8px; }
  .day { margin: 14px 0; padding: 12px 14px; border: 1px solid #eee; border-radius: 10px; page-break-inside: avoid; }
  .day-head { display: flex; align-items: center; gap: 10px; }
  .day-badge { background: #e85d3e; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; }
  .day-title { font-weight: 700; font-size: 15px; flex: 1; }
  .day-cost { color: #c9962e; font-weight: 700; font-size: 14px; }
  .day ul { margin: 10px 0 6px; padding-left: 20px; }
  .day li { font-size: 13px; color: #333; margin: 4px 0; }
  .meals { font-size: 12px; color: #666; margin: 4px 0 0; }
  .tips { margin-top: 16px; background: #eef4ff; border-radius: 10px; padding: 12px 16px; }
  .tips h3 { font-size: 14px; margin: 0 0 8px; }
  .tips li { font-size: 13px; margin: 4px 0; }
  .footer { margin-top: 36px; border-top: 1px solid #eee; padding-top: 12px; font-size: 11px; color: #999; text-align: center; }
</style></head>
<body>
  <div class="header">
    <div class="brand">VOYAGER · AI TRAVEL AGENT</div>
    <h1>${esc(req?.destination ?? "Trip Plan")}</h1>
    <div class="meta">
      <strong>${esc(req?.days ?? "")}</strong> days ·
      <strong>${esc(req?.travelers ?? "")}</strong> traveler(s) ·
      ${esc(req?.departDate ?? "")} → ${esc(req?.returnDate ?? "")}
    </div>
    <div class="budget-hero">${esc(money(workflow.budget, cur))} budget</div>
  </div>
  ${flightBlock}
  ${hotelBlock}
  ${budgetBlock}
  ${itineraryBlock}
  <div class="footer">Generated by Voyager Control Plane · ${esc(generated)}</div>
</body></html>`;
}

export function TripDownload({
  workflow,
  context,
}: {
  workflow: WorkflowRow;
  context: SharedContext;
}) {
  const [busy, setBusy] = useState(false);

  function download() {
    setBusy(true);
    try {
      const html = buildHtml(workflow, context);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        setBusy(false);
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();

      const finish = () => {
        // Give remote images (hotel photo) a moment, then open the print dialog.
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            setBusy(false);
          }, 500);
        }, 400);
      };
      iframe.onload = finish;
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      className="fade-in flex flex-wrap items-center justify-between gap-4"
      style={{
        marginTop: "32px",
        background:
          "linear-gradient(135deg, rgba(77,181,110,0.10), rgba(201,150,46,0.06))",
        border: "1px solid rgba(77, 181, 110, 0.25)",
        borderRadius: "14px",
        padding: "20px 24px",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex flex-shrink-0 items-center justify-center"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "rgba(77, 181, 110, 0.15)",
          }}
        >
          <CheckCircle2 size={24} style={{ color: "var(--accent-green)" }} />
        </div>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
            Trip Plan Ready
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            All agents completed. Download the full plan with flights, hotel,
            budget &amp; itinerary.
          </p>
        </div>
      </div>

      <button
        onClick={download}
        disabled={busy}
        className="flex items-center gap-2"
        style={{
          background: "var(--accent-coral)",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer",
          padding: "11px 22px",
          borderRadius: "10px",
          border: "none",
          opacity: busy ? 0.6 : 1,
          transition: "background 0.2s ease",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (!busy) e.currentTarget.style.background = "#f06b4a";
        }}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-coral)")}
      >
        <FileDown size={16} />
        {busy ? "Preparing…" : "Download PDF"}
      </button>
    </div>
  );
}
