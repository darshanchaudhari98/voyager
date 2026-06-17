import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/events/[workflowId]
// Returns the append-only event stream for a workflow (newest last).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params;
    const db = getServiceClient();
    const { data, error } = await db
      .from("events")
      .select()
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
