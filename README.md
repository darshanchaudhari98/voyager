# AI Travel Agent Control Plane

A multi-agent orchestration platform that plans trips end-to-end. Enter a
request like:

> Plan a 5-day trip to Japan for 2 people with a budget of ₹200,000

…and a sequential pipeline of agents executes over a **shared context**, with a
**human-in-the-loop approval gate**, full **agent observability**, and a
**live, event-driven dashboard** powered by Supabase Realtime.

This is an *Agent Control Plane*, not a chatbot.

---

## Architecture

```
prompt ─▶ parse ─▶ create workflow + shared_context
                         │
   ┌──────────── RESEARCH PHASE — all six planning agents in parallel ───────────┐
   │  Flight ║ Hotel ║ Activity ║ Weather ║ Transport ║ Insights                  │
   │  each autonomously finds & recommends its best option → shared context        │
   └────────────────────────────────────┬──────────────────────────────────────────┘
                                         ▼
                                   Budget Agent  (combines plan, computes total)
                                         │
                                         ▼  if over budget
        ┌──────── A2A NEGOTIATION (direct messages, up to 3 rounds) ────────┐
        │ Budget ⇄ Flight     cheaper flight                                 │
        │ Budget ⇄ Hotel      cheaper hotel                                  │
        │ Budget ⇄ Activity   drop optional activities                      │
        │ Budget ⇄ Transport  cheaper transport                            │
        └────────────────────────────────┬────────────────────────────────────┘
                                         ▼
   AWAITING APPROVAL — optimized plan + total + reasoning shown to the operator,
        who can: approve · reject · modify budget · change preferences (prompt)
        │   changing preferences re-runs ONLY the affected agents, then re-optimizes
        ▼  approve
   Itinerary Agent ─▶ completed
        └──────── every agent reads/writes the shared context ─────────────┘
```

All planning agents run **autonomously and automatically** before any human
interaction. The control plane demonstrates:

1. **Parallel execution of independent agents.** Flight, Hotel, Activity,
   Weather, Transport and Insights depend only on the parsed request, so the
   orchestrator fans them out with `Promise.all` under a shared `parallel_group`
   (`runResearchPhase` in `src/lib/orchestrator.ts`). Each agent independently
   finds and recommends its best option.
2. **Direct agent-to-agent (A2A) communication & negotiation.** When the trip is
   over budget, the Budget Agent negotiates *directly* with the Flight, Hotel,
   Activity and Transport agents over the `agent_messages` channel — they propose
   cheaper flights/hotels/transport and trim optional activities, collaboratively
   optimizing across up to 3 rounds before the human is involved
   (`src/lib/agents/negotiation.ts`).
3. **Human oversight.** A single approval gate presents the optimized plan, total
   and reasoning. The operator can approve, reject, modify the budget, or
   **change preferences with a prompt** — which re-runs only the affected agents
   and automatically re-optimizes (`changePreferences` + `affectedAgents`).
4. **Observability.** Every state change is an **event**, every execution is an
   **agent run** (tagged with its parallel group), and every A2A message is
   recorded — all streamed live to the dashboard via Supabase Realtime.

### Agents
| Agent      | Role                                          | Data source     |
|------------|-----------------------------------------------|-----------------|
| Flight     | Best round-trip flight                         | LiteAPI (live)  |
| Hotel      | Best-rated stay within budget                  | LiteAPI (live)  |
| Activity   | Recommended experiences (optional/trimmable)   | LLM             |
| Weather    | Seasonal outlook + packing (informational)     | LLM             |
| Transport  | Local transport option + cheaper alternatives  | LLM             |
| Insights   | Destination insights (informational)           | LLM             |
| Budget     | Combines the plan, computes total, negotiates  | deterministic   |
| Approval   | Human-in-the-loop gate                          | —               |
| Itinerary  | Day-by-day plan (after approval)               | LLM             |

Event types: `workflow_started`, `agent_started`, `agent_completed`,
`context_updated`, `parallel_started`, `parallel_completed`, `message_sent`,
`input_required`, `input_received`, `approval_required`, `approval_received`,
`workflow_completed`, `workflow_failed`.

### Tech stack
- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** dashboard
- **Supabase** — Postgres database + Realtime
- **LLM** — Itinerary Agent via any OpenAI-compatible API (OpenRouter or OpenAI)
- **LiteAPI** — real, live flights + hotels (no sample/dummy data)

---

## Database tables (Supabase)
| Table            | Purpose                                            |
|------------------|----------------------------------------------------|
| `workflows`      | One row per planning run + status                  |
| `shared_context` | Single evolving JSON document shared by all agents |
| `agent_runs`     | Per-agent execution records + `parallel_group`     |
| `agent_messages` | Direct agent-to-agent (A2A) message log            |
| `events`         | Append-only event stream (live feed)               |
| `approvals`      | Human-in-the-loop approval requests                |

> If you created the database with an earlier version of the schema, re-run
> [`supabase/schema.sql`](supabase/schema.sql) — it is idempotent and adds the
> new `agent_messages` table and the `agent_runs.parallel_group` column.

---

## Setup

### 1. Install
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env.local` and fill in values:
```bash
cp .env.example .env.local
```
- **Supabase** (required): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **LLM** (required): `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`. Works
  with OpenRouter (`https://openrouter.ai/api/v1`, e.g. `openai/gpt-4o-mini`) or
  OpenAI (`https://api.openai.com/v1`, e.g. `gpt-4o-mini`).
- **LiteAPI** (required): `LITEAPI_API_KEY` — the Flight and Hotel agents use
  live data only. There is no sample/dummy fallback, so a missing key or an
  empty result will fail the workflow with a clear error event.

### 3. Create the database schema
Open the Supabase SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
It creates all tables, indexes, RLS read policies, and enables Realtime.

### 4. Run
```bash
npm run dev
```
Open http://localhost:3000.

---

## API routes
| Method | Route                          | Description                          |
|--------|--------------------------------|--------------------------------------|
| POST   | `/api/workflows/create`        | `{ prompt }` → parses + runs pipeline |
| POST   | `/api/commands`                | `{ workflowId, command, newBudget? }` |
| GET    | `/api/workflows/[id]`          | Workflow + context + runs + approvals |
| GET    | `/api/events/[workflowId]`     | Full event stream                     |

**Commands:** `begin_workflow`, `provide_input` (new dates), `change_preferences` (`{ prompt }`), `approve`, `reject`, `update_budget`, `restart_workflow`.

---

## Deploying to Vercel
1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the same environment variables from `.env.local` in the Vercel project
   settings.
4. Deploy. Supabase serves as the database + realtime backend.

> Note: server-side writes use the Supabase **service role key**, which must be
> set as a (non-public) environment variable in Vercel.

---

## How the autonomous flow + human oversight works
1. All six planning agents run **in parallel** and each auto-selects its best
   option — no human input required during planning.
2. The Budget Agent combines the plan and computes the total cost.
3. If **over budget**, it opens an **A2A negotiation**: it messages the Flight,
   Hotel, Activity and Transport agents directly, they propose cheaper options /
   trim optional activities, and the plan is re-costed over up to 3 rounds.
4. The optimized plan, total and reasoning are presented at a single
   `awaiting_approval` gate. The user can **Approve**, **Reject**, **Modify
   budget**, or **Change preferences** with a prompt.
5. Changing preferences re-parses the request and re-runs **only the affected
   agents**, then re-optimizes automatically.
6. On approval, the Itinerary Agent generates the day-by-day plan and the
   workflow completes — all live, without a page refresh.
