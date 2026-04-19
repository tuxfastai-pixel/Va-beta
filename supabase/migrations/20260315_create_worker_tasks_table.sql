create table if not exists public.worker_tasks (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('JOB_DISCOVERY', 'JOB_MATCHING', 'JOB_APPLICATION', 'COMPLIANCE_TASK')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_worker_tasks_status_sched_priority
  on public.worker_tasks (status, scheduled_at, priority desc, created_at asc);

create index if not exists idx_worker_tasks_type_status
  on public.worker_tasks (type, status);

create or replace function public.worker_tasks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_worker_tasks_set_updated_at on public.worker_tasks;
create trigger trg_worker_tasks_set_updated_at
before update on public.worker_tasks
for each row
execute function public.worker_tasks_set_updated_at();
