alter table if exists public.worker_tasks
  add column if not exists task_type text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'worker_tasks'
      and column_name = 'type'
  ) then
    execute 'update public.worker_tasks set task_type = coalesce(task_type, type) where task_type is null';
  end if;
end
$$;

alter table if exists public.worker_tasks
  alter column task_type set default 'JOB_DISCOVERY';

create index if not exists idx_worker_tasks_task_type_status
  on public.worker_tasks (task_type, status);
