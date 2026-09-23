-- Email accounts for cold outreach distribution
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  smtp_host TEXT NOT NULL,
  smtp_port INT DEFAULT 587,
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL,
  daily_limit INT DEFAULT 100,
  sent_today INT DEFAULT 0,
  sent_total INT DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active', -- active, paused, suspended
  reply_rate FLOAT DEFAULT 0,
  bounce_rate FLOAT DEFAULT 0,
  warmup_days INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create health score view for account selection
CREATE OR REPLACE VIEW email_account_health AS
SELECT 
  id,
  email,
  daily_limit,
  sent_today,
  status,
  ROUND(
    (1.0 - COALESCE(bounce_rate, 0)) * 
    (1.0 + COALESCE(reply_rate, 0) * 0.5) * 
    CASE WHEN warmup_days >= 7 THEN 1.0 ELSE 0.5 END,
    2
  ) as health_score
FROM email_accounts
WHERE status = 'active'
ORDER BY health_score DESC;

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_email_accounts_status ON email_accounts(status);
CREATE INDEX IF NOT EXISTS idx_email_accounts_sent_by_date ON email_accounts(sent_today, created_at);
CREATE INDEX IF NOT EXISTS idx_email_accounts_last_sent ON email_accounts(last_sent_at);

-- Reset daily counters (run daily at 00:00 UTC)
CREATE OR REPLACE FUNCTION reset_daily_email_counts()
RETURNS void AS $$
BEGIN
  UPDATE email_accounts
  SET sent_today = 0
  WHERE DATE(created_at) = DATE(NOW());
END;
$$ LANGUAGE plpgsql;

-- Table for tracking cold email sends
CREATE TABLE IF NOT EXISTS cold_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES email_accounts(id),
  lead_id UUID,
  lead_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent', -- sent, bounced, opened, replied, unsubscribed
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  reply_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cold_email_sends_account ON cold_email_sends(account_id);
CREATE INDEX IF NOT EXISTS idx_cold_email_sends_lead_email ON cold_email_sends(lead_email);
CREATE INDEX IF NOT EXISTS idx_cold_email_sends_status ON cold_email_sends(status);
CREATE INDEX IF NOT EXISTS idx_cold_email_sends_created_at ON cold_email_sends(created_at);

-- Cold email campaign stats view
CREATE OR REPLACE VIEW cold_email_stats AS
SELECT 
  DATE(sent_at) as date,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounces,
  COUNT(CASE WHEN status = 'opened' THEN 1 END) as opens,
  COUNT(CASE WHEN status = 'replied' THEN 1 END) as replies,
  ROUND(
    CAST(COUNT(CASE WHEN status = 'opened' THEN 1 END) AS FLOAT) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as open_rate,
  ROUND(
    CAST(COUNT(CASE WHEN status = 'replied' THEN 1 END) AS FLOAT) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as reply_rate,
  ROUND(
    CAST(COUNT(CASE WHEN status = 'bounced' THEN 1 END) AS FLOAT) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as bounce_rate
FROM cold_email_sends
GROUP BY DATE(sent_at)
ORDER BY DATE(sent_at) DESC;
