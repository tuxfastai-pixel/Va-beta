-- Access Control System Migration
-- Adds approval-based access gating and request tracking

DO $$
BEGIN
  -- Add access_status to users table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'access_status'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN access_status text DEFAULT 'pending';
    
    -- Add constraint for valid status values
    ALTER TABLE public.users 
    ADD CONSTRAINT users_access_status_check 
    CHECK (access_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

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
