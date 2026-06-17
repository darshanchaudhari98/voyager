-- =============================================================================
-- AI Travel Agent Control Plane — Database Schema
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard).
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
  -- pending | running | awaiting_approval | completed | failed | rejected
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
-- agent_runs: observability for each agent execution
-- -----------------------------------------------------------------------------
create table if not exists public.agent_runs (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  agent       text not null,
  -- running | completed | failed | skipped
  status      text not null default 'running',
  input       jsonb,
  output      jsonb,
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

-- -----------------------------------------------------------------------------
-- events: append-only event stream powering the live feed
-- types: agent_started | agent_completed | context_updated |
--         approval_required | approval_received | workflow_completed |
--         workflow_failed | workflow_started
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
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references public.workflows(id) on delete cascade,
  -- pending | approved | rejected
  status        text not null default 'pending',
  reason        text,
  budget        numeric,
  total_cost    numeric,
  overage       numeric,
  -- approve | reject | update_budget
  resolution    text,
  new_budget    numeric,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists events_workflow_idx   on public.events(workflow_id, created_at);
create index if not exists agent_runs_wf_idx      on public.agent_runs(workflow_id, started_at);
create index if not exists approvals_wf_idx        on public.approvals(workflow_id, created_at);

-- -----------------------------------------------------------------------------
-- Realtime: broadcast row changes to subscribed clients
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.workflows;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.approvals;
alter publication supabase_realtime add table public.shared_context;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- This is a single-tenant demo control plane. We enable RLS and allow read
-- access to anon (dashboard) while all writes go through the service role,
-- which bypasses RLS. Tighten these policies before multi-tenant production use.
-- -----------------------------------------------------------------------------
alter table public.workflows      enable row level security;
alter table public.shared_context enable row level security;
alter table public.agent_runs     enable row level security;
alter table public.events         enable row level security;
alter table public.approvals      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['workflows','shared_context','agent_runs','events','approvals']
  loop
    execute format('drop policy if exists "anon read %1$s" on public.%1$s;', t);
    execute format('create policy "anon read %1$s" on public.%1$s for select using (true);', t);
  end loop;
end $$;
