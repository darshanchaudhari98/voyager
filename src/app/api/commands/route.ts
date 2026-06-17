import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import {
  emitEvent,
  getWorkflow,
  updateWorkflow,
} from "@/lib/store";
import {
  resumeWorkflow,
  runWorkflow,
  submitSelection,
  provideInput,
  acknowledgeBudget,
  autoMatchBudget,
} from "@/lib/orchestrator";
import type { CommandType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID: CommandType[] = [
  "begin_workflow",
  "select_option",
  "provide_input",
  "acknowledge_budget",
  "auto_match_budget",
  "approve",
  "reject",
  "update_budget",
  "restart_workflow",
];

async function resolveApproval(
  workflowId: string,
  resolution: CommandType,
  newBudget?: number
) {
  const db = getServiceClient();
  // Resolve the latest pending approval for this workflow.
  const { data: pending } = await db
    .from("approvals")
    .select("id")
    .eq("workflow_id", workflowId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending) {
    await db
      .from("approvals")
      .update({
        status: resolution === "reject" ? "rejected" : "approved",
        resolution,
        new_budget: newBudget ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", pending.id);
  }

  await emitEvent(workflowId, "approval_received", {
    agent: "approval",
    message: `Approval resolved: ${resolution}${
      newBudget ? ` (new budget ${newBudget})` : ""
    }`,
    payload: { resolution, newBudget },
  });
}

// POST /api/commands
// Body: { workflowId, command, newBudget? }
// command ∈ approve | reject | update_budget | restart_workflow
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workflowId = (body?.workflowId ?? "").toString();
    const command = body?.command as CommandType;
    const newBudget = body?.newBudget ? Number(body.newBudget) : undefined;
    const optionId = body?.optionId ? String(body.optionId) : undefined;
    const departDate = body?.departDate ? String(body.departDate) : undefined;
    const returnDate = body?.returnDate ? String(body.returnDate) : undefined;

    if (!workflowId || !command || !VALID.includes(command)) {
      return NextResponse.json(
        { error: "Provide a valid 'workflowId' and 'command'" },
        { status: 400 }
      );
    }

    const wf = await getWorkflow(workflowId);
    if (!wf) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    switch (command) {
      case "begin_workflow": {
        await runWorkflow(workflowId);
        break;
      }
      case "select_option": {
        if (!optionId) {
          return NextResponse.json(
            { error: "select_option requires an 'optionId'" },
            { status: 400 }
          );
        }
        await submitSelection(workflowId, optionId);
        break;
      }
      case "provide_input": {
        if (!departDate || !returnDate) {
          return NextResponse.json(
            { error: "provide_input requires 'departDate' and 'returnDate'" },
            { status: 400 }
          );
        }
        await provideInput(workflowId, { departDate, returnDate });
        break;
      }
      case "acknowledge_budget": {
        await acknowledgeBudget(workflowId);
        break;
      }
      case "auto_match_budget": {
        if (!newBudget || newBudget <= 0) {
          return NextResponse.json(
            { error: "auto_match_budget requires a positive 'newBudget'" },
            { status: 400 }
          );
        }
        await resolveApproval(workflowId, "update_budget", newBudget);
        await autoMatchBudget(workflowId, newBudget);
        break;
      }
      case "approve": {
        await resolveApproval(workflowId, "approve");
        await resumeWorkflow(workflowId);
        break;
      }
      case "update_budget": {
        if (!newBudget || newBudget <= 0) {
          return NextResponse.json(
            { error: "update_budget requires a positive 'newBudget'" },
            { status: 400 }
          );
        }
        await resolveApproval(workflowId, "update_budget", newBudget);
        await resumeWorkflow(workflowId, { newBudget });
        break;
      }
      case "reject": {
        await resolveApproval(workflowId, "reject");
        await updateWorkflow(workflowId, {
          status: "rejected",
          current_agent: null,
        });
        await emitEvent(workflowId, "workflow_failed", {
          message: "Workflow rejected by user",
          payload: { reason: "rejected" },
        });
        break;
      }
      case "restart_workflow": {
        // Clear prior state and re-run from the top with the original request.
        const db = getServiceClient();
        await db.from("events").delete().eq("workflow_id", workflowId);
        await db.from("agent_runs").delete().eq("workflow_id", workflowId);
        await db.from("approvals").delete().eq("workflow_id", workflowId);
        await db
          .from("shared_context")
          .update({ context: { request: wf.request }, version: 0 })
          .eq("workflow_id", workflowId);
        await updateWorkflow(workflowId, {
          status: "pending",
          current_agent: null,
          total_cost: 0,
          budget: wf.request.budget,
          result: null,
          error: null,
        });
        await emitEvent(workflowId, "workflow_started", {
          message: "Workflow restarted",
        });
        await runWorkflow(workflowId);
        break;
      }
    }

    const updated = await getWorkflow(workflowId);
    return NextResponse.json({ ok: true, workflow: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
