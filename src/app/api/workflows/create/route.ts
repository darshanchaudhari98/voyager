import { NextRequest, NextResponse } from "next/server";
import { parseTravelRequest } from "@/lib/parse-request";
import { createWorkflow } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/workflows/create
// Body: { prompt: string }
// Creates the workflow (status: pending) and returns immediately. The client
// then triggers the pipeline via the `begin_workflow` command, so the dashboard
// can subscribe first and watch the Flight Agent initialize → run → present
// options live (instead of jumping straight to the selection modal).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = (body?.prompt ?? "").toString().trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing 'prompt' in request body" },
        { status: 400 }
      );
    }

    const request = await parseTravelRequest(prompt);
    const workflow = await createWorkflow(prompt, request);

    return NextResponse.json({ workflowId: workflow.id, request }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
