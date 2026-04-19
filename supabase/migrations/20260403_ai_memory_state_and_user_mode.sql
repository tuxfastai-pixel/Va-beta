alter table if exists public.ai_memory
  add column if not exists state jsonb;

alter table if exists public.users
  add column if not exists ai_mode text default 'assist';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'ai_mode'
  ) then
    update public.users
    set ai_mode = coalesce(ai_mode, 'assist')
    where ai_mode is null;

    alter table public.users
      add constraint users_ai_mode_check
      check (ai_mode in ('assist', 'autonomous'));
  end if;
exception
  when duplicate_object then
    null;
end
$$;