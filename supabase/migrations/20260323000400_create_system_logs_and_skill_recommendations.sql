-- System logs table for tracking automation run times
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast latest-run queries per type
CREATE INDEX IF NOT EXISTS idx_system_logs_type_created ON system_logs (type, created_at DESC);

-- Skill recommendations table
CREATE TABLE IF NOT EXISTS skill_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'job_match',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_recommendations_user ON skill_recommendations (user_id);
