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
  | "activity"
  | "weather"
  | "transport"
  | "insights"
  | "budget"
  | "approval"
  | "itinerary";

export type AgentRunStatus = "running" | "completed" | "failed" | "skipped";

export type EventType =
  | "workflow_started"
  | "agent_started"
  | "agent_completed"
  | "context_updated"
  | "parallel_started"
  | "parallel_completed"
  | "message_sent"
  | "selection_required"
  | "selection_received"
  | "input_required"
  | "input_received"
  | "budget_review_required"
  | "approval_required"
  | "approval_received"
  | "workflow_completed"
  | "workflow_failed";

// Direct agent-to-agent message channel (distinct from shared context).
export type MessageType = "request" | "response" | "broadcast" | "info";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type CommandType =
  | "begin_workflow"
  | "select_option"
  | "provide_input"
  | "acknowledge_budget"
  | "auto_match_budget"
  | "change_preferences"
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
  preferredAirline?: string; // e.g. "Emirates" — honored by the Flight Agent
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
  activityCost: number;
  transportCost: number;
  miscCost: number;
  onGroundCost: number; // activity + transport + misc (used to size the itinerary)
  totalCost: number;
  budget: number;
  overage: number;
  withinBudget: boolean;
  currency: string;
}

// --- Activity Agent ---------------------------------------------------------
export interface ActivityItem {
  id: string;
  name: string;
  category: string; // sightseeing | food | adventure | culture | relaxation | nightlife
  cost: number; // total for the whole group
  optional: boolean; // optional items can be dropped during negotiation
  currency: string;
}

export interface ActivityPlan {
  items: ActivityItem[];
  totalCost: number;
  droppedCount: number; // how many optional items negotiation has removed
  currency: string;
  generatedBy: string;
}

// --- Transport Agent --------------------------------------------------------
export interface TransportOption {
  id: string;
  mode: string; // metro pass | car rental | private transfer | taxi | bus pass
  description: string;
  cost: number; // total for the trip
  currency: string;
}

export interface TransportPlan {
  selected: TransportOption;
  options: TransportOption[];
  generatedBy: string;
}

// --- Weather Agent ----------------------------------------------------------
export interface WeatherForecast {
  summary: string;
  season: string;
  tempRange: string; // e.g. "12–19°C"
  conditions: string;
  packing: string[];
  generatedBy: string;
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

// Produced by the Insights Agent (runs in parallel with flight/hotel).
export interface DestinationInsights {
  bestAreas: string[];
  gettingAround: string;
  safety: string;
  seasonalNote: string;
  mustTry: string[];
  generatedBy: string;
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
  activity?: ActivityPlan;
  transport?: TransportPlan;
  weather?: WeatherForecast;
  insights?: DestinationInsights;
  negotiation?: {
    triggered: boolean;
    rounds: number;
    savings: number;
    summary: string;
    applied: string[]; // which agents contributed savings, e.g. ["flight","activity"]
  } | null;
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
  parallel_group: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface AgentMessageRow {
  id: string;
  workflow_id: string;
  sender: AgentName;
  recipient: AgentName | "all";
  type: MessageType;
  subject: string | null;
  body: Record<string, unknown>;
  in_reply_to: string | null;
  created_at: string;
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
