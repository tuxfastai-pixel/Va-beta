alter table if exists public.ai_memory
  add column if not exists user_id uuid,
  add column if not exists type text;

update public.ai_memory
set type = coalesce(type, memory_type)
where type is null
  and memory_type is not null;

alter table if exists public.ai_memory
  alter column type set default 'conversation';

create index if not exists idx_ai_memory_user_id_created
  on public.ai_memory (user_id, created_at desc);

create index if not exists idx_ai_memory_type_created
  on public.ai_memory (type, created_at desc);