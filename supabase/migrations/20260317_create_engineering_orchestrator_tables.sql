create table if not exists public.engineering_tasks (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  agent_type text not null check (agent_type in ('PLANNER', 'ENGINEER', 'REVIEWER', 'TESTER', 'OPTIMIZER')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed', 'needs_approval')),
  priority integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  parent_task_id uuid references public.engineering_tasks(id) on delete set null,
  requires_human_approval boolean not null default false,
  approved_by text,
  approved_at timestamptz,
  retries integer not null default 0,
  error text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_engineering_tasks_status_sched_priority
  on public.engineering_tasks (status, scheduled_at, priority desc, created_at asc);

create index if not exists idx_engineering_tasks_agent_status
  on public.engineering_tasks (agent_type, status, created_at desc);

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.engineering_tasks(id) on delete set null,
  agent_type text not null,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_logs_task_created
  on public.agent_logs (task_id, created_at desc);

create index if not exists idx_agent_logs_agent_created
  on public.agent_logs (agent_type, created_at desc);

create or replace function public.engineering_tasks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_engineering_tasks_set_updated_at on public.engineering_tasks;
create trigger trg_engineering_tasks_set_updated_at
before update on public.engineering_tasks
for each row
execute function public.engineering_tasks_set_updated_at();