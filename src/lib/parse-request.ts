import OpenAI from "openai";
import type { TravelRequest } from "./types";

// =============================================================================
// Prompt -> structured TravelRequest.
//
// Primary path: an LLM extracts the destination (city, ISO-2 country, IATA code)
// and trip parameters from ANY prompt. A deterministic regex heuristic fills in
// anything the LLM misses and serves as a full fallback when no LLM key is set.
// =============================================================================

// --- Heuristic fallback lookup (only a safety net) ---------------------------
const DESTINATION_CODES: Record<
  string,
  { code: string; city: string; country: string; label: string }
> = {
  japan: { code: "TYO", city: "Tokyo", country: "JP", label: "Tokyo, Japan" },
  tokyo: { code: "TYO", city: "Tokyo", country: "JP", label: "Tokyo, Japan" },
  france: { code: "PAR", city: "Paris", country: "FR", label: "Paris, France" },
  paris: { code: "PAR", city: "Paris", country: "FR", label: "Paris, France" },
  thailand: { code: "BKK", city: "Bangkok", country: "TH", label: "Bangkok, Thailand" },
  bangkok: { code: "BKK", city: "Bangkok", country: "TH", label: "Bangkok, Thailand" },
  uae: { code: "DXB", city: "Dubai", country: "AE", label: "Dubai, UAE" },
  dubai: { code: "DXB", city: "Dubai", country: "AE", label: "Dubai, UAE" },
  singapore: { code: "SIN", city: "Singapore", country: "SG", label: "Singapore" },
  bali: { code: "DPS", city: "Denpasar", country: "ID", label: "Bali, Indonesia" },
  indonesia: { code: "DPS", city: "Denpasar", country: "ID", label: "Bali, Indonesia" },
  goa: { code: "GOI", city: "Goa", country: "IN", label: "Goa, India" },
  maldives: { code: "MLE", city: "Male", country: "MV", label: "Maldives" },
  usa: { code: "JFK", city: "New York", country: "US", label: "New York, USA" },
  "new york": { code: "JFK", city: "New York", country: "US", label: "New York, USA" },
  uk: { code: "LON", city: "London", country: "GB", label: "London, UK" },
  london: { code: "LON", city: "London", country: "GB", label: "London, UK" },
  italy: { code: "ROM", city: "Rome", country: "IT", label: "Rome, Italy" },
  rome: { code: "ROM", city: "Rome", country: "IT", label: "Rome, Italy" },
  australia: { code: "SYD", city: "Sydney", country: "AU", label: "Sydney, Australia" },
  sydney: { code: "SYD", city: "Sydney", country: "AU", label: "Sydney, Australia" },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  "₹": "INR",
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
};

function detectCurrency(prompt: string): string {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (prompt.includes(symbol)) return code;
  }
  const codeMatch = prompt.match(/\b(INR|USD|EUR|GBP|AED|SGD|JPY)\b/i);
  if (codeMatch) return codeMatch[1].toUpperCase();
  return "INR";
}

function detectBudget(prompt: string): number {
  const lakh = prompt.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/i);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  const matches = prompt.match(/(?:₹|\$|€|£)?\s*([\d,]+(?:\.\d+)?)/g);
  if (matches) {
    const numbers = matches
      .map((m) => parseFloat(m.replace(/[₹$€£,\s]/g, "")))
      .filter((n) => !Number.isNaN(n) && n >= 1000);
    if (numbers.length) return Math.max(...numbers);
  }
  return 200000;
}

function detectDays(prompt: string): number {
  const m = prompt.match(/(\d+)\s*[-\s]?\s*day/i);
  if (m) return Math.max(1, parseInt(m[1], 10));
  const nights = prompt.match(/(\d+)\s*night/i);
  if (nights) return Math.max(1, parseInt(nights[1], 10) + 1);
  return 5;
}

function detectTravelers(prompt: string): number {
  const m = prompt.match(/(\d+)\s*(?:people|persons?|travel?ers?|pax|adults?|guests?)/i);
  if (m) return Math.max(1, parseInt(m[1], 10));
  if (/\bcouple\b/i.test(prompt)) return 2;
  if (/\bsolo\b/i.test(prompt)) return 1;
  return 2;
}

function detectDestination(prompt: string): {
  code: string;
  city: string;
  country: string;
  label: string;
} | null {
  const lower = prompt.toLowerCase();
  const toMatch = lower.match(/\bto\s+([a-z\s]+?)(?:\s+for|\s+with|\s+in|\s+on|,|\.|$)/);
  if (toMatch) {
    const key = toMatch[1].trim();
    if (DESTINATION_CODES[key]) return DESTINATION_CODES[key];
    for (const [name, val] of Object.entries(DESTINATION_CODES)) {
      if (key.includes(name)) return val;
    }
  }
  for (const [name, val] of Object.entries(DESTINATION_CODES)) {
    if (lower.includes(name)) return val;
  }
  return null;
}

