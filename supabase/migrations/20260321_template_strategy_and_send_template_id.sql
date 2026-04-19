ALTER TABLE cold_email_sends
ADD COLUMN IF NOT EXISTS template_id TEXT;

CREATE TABLE IF NOT EXISTS template_strategy (
  template_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'iterating',
  avg_reply_rate DOUBLE PRECISION DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cold_email_sends_template_id ON cold_email_sends(template_id);
