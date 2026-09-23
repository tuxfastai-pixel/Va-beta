-- Create funnel_events table for conversion tracking
CREATE TABLE IF NOT EXISTS funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  email TEXT,
  step TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for query optimization
CREATE INDEX IF NOT EXISTS idx_funnel_events_step ON funnel_events(step);
CREATE INDEX IF NOT EXISTS idx_funnel_events_email ON funnel_events(email);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON funnel_events(created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_user_id ON funnel_events(user_id);

-- Create view for conversion funnel analysis
CREATE OR REPLACE VIEW funnel_conversion_rates AS
SELECT 
  'landing_view' as step,
  COUNT(DISTINCT email) as count,
  NULL::FLOAT as conversion_rate
FROM funnel_events
WHERE step = 'landing_view'

UNION ALL

SELECT 
  'form_submit' as step,
  COUNT(DISTINCT email) as count,
  ROUND(
    CAST(COUNT(DISTINCT CASE WHEN step = 'form_submit' THEN email END) AS FLOAT) /
    NULLIF(CAST(COUNT(DISTINCT CASE WHEN step = 'landing_view' THEN email END) AS FLOAT), 0) * 100,
    2
  ) as conversion_rate
FROM funnel_events
WHERE step IN ('landing_view', 'form_submit')

UNION ALL

SELECT 
  'lead_created' as step,
  COUNT(DISTINCT email) as count,
  ROUND(
    CAST(COUNT(DISTINCT CASE WHEN step = 'lead_created' THEN email END) AS FLOAT) /
    NULLIF(CAST(COUNT(DISTINCT CASE WHEN step = 'landing_view' THEN email END) AS FLOAT), 0) * 100,
    2
  ) as conversion_rate
FROM funnel_events
WHERE step IN ('landing_view', 'lead_created')

UNION ALL

SELECT 
  'outreach_sent' as step,
  COUNT(DISTINCT email) as count,
  ROUND(
    CAST(COUNT(DISTINCT CASE WHEN step = 'outreach_sent' THEN email END) AS FLOAT) /
    NULLIF(CAST(COUNT(DISTINCT CASE WHEN step = 'landing_view' THEN email END) AS FLOAT), 0) * 100,
    2
  ) as conversion_rate
FROM funnel_events
WHERE step IN ('landing_view', 'outreach_sent')

UNION ALL

SELECT 
  'subscription_created' as step,
  COUNT(DISTINCT email) as count,
  ROUND(
    CAST(COUNT(DISTINCT CASE WHEN step = 'subscription_created' THEN email END) AS FLOAT) /
    NULLIF(CAST(COUNT(DISTINCT CASE WHEN step = 'landing_view' THEN email END) AS FLOAT), 0) * 100,
    2
  ) as conversion_rate
FROM funnel_events
WHERE step IN ('landing_view', 'subscription_created');
