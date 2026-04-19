alter table if exists public.worker_tasks
  drop constraint if exists worker_tasks_type_check;

alter table if exists public.worker_tasks
  add constraint worker_tasks_type_check
  check (
    type in (
      'JOB_DISCOVERY',
      'JOB_MATCHING',
      'JOB_APPLICATION',
      'COMPLIANCE_TASK',
      'BOOKKEEPING_TASK',
      'DOCUMENT_PROCESSING'
    )
  );

alter table if exists public.worker_tasks
  alter column task_type set default 'JOB_DISCOVERY';
