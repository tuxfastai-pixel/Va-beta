create table if not exists public.patch_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.engineering_tasks(id) on delete set null,
  agent text not null,
  patch_json jsonb not null,
  result text not null check (result in ('success', 'failure')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch_logs_task_created
  on public.patch_logs (task_id, created_at desc);

create index if not exists idx_patch_logs_result_created
  on public.patch_logs (result, created_at desc);
