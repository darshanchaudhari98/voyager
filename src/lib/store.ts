import { getServiceClient } from "./supabase/server";
import type {
  AgentMessageRow,
  AgentName,
  AgentRunStatus,
  EventType,
  MessageType,
  SharedContext,
  TravelRequest,
  WorkflowRow,
  WorkflowStatus,
} from "./types";

// =============================================================================
// Store: the single gateway for all writes. Every mutation also emits an event
// where relevant, keeping the event stream the source of truth for observability.
// =============================================================================

export async function createWorkflow(
  prompt: string,
  request: TravelRequest
): Promise<WorkflowRow> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("workflows")
    .insert({
      prompt,
      request,
      status: "pending",
      budget: request.budget,
      total_cost: 0,
    })
    .select()
    .single();
  if (error) throw new Error(`createWorkflow: ${error.message}`);

  // Seed an empty shared context document.
  await db.from("shared_context").insert({
    workflow_id: data.id,
    context: { request },
    version: 0,
  });

  await emitEvent(data.id, "workflow_started", {
    message: `Workflow created for "${request.destination}"`,
    payload: { request },
  });

  return data as WorkflowRow;
}

export async function getWorkflow(id: string): Promise<WorkflowRow | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("workflows")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getWorkflow: ${error.message}`);
  return (data as WorkflowRow) ?? null;
}

export async function updateWorkflow(
  id: string,
  patch: Partial<{
    status: WorkflowStatus;
    current_agent: AgentName | null;
    total_cost: number;
    budget: number;
    request: TravelRequest;
    result: SharedContext | null;
    error: string | null;
  }>
): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("workflows")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`updateWorkflow: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Shared context: read-modify-write with version bump + event emission.
// ---------------------------------------------------------------------------
export async function getContext(workflowId: string): Promise<SharedContext> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("shared_context")
    .select("context")
    .eq("workflow_id", workflowId)
    .maybeSingle();
  if (error) throw new Error(`getContext: ${error.message}`);
  return (data?.context as SharedContext) ?? {};
}

export async function mergeContext(
  workflowId: string,
  patch: Partial<SharedContext>,
  meta: { agent?: AgentName; message?: string } = {}
): Promise<SharedContext> {
  const db = getServiceClient();
  const current = await getContext(workflowId);
  const next = { ...current, ...patch };

  const { data: row } = await db
    .from("shared_context")
    .select("version")
    .eq("workflow_id", workflowId)
    .maybeSingle();
  const version = (row?.version ?? 0) + 1;

  const { error } = await db
    .from("shared_context")
    .update({ context: next, version, updated_at: new Date().toISOString() })
    .eq("workflow_id", workflowId);
  if (error) throw new Error(`mergeContext: ${error.message}`);

  await emitEvent(workflowId, "context_updated", {
    agent: meta.agent,
    message: meta.message ?? "Shared context updated",
    payload: { keys: Object.keys(patch), version },
  });

  return next;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export async function emitEvent(
  workflowId: string,
  type: EventType,
  opts: {
    agent?: AgentName;
    message?: string;
    payload?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("events").insert({
    workflow_id: workflowId,
    type,
    agent: opts.agent ?? null,
    message: opts.message ?? null,
    payload: opts.payload ?? {},
  });
  if (error) throw new Error(`emitEvent: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Agent runs (observability)
// ---------------------------------------------------------------------------
export async function startAgentRun(
  workflowId: string,
  agent: AgentName,
  input: unknown,
  opts: { parallelGroup?: string; setCurrent?: boolean } = {}
): Promise<string> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("agent_runs")
    .insert({
      workflow_id: workflowId,
      agent,
      status: "running",
      input,
      parallel_group: opts.parallelGroup ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`startAgentRun: ${error.message}`);

  // During a parallel fan-out we don't want each agent stomping on
  // `current_agent`; the orchestrator manages workflow status for the group.
  if (opts.setCurrent !== false) {
    await updateWorkflow(workflowId, { current_agent: agent, status: "running" });
  }
  await emitEvent(workflowId, "agent_started", {
    agent,
    message: `${agent} agent started`,
    payload: opts.parallelGroup ? { parallelGroup: opts.parallelGroup } : {},
  });
  return data.id as string;
}

export async function finishAgentRun(
  workflowId: string,
  runId: string,
  agent: AgentName,
  status: AgentRunStatus,
  output: unknown,
  errorMsg?: string
): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("agent_runs")
    .update({
      status,
      output,
      error: errorMsg ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(`finishAgentRun: ${error.message}`);

  await emitEvent(workflowId, "agent_completed", {
    agent,
    message: `${agent} agent ${status}`,
    payload: { status },
  });
}

// ---------------------------------------------------------------------------
// Agent-to-agent (A2A) messaging — a DIRECT, addressed communication channel
// between agents, separate from the shared context. Used for negotiation
// (e.g. Budget asking Flight/Hotel for cheaper options) and fully observable.
// ---------------------------------------------------------------------------
export async function sendAgentMessage(
  workflowId: string,
  msg: {
    sender: AgentName;
    recipient: AgentName | "all";
    type: MessageType;
    subject?: string;
    body?: Record<string, unknown>;
    inReplyTo?: string;
  }
): Promise<string> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("agent_messages")
    .insert({
      workflow_id: workflowId,
      sender: msg.sender,
      recipient: msg.recipient,
      type: msg.type,
      subject: msg.subject ?? null,
      body: msg.body ?? {},
      in_reply_to: msg.inReplyTo ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`sendAgentMessage: ${error.message}`);

  // Surface the exchange on the live event feed too.
  await emitEvent(workflowId, "message_sent", {
    agent: msg.sender,
    message: `${msg.sender} → ${msg.recipient}: ${msg.subject ?? msg.type}`,
    payload: { recipient: msg.recipient, type: msg.type, subject: msg.subject },
  });
  return data.id as string;
}

export async function getAgentMessages(
  workflowId: string
): Promise<AgentMessageRow[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("agent_messages")
    .select()
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getAgentMessages: ${error.message}`);
  return (data as AgentMessageRow[]) ?? [];
}
