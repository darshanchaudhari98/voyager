// =============================================================================
// Shared domain types for the AI Travel Agent Control Plane
// =============================================================================

export type WorkflowStatus =
  | "pending"
  | "running"
  | "awaiting_selection"
  | "awaiting_input"
  | "awaiting_budget_review"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "rejected";

export type AgentName =
  | "flight"
  | "hotel"
  | "budget"
  | "approval"
  | "itinerary";

export type AgentRunStatus = "running" | "completed" | "failed" | "skipped";

export type EventType =
  | "workflow_started"
  | "agent_started"
  | "agent_completed"
  | "context_updated"
  | "selection_required"
  | "selection_received"
  | "input_required"
  | "input_received"
  | "budget_review_required"
  | "approval_required"
  | "approval_received"
  | "workflow_completed"
  | "workflow_failed";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type CommandType =
  | "begin_workflow"
  | "select_option"
  | "provide_input"
  | "acknowledge_budget"
  | "auto_match_budget"
  | "approve"
  | "reject"
  | "update_budget"
  | "restart_workflow";

// ---------------------------------------------------------------------------
// Parsed travel request
// ---------------------------------------------------------------------------
export interface TravelRequest {
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string; // IATA / metro code (e.g. TYO)
  destinationCity: string; // City name for hotel search (e.g. Tokyo)
  destinationCountry: string; // ISO-2 country code (e.g. JP)
  days: number;
  travelers: number;
  budget: number;
  currency: string;
  departDate: string; // ISO yyyy-mm-dd
  returnDate: string; // ISO yyyy-mm-dd
  preferences: string[];
}

export type DataSource = "liteapi";

// ---------------------------------------------------------------------------
// Agent result shapes (stored in shared context)
// ---------------------------------------------------------------------------
export interface FlightOption {
  id: string;
  airline: string;
  from: string;
  to: string;
  departDate: string;
  returnDate: string;
  stops: number;
  durationHours: number;
  pricePerPerson: number;
  totalPrice: number;
  currency: string;
  baggageIncluded?: boolean;
  source: DataSource;
}

export interface HotelOption {
  id: string;
  name: string;
  area: string;
  rating: number;
  reviewCount?: number;
  photo?: string;
  board?: string;
  pricePerNight: number;
  nights: number;
  totalPrice: number;
  currency: string;
  source: DataSource;
}

export interface BudgetBreakdown {
  flightCost: number;
  hotelCost: number;
  miscCost: number;
  totalCost: number;
  budget: number;
  overage: number;
  withinBudget: boolean;
  currency: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
  meals?: string[];
  estimatedCost?: number;
}

export interface Itinerary {
  summary: string;
  days: ItineraryDay[];
  tips: string[];
  generatedBy: string; // model identifier, e.g. "openai/gpt-4o-mini"
}

// ---------------------------------------------------------------------------
// Shared context — the single document every agent reads/writes
// ---------------------------------------------------------------------------
export interface SharedContext {
  request?: TravelRequest;
  flight?: {
    selected: FlightOption;
    options: FlightOption[];
  };
  hotel?: {
    selected: HotelOption;
    options: HotelOption[];
  };
  budget?: BudgetBreakdown;
  approval?: {
    required: boolean;
    resolution?: "approve" | "reject" | "update_budget";
    newBudget?: number;
  };
  inputRequest?: {
    agent: AgentName;
    kind: "dates";
    message: string;
  } | null;
  autoMatch?: {
    applied: boolean;
    message: string;
    targetBudget: number;
    previousTotal: number;
    newTotal: number;
    withinBudget: boolean;
  } | null;
  itinerary?: Itinerary;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------
export interface WorkflowRow {
  id: string;
  prompt: string;
  request: TravelRequest;
  status: WorkflowStatus;
  current_agent: AgentName | null;
  budget: number;
  total_cost: number;
  result: SharedContext | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  workflow_id: string;
  type: EventType;
  agent: AgentName | null;
  message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AgentRunRow {
  id: string;
  workflow_id: string;
  agent: AgentName;
  status: AgentRunStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface ApprovalRow {
  id: string;
  workflow_id: string;
  status: ApprovalStatus;
  reason: string | null;
  budget: number | null;
  total_cost: number | null;
  overage: number | null;
  resolution: CommandType | null;
  new_budget: number | null;
  created_at: string;
  resolved_at: string | null;
}

export interface SharedContextRow {
  workflow_id: string;
  context: SharedContext;
  version: number;
  updated_at: string;
}
