import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getAgentMessages, getContext, getWorkflow } from "@/lib/store";

export const runtime = "nodejs";

// GET /api/workflows/[id]
// Returns the workflow, its shared context, agent runs, approvals and the
// agent-to-agent message log.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const db = getServiceClient();
    const [context, runs, approvals, agentMessages] = await Promise.all([
      getContext(id),
      db
        .from("agent_runs")
        .select()
        .eq("workflow_id", id)
        .order("started_at", { ascending: true }),
      db
        .from("approvals")
        .select()
        .eq("workflow_id", id)
        .order("created_at", { ascending: false }),
      getAgentMessages(id),
    ]);

    return NextResponse.json({
      workflow,
      context,
      agentRuns: runs.data ?? [],
      approvals: approvals.data ?? [],
      agentMessages,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
