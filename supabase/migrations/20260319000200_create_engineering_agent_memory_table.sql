create table if not exists public.engineering_agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null,
  category text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_engineering_agent_memory_agent_created
  on public.engineering_agent_memory (agent_type, created_at desc);

create index if not exists idx_engineering_agent_memory_category
  on public.engineering_agent_memory (category);
