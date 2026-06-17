"use client";

import { useCallback, useState } from "react";
import { useWorkflow } from "@/hooks/useWorkflow";
import type { CommandType } from "@/lib/types";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";
import { NewWorkflowForm } from "./NewWorkflowForm";
import { TripSummary } from "./TripSummary";
import { AgentCards } from "./AgentCards";
import { ApprovalPanel } from "./ApprovalPanel";
import { SelectionModal } from "./SelectionModal";
import { InputModal } from "./InputModal";
import { BudgetReviewModal } from "./BudgetReviewModal";
import { ActivityFeed } from "./ActivityFeed";
import { SharedContextPanel } from "./SharedContextPanel";
import { ItineraryView } from "./ItineraryView";
import { TripDownload } from "./TripDownload";
import { Footer } from "./Footer";

export function Dashboard() {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const { data, refresh } = useWorkflow(workflowId);

  const handleCreated = useCallback(
    async (id: string) => {
      setWorkflowId(id);
      // Kick off the pipeline now that the dashboard is subscribed, so the
      // Flight Agent's running phase is visible before the selection modal.
      await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: id, command: "begin_workflow" }),
      });
      await refresh(id);
    },
    [refresh]
  );

  const handleCommand = useCallback(
    async (command: CommandType, newBudget?: number) => {
      if (!workflowId) return;
      await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, command, newBudget }),
      });
      await refresh(workflowId);
    },
    [workflowId, refresh]
  );

  const handleSelect = useCallback(
    async (optionId: string) => {
      if (!workflowId) return;
      await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, command: "select_option", optionId }),
      });
      await refresh(workflowId);
    },
    [workflowId, refresh]
  );

  const handleProvideInput = useCallback(
    async (departDate: string, returnDate: string) => {
      if (!workflowId) return;
      await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          command: "provide_input",
          departDate,
          returnDate,
        }),
      });
      await refresh(workflowId);
    },
    [workflowId, refresh]
  );

  const handleAcknowledgeBudget = useCallback(async () => {
    if (!workflowId) return;
    await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, command: "acknowledge_budget" }),
    });
    await refresh(workflowId);
  }, [workflowId, refresh]);

  const { workflow, context, events, agentRuns, approvals } = data;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <TopNav workflow={workflow} />
      <Sidebar workflow={workflow} agentRuns={agentRuns} />

      <main
        className="app-main"
        style={{ marginLeft: "260px", padding: "32px", paddingTop: "92px" }}
      >
        <NewWorkflowForm onCreated={handleCreated} />

        {workflow && (
          <button
            onClick={() => handleCommand("restart_workflow")}
            className="font-mono-geist"
            style={{
              marginTop: "16px",
              fontSize: "11px",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-card)",
              borderRadius: "6px",
              padding: "6px 12px",
              cursor: "pointer",
              background: "transparent",
            }}
          >
            ⟲ Restart Workflow
          </button>
        )}

        {!workflow ? (
          <div
            className="fade-in"
            style={{
              marginTop: "32px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "12px",
              padding: "64px 24px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "18px",
                fontWeight: 500,
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              No active workflow
            </p>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                maxWidth: "440px",
                margin: "0 auto",
                lineHeight: 1.5,
              }}
            >
              Launch a plan above and approve each task as the Flight, Hotel,
              Budget, Approval and Itinerary agents execute over a shared
              context with live events.
            </p>
          </div>
        ) : (
          <div className="fade-in" style={{ marginTop: "24px" }}>
            <TripSummary
              workflow={workflow}
              context={context}
              agentRuns={agentRuns}
            />

            <AgentCards
              workflow={workflow}
              agentRuns={agentRuns}
              context={context}
            />

            <div
              className="two-column-grid grid gap-8"
              style={{ marginTop: "32px", gridTemplateColumns: "1fr 1fr" }}
            >
              <ActivityFeed events={events} />
              <SharedContextPanel context={context} />
            </div>

            {workflow.status === "completed" && (
              <TripDownload workflow={workflow} context={context} />
            )}

            {context.itinerary && (
              <ItineraryView
                itinerary={context.itinerary}
                budget={context.budget}
                currency={workflow.request?.currency ?? "INR"}
              />
            )}
          </div>
        )}

        <Footer workflow={workflow} />
      </main>

      {workflow &&
        workflow.status === "awaiting_selection" &&
        ((workflow.current_agent === "flight" &&
          (context.flight?.options?.length ?? 0) > 0) ||
          (workflow.current_agent === "hotel" &&
            (context.hotel?.options?.length ?? 0) > 0)) && (
          <SelectionModal
            key={workflow.current_agent}
            workflow={workflow}
            context={context}
            onSelect={handleSelect}
          />
        )}

      {workflow && workflow.status === "awaiting_input" && (
        <InputModal
          workflow={workflow}
          context={context}
          onSubmit={handleProvideInput}
        />
      )}

      {workflow && workflow.status === "awaiting_budget_review" && context.budget && (
        <BudgetReviewModal
          workflow={workflow}
          context={context}
          onContinue={handleAcknowledgeBudget}
        />
      )}

      {workflow && workflow.status === "awaiting_approval" && (
        <ApprovalPanel
          workflow={workflow}
          approvals={approvals}
          context={context}
          onCommand={handleCommand}
        />
      )}
    </div>
  );
}
