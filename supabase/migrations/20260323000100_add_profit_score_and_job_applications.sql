ALTER TABLE IF EXISTS public.job_matches
  ADD COLUMN IF NOT EXISTS profit_score INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_job_matches_profit_score
  ON public.job_matches (profit_score DESC);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  user_id UUID NOT NULL,
  proposal TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_applications_unique_job_user
  ON public.job_applications (job_id, user_id);
