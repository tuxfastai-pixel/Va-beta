-- Goals & Auto-Scaling System Migration
-- Adds dynamic goal scaling and ambition level control

DO $$
BEGIN
  -- Add ambition_level to users table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'ambition_level'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN ambition_level text DEFAULT 'normal';
    
    ALTER TABLE public.users 
    ADD CONSTRAINT users_ambition_level_check 
    CHECK (ambition_level IN ('normal', 'high', 'elite'));
  END IF;
END $$;

-- Create goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goal_type text NOT NULL DEFAULT 'income' CHECK (goal_type IN ('income', 'jobs', 'reputation', 'custom')),
  
  -- Core goal tracking
  target_amount numeric NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  
  -- Auto-scaling configuration
  auto_scale boolean DEFAULT true,
  scale_factor numeric DEFAULT 2.0,
  max_target numeric,
  current_tier text DEFAULT 'starter' CHECK (current_tier IN ('starter', 'growing', 'high-income', 'elite')),
  
  -- Strategy and behavior
  strategy jsonb DEFAULT '{}'::jsonb,
  preferred_niches text[] DEFAULT ARRAY['teaching', 'admin'],
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  
  -- Achievement tracking
  times_scaled integer DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON public.goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON public.goals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_goal_type ON public.goals(goal_type);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_goals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_goals_timestamp_trigger ON public.goals;
CREATE TRIGGER update_goals_timestamp_trigger
BEFORE UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.update_goals_timestamp();

-- Create goal_achievements table for tracking milestones
CREATE TABLE IF NOT EXISTS public.goal_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  achievement_type text NOT NULL CHECK (achievement_type IN ('target_hit', 'scaled', 'tier_upgrade', 'milestone')),
  amount_at_time numeric,
  new_target numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_achievements_goal_id ON public.goal_achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_type ON public.goal_achievements(achievement_type);
