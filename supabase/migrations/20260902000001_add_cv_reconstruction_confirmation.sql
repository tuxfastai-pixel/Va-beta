-- Adds an evidence-confirmation boundary to CV reconstruction.
-- Existing CV changes remain valid and require no confirmation.

alter table public.cv_change_records
  add column if not exists confirmation_status text
    not null default 'not_required',
  add column if not exists confirmation_questions jsonb
    not null default '[]'::jsonb,
  add column if not exists confirmation_answers jsonb
    not null default '{}'::jsonb,
  add column if not exists confirmed_evidence text
    not null default '',
  add column if not exists confirmed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'cv_change_records_confirmation_status_check'
  ) then
    alter table public.cv_change_records
      add constraint
        cv_change_records_confirmation_status_check
      check (
        confirmation_status in (
          'not_required',
          'needs_confirmation',
          'confirmed'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'cv_change_records_confirmation_questions_check'
  ) then
    alter table public.cv_change_records
      add constraint
        cv_change_records_confirmation_questions_check
      check (
        jsonb_typeof(confirmation_questions) = 'array'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'cv_change_records_confirmation_answers_check'
  ) then
    alter table public.cv_change_records
      add constraint
        cv_change_records_confirmation_answers_check
      check (
        jsonb_typeof(confirmation_answers) = 'object'
      );
  end if;
end
$$;

comment on column
  public.cv_change_records.confirmation_status
is
  'Controls whether a proposed CV reconstruction requires user-confirmed evidence before approval.';

comment on column
  public.cv_change_records.confirmation_questions
is
  'Targeted factual questions generated for an uncertain CV entry.';

comment on column
  public.cv_change_records.confirmation_answers
is
  'Authenticated user answers used to verify the reconstructed experience.';

comment on column
  public.cv_change_records.confirmed_evidence
is
  'Plain-language evidence assembled from the source CV and confirmed answers.';