function detectPreferences(prompt: string): string[] {
  const prefs: string[] = [];
  const map: Record<string, RegExp> = {
    luxury: /\bluxur(y|ious)\b/i,
    budget: /\bbudget|cheap|affordable\b/i,
    adventure: /\badventure|hiking|trek\b/i,
    family: /\bfamily|kids|children\b/i,
    food: /\bfood|culinary|cuisine|foodie\b/i,
    culture: /\bculture|history|temples?|museums?\b/i,
    beach: /\bbeach|coast|island\b/i,
    nightlife: /\bnightlife|party|clubs?\b/i,
    relaxation: /\brelax|spa|wellness\b/i,
  };
  for (const [pref, re] of Object.entries(map)) {
    if (re.test(prompt)) prefs.push(pref);
  }
  return prefs;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// --- LLM extraction ----------------------------------------------------------
interface ExtractedFields {
  originCity?: string;
  originCode?: string;
  destinationCity?: string;
  destinationCountry?: string;
  destinationCode?: string;
  destinationLabel?: string;
  days?: number;
  travelers?: number;
  budget?: number;
  currency?: string;
  preferences?: string[];
}

async function extractWithLLM(prompt: string): Promise<ExtractedFields | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://ai-travel-control-plane.vercel.app",
        "X-Title": "AI Travel Agent Control Plane",
      },
    });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You extract structured travel booking parameters from a user's prompt. Use your knowledge of world geography and airport codes. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Extract these fields from the prompt and return STRICT JSON:
{
  "originCity": string,          // departure city; if not stated use "Delhi"
  "originCode": string,          // IATA city/airport code of origin; Delhi -> "DEL"
  "destinationCity": string,     // main destination city (a real city, never a country)
  "destinationCountry": string,  // ISO-2 country code, UPPERCASE
  "destinationCode": string,     // IATA city/metro code of the destination's main airport
  "destinationLabel": string,    // human label e.g. "Bangkok, Thailand"
  "days": number,                // trip length in days (default 5)
  "travelers": number,           // number of people (default 2)
  "budget": number,              // total budget as a plain number, no symbols (default 200000)
  "currency": string,            // ISO currency code; ₹=INR, $=USD, €=EUR, £=GBP (default INR)
  "preferences": string[]        // lowercase keywords: luxury, budget, family, food, culture, beach, adventure, nightlife, relaxation
}
If the prompt names a country (e.g. "Japan"), choose that country's most popular tourist city as destinationCity (e.g. Tokyo) with its IATA code.
Prompt: "${prompt.replace(/"/g, "'")}"`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as ExtractedFields;
  } catch (err) {
    console.error("[parse] LLM extraction failed, using heuristics:", err);
    return null;
  }
}

/**
 * Parse a free-text prompt into a structured TravelRequest. Uses the LLM for
 * destination + parameter extraction (any destination), with regex heuristics
 * as a fallback for missing fields or when no LLM key is configured.
 */
export async function parseTravelRequest(prompt: string): Promise<TravelRequest> {
  // Deterministic baseline.
  const heuristicDest = detectDestination(prompt);
  const base = {
    originCity: "Delhi, India",
    originCode: "DEL",
    days: detectDays(prompt),
    travelers: detectTravelers(prompt),
    budget: detectBudget(prompt),
    currency: detectCurrency(prompt),
    preferences: detectPreferences(prompt),
    destinationCity: heuristicDest?.city ?? "Tokyo",
    destinationCountry: heuristicDest?.country ?? "JP",
    destinationCode: heuristicDest?.code ?? "TYO",
    destinationLabel: heuristicDest?.label ?? "Tokyo, Japan",
  };

  // LLM overlay (preferred for destination).
  const llm = await extractWithLLM(prompt);

  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;

  const destinationCity = str(llm?.destinationCity, base.destinationCity);
  const destinationCountry = str(llm?.destinationCountry, base.destinationCountry)
    .toUpperCase()
    .slice(0, 2);
  const destinationCode = str(llm?.destinationCode, base.destinationCode)
    .toUpperCase()
    .slice(0, 3);
  const destinationLabel = str(
    llm?.destinationLabel,
    `${destinationCity}${destinationCountry ? `, ${destinationCountry}` : ""}`
  );

  const days = num(llm?.days, base.days);
  const travelers = num(llm?.travelers, base.travelers);
  const budget = num(llm?.budget, base.budget);
  const currency = str(llm?.currency, base.currency).toUpperCase();
  const originCity = str(llm?.originCity, "Delhi");
  const originCode = str(llm?.originCode, base.originCode).toUpperCase().slice(0, 3);
  const preferences =
    Array.isArray(llm?.preferences) && llm!.preferences!.length
      ? llm!.preferences!.map((p) => String(p).toLowerCase())
      : base.preferences;

  const depart = new Date();
  depart.setDate(depart.getDate() + 30);
  const ret = new Date(depart);
  ret.setDate(ret.getDate() + days);

  return {
    origin: originCity,
    originCode,
    destination: destinationLabel,
    destinationCode,
    destinationCity,
    destinationCountry,
    days,
    travelers,
    budget,
    currency,
    departDate: isoDate(depart),
    returnDate: isoDate(ret),
    preferences,
  };
}
