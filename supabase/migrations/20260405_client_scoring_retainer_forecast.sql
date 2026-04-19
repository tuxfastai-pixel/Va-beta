-- Client Scoring + Retainer Detection + Income Forecasting
-- All idempotent with DO $$ exception handling

DO $$
BEGIN
  -- clients: scoring fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='score') THEN
    ALTER TABLE public.clients ADD COLUMN score numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lifetime_value') THEN
    ALTER TABLE public.clients ADD COLUMN lifetime_value numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='retention_probability') THEN
    ALTER TABLE public.clients ADD COLUMN retention_probability numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='last_interaction') THEN
    ALTER TABLE public.clients ADD COLUMN last_interaction timestamp;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='jobs_completed') THEN
    ALTER TABLE public.clients ADD COLUMN jobs_completed integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='avg_response_time') THEN
    ALTER TABLE public.clients ADD COLUMN avg_response_time numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='message_count') THEN
    ALTER TABLE public.clients ADD COLUMN message_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='is_retainer') THEN
    ALTER TABLE public.clients ADD COLUMN is_retainer boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='monthly_retainer_value') THEN
    ALTER TABLE public.clients ADD COLUMN monthly_retainer_value numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='score_tier') THEN
    ALTER TABLE public.clients ADD COLUMN score_tier text DEFAULT 'low';
  END IF;
END $$;

-- Add retainer fields to jobs table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='is_retainer') THEN
    ALTER TABLE public.jobs ADD COLUMN is_retainer boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='monthly_value') THEN
    ALTER TABLE public.jobs ADD COLUMN monthly_value numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='retainer_probability') THEN
    ALTER TABLE public.jobs ADD COLUMN retainer_probability numeric DEFAULT 0;
  END IF;
END $$;

-- Income forecasts table
CREATE TABLE IF NOT EXISTS public.income_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  predicted_monthly numeric NOT NULL DEFAULT 0,
  predicted_growth numeric NOT NULL DEFAULT 1.0,
  confidence numeric NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  basis_records integer DEFAULT 0,
  retainer_monthly numeric DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_forecasts_user_created
  ON public.income_forecasts (user_id, created_at DESC);

-- Client interaction log (tracks what was sent to avoid spam)
CREATE TABLE IF NOT EXISTS public.client_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  interaction_type text NOT NULL
    CHECK (interaction_type IN ('checkin', 'retainer_pitch', 'upsell', 'followup', 'task_complete')),
  message text,
  sent_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_interactions_client
  ON public.client_interactions (client_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_interactions_user
  ON public.client_interactions (user_id, sent_at DESC);
