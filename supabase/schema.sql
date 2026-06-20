-- =============================================================================
-- AI Travel Agent Control Plane — Database Schema
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard).
-- Safe to re-run: all statements are idempotent.
-- =============================================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- workflows: one row per planning run
-- -----------------------------------------------------------------------------
create table if not exists public.workflows (
  id            uuid primary key default gen_random_uuid(),
  prompt        text not null,
  -- parsed request: { origin, destination, days, travelers, budget, currency, preferences }
  request       jsonb not null default '{}'::jsonb,
  -- pending | running | awaiting_selection | awaiting_input |
  -- awaiting_budget_review | awaiting_approval | completed | failed | rejected
  status        text not null default 'pending',
  current_agent text,
  budget        numeric not null default 0,
  total_cost    numeric not null default 0,
  result        jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- shared_context: single evolving JSON document shared across all agents
-- -----------------------------------------------------------------------------
create table if not exists public.shared_context (
  workflow_id uuid primary key references public.workflows(id) on delete cascade,
  context     jsonb not null default '{}'::jsonb,
  version     integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- agent_runs: observability for each agent execution.
-- parallel_group tags runs that executed concurrently in the same fan-out phase
-- (e.g. the flight / hotel / insights research phase).
-- -----------------------------------------------------------------------------
create table if not exists public.agent_runs (
  id             uuid primary key default gen_random_uuid(),
  workflow_id    uuid not null references public.workflows(id) on delete cascade,
  agent          text not null,
  -- running | completed | failed | skipped
  status         text not null default 'running',
  input          jsonb,
  output         jsonb,
  error          text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);

-- -----------------------------------------------------------------------------
-- events: append-only event stream powering the live feed.
-- types: workflow_started | agent_started | agent_completed | context_updated |
--        parallel_started | parallel_completed | message_sent |
--        selection_required | selection_received | input_required | input_received |
--        budget_review_required | approval_required | approval_received |
--        workflow_completed | workflow_failed
-- -----------------------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  type        text not null,
  agent       text,
  message     text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- approvals: human-in-the-loop approval requests
-- -----------------------------------------------------------------------------
create table if not exists public.approvals (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  -- pending | approved | rejected
  status      text not null default 'pending',
  reason      text,
  budget      numeric,
  total_cost  numeric,
  overage     numeric,
  -- approve | reject | update_budget
  resolution  text,
  new_budget  numeric,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- -----------------------------------------------------------------------------
-- agent_messages: DIRECT agent-to-agent (A2A) communication channel.
-- Distinct from shared_context: agents send addressed request / response
-- messages to each other (e.g. the Budget Agent negotiating cheaper options
-- with the Flight and Hotel agents). The full exchange is observable.
-- types: request | response | broadcast | info
-- -----------------------------------------------------------------------------
create table if not exists public.agent_messages (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  sender      text not null,
  recipient   text not null,       -- target agent name, or 'all' for a broadcast
  type        text not null default 'info',
  subject     text,
  body        jsonb not null default '{}'::jsonb,
  in_reply_to uuid,                -- links a response back to its originating request
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Schema migrations: add columns introduced after the initial release.
-- "add column if not exists" is a no-op when the column already exists.
-- These must run BEFORE the indexes below that reference the new columns.
-- -----------------------------------------------------------------------------
alter table public.agent_runs add column if not exists parallel_group text;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists events_workflow_idx       on public.events(workflow_id, created_at);
create index if not exists agent_runs_wf_idx         on public.agent_runs(workflow_id, started_at);
create index if not exists agent_runs_group_idx      on public.agent_runs(parallel_group) where parallel_group is not null;
create index if not exists approvals_wf_idx          on public.approvals(workflow_id, created_at);
create index if not exists agent_messages_wf_idx     on public.agent_messages(workflow_id, created_at);

-- -----------------------------------------------------------------------------
-- Realtime: broadcast row changes to all subscribed dashboard clients.
-- Wrapped in DO blocks because ALTER PUBLICATION ADD TABLE has no IF NOT EXISTS.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'workflows',
    'events',
    'agent_runs',
    'approvals',
    'shared_context',
    'agent_messages'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Single-tenant demo: anon can read everything; all writes go through the
-- service role (bypasses RLS). Tighten these policies for multi-tenant use.
-- -----------------------------------------------------------------------------
alter table public.workflows      enable row level security;
alter table public.shared_context enable row level security;
alter table public.agent_runs     enable row level security;
alter table public.events         enable row level security;
alter table public.approvals      enable row level security;
alter table public.agent_messages enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'workflows',
    'shared_context',
    'agent_runs',
    'events',
    'approvals',
    'agent_messages'
  ]
  loop
    execute format('drop policy if exists "anon read %1$s" on public.%1$s;', t);
    execute format('create policy "anon read %1$s" on public.%1$s for select using (true);', t);
  end loop;
end $$;
