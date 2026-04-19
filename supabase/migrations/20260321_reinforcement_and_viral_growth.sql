CREATE TABLE IF NOT EXISTS outreach_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  success_rate DOUBLE PRECISION DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO outreach_templates (id, name)
VALUES
  ('painPointFocused', 'Pain Point Focused'),
  ('socialProofFocused', 'Social Proof Focused'),
  ('curiosityLoop', 'Curiosity Loop'),
  ('specificOffer', 'Specific Offer'),
  ('caseStudy', 'Case Study')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION upsert_outreach_template_performance(
  p_template_id TEXT,
  p_success_rate DOUBLE PRECISION
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO outreach_templates (id, name, success_rate, usage_count, updated_at)
  VALUES (p_template_id, p_template_id, p_success_rate, 1, NOW())
  ON CONFLICT (id)
  DO UPDATE SET
    success_rate = EXCLUDED.success_rate,
    usage_count = outreach_templates.usage_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id TEXT NOT NULL,
  referred_email TEXT NOT NULL,
  referred_client_id TEXT,
  referral_code TEXT,
  reward_type TEXT NOT NULL DEFAULT 'free_month',
  reward_value DOUBLE PRECISION DEFAULT 1,
  recurring_commission_rate DOUBLE PRECISION DEFAULT 0.10,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  converted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

CREATE TABLE IF NOT EXISTS viral_content_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT,
  platform TEXT,
  content TEXT NOT NULL,
  metrics JSONB DEFAULT '{}'::jsonb,
  posted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT,
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viral_content_logs_client ON viral_content_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_viral_content_logs_platform ON viral_content_logs(platform);
CREATE INDEX IF NOT EXISTS idx_case_studies_job_id ON case_studies(job_id);

CREATE OR REPLACE VIEW email_logs AS
SELECT * FROM cold_email_sends;
