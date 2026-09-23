-- Access Control System Migration
-- Adds approval-based access gating and request tracking

do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users
      add column if not exists access_status text default 'pending';

    if not exists (
      select 1
      from pg_constraint
      where conname = 'users_access_status_check'
        and conrelid = to_regclass('public.users')
    ) then
      alter table public.users
        add constraint users_access_status_check
        check (access_status in ('pending', 'approved', 'rejected'));
    end if;
  end if;
end
$$;

-- Create access_requests table for tracking user access requests
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  admin_notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON public.access_requests(email);
CREATE INDEX IF NOT EXISTS idx_access_requests_created_at ON public.access_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_user_id ON public.access_requests(user_id);

-- Create notifications table for admin alerts
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('access_request', 'access_approved', 'access_rejected', 'system_alert')),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON public.admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);
-- Server-only RLS boundaries.
alter table public.access_requests enable row level security;
alter table public.admin_notifications enable row level security;
