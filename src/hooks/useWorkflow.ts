"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AgentMessageRow,
  AgentRunRow,
  ApprovalRow,
  EventRow,
  SharedContext,
  WorkflowRow,
} from "@/lib/types";

export interface WorkflowData {
  workflow: WorkflowRow | null;
  events: EventRow[];
  agentRuns: AgentRunRow[];
  approvals: ApprovalRow[];
  agentMessages: AgentMessageRow[];
  context: SharedContext;
}

const EMPTY: WorkflowData = {
  workflow: null,
  events: [],
  agentRuns: [],
  approvals: [],
  agentMessages: [],
  context: {},
};

/**
 * Loads a workflow's full state and keeps it live via Supabase Realtime.
 * Subscribes to workflows / events / agent_runs / approvals / shared_context
 * filtered to the given workflow id, with no page refresh required.
 */
export function useWorkflow(workflowId: string | null) {
  const [data, setData] = useState<WorkflowData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const refresh = useCallback(async (id: string) => {
    const res = await fetch(`/api/workflows/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const evRes = await fetch(`/api/events/${id}`, { cache: "no-store" });
    const evJson = evRes.ok ? await evRes.json() : { events: [] };
    setData({
      workflow: json.workflow,
      context: json.context ?? {},
      agentRuns: json.agentRuns ?? [],
      approvals: json.approvals ?? [],
      agentMessages: json.agentMessages ?? [],
      events: evJson.events ?? [],
    });
  }, []);

  useEffect(() => {
    if (!workflowId) {
      setData(EMPTY);
      return;
    }

    let cancelled = false;
    setLoading(true);
    refresh(workflowId).finally(() => {
      if (!cancelled) setLoading(false);
    });

    const supabase = supabaseRef.current ?? createClient();
    supabaseRef.current = supabase;
    const filter = `workflow_id=eq.${workflowId}`;

    const channel = supabase
      .channel(`workflow-${workflowId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter },
        (payload) => {
          setData((prev) => {
            const row = payload.new as EventRow;
            if (prev.events.some((e) => e.id === row.id)) return prev;
            return { ...prev, events: [...prev.events, row] };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs", filter },
        () => refresh(workflowId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_messages", filter },
        (payload) => {
          setData((prev) => {
            const row = payload.new as AgentMessageRow;
            if (prev.agentMessages.some((m) => m.id === row.id)) return prev;
            return { ...prev, agentMessages: [...prev.agentMessages, row] };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approvals", filter },
        () => refresh(workflowId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shared_context", filter },
        () => refresh(workflowId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflows", filter: `id=eq.${workflowId}` },
        (payload) => {
          setData((prev) => ({ ...prev, workflow: payload.new as WorkflowRow }));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [workflowId, refresh]);

  return { data, loading, refresh };
}
