CREATE TABLE IF NOT EXISTS public.earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'job',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earnings_user_id ON public.earnings (user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_created_at ON public.earnings (created_at DESC);

ALTER TABLE IF EXISTS public.user_reputation
  ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 50;

UPDATE public.user_reputation
SET score = COALESCE(score, reputation_score, 50)
WHERE score IS NULL OR score = 50;
