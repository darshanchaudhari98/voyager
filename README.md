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
   Flight Agent ─▶ [SELECT a flight]  ─▶  Hotel Agent ─▶ [SELECT a hotel]
        │  (live LiteAPI options shown in a modal)            │
        ▼                                                     ▼
   Budget Agent ─▶ [APPROVE / modify budget] ─▶ Itinerary Agent ─▶ completed
        └──────── every agent reads/writes the shared context ─────────────┘
```

Every task has a **human decision point**:
- **Flight** and **Hotel** pause for an **interactive selection** — the agent
  fetches live options and a modal shows them (airline, times, stops, price /
  hotel photo, rating, board, price) for the operator to pick.
- **Budget** and **Itinerary** pause for an **approval gate**. The budget gate
  surfaces any overage and lets the operator approve, reject, or modify the
  budget.

Every state change is recorded as an **event** (`agent_started`,
`agent_completed`, `context_updated`, `approval_required`, `approval_received`,
`workflow_completed`, `workflow_failed`) and streamed to the dashboard.

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
| `agent_runs`     | Per-agent execution records (observability)        |
| `events`         | Append-only event stream (live feed)               |
| `approvals`      | Human-in-the-loop approval requests                |

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

**Commands:** `select_option`, `approve`, `reject`, `update_budget`, `restart_workflow`.

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

## How the human-in-the-loop works
1. The Budget Agent computes flight + hotel + miscellaneous + total cost.
2. The Approval Agent compares total vs budget.
3. If **over budget**, it creates a pending `approval`, sets the workflow to
   `awaiting_approval`, and emits `approval_required` — the dashboard shows the
   approval panel in real time.
4. The user can **Approve**, **Reject**, or **Increase Budget**.
5. On resume, the Itinerary Agent runs and the workflow completes — all without
   a page refresh.
