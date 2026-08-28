-- ============================================================
-- PHASE 7: ROW LEVEL SECURITY + AUDIT LOGGING
-- ============================================================

-- Enable RLS on all CRM + billing tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: Service role bypasses all (for server-side ops)
-- ============================================================

-- CLIENTS: Users see only their own clients
CREATE POLICY "service_role_clients" ON clients
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "owner_read_clients" ON clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "owner_insert_clients" ON clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "owner_update_clients" ON clients
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- DEALS: Authenticated users only
CREATE POLICY "service_role_deals" ON deals
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "owner_read_deals" ON deals
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "owner_insert_deals" ON deals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "owner_update_deals" ON deals
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- CONTRACTS: Authenticated users only
CREATE POLICY "service_role_contracts" ON contracts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "owner_read_contracts" ON contracts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INVOICES: Authenticated users only
CREATE POLICY "service_role_invoices" ON invoices
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "owner_read_invoices" ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- SUBSCRIPTIONS: Authenticated users only
CREATE POLICY "service_role_subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- AUTO_APPLICATIONS: Service role only (internal)
CREATE POLICY "service_role_auto_applications" ON auto_applications
  FOR ALL USING (auth.role() = 'service_role');

-- ESCALATIONS: Service role only (internal)
CREATE POLICY "service_role_escalations" ON escalations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- AUDIT LOG TABLE (Immutable)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,      -- "contract_signed", "invoice_paid", "auto_apply", etc.
  entity_type  TEXT NOT NULL,      -- "contract", "invoice", "deal", "application"
  entity_id    TEXT,               -- ID of the entity
  actor        TEXT,               -- "system", "user:uuid", "client:name"
  ip_address   TEXT,               -- IP if applicable
  payload      JSONB DEFAULT '{}', -- Full event data (immutable snapshot)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable: no UPDATE or DELETE allowed
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_audit_insert" ON audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_audit_select" ON audit_logs
  FOR SELECT USING (auth.role() = 'service_role');

-- No UPDATE or DELETE policies = immutable

-- Index for fast event queries
CREATE INDEX IF NOT EXISTS idx_audit_event_type  ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_entity      ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_logs(created_at);

-- ============================================================
-- RATE LIMITING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,   -- "ip:1.2.3.4" or "user:uuid" or "endpoint:/api/x"
  count       INTEGER DEFAULT 0,
  window_end  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key         ON rate_limit_buckets(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window_end  ON rate_limit_buckets(window_end);

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_rate_limit" ON rate_limit_buckets
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- WEBHOOK EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL,         -- "payfast", "wise", "stripe"
  event_type    TEXT NOT NULL,         -- "payment.completed", "payment.failed"
  payload       JSONB NOT NULL,
  signature     TEXT,                  -- Raw signature header for verification
  verified      BOOLEAN DEFAULT FALSE,
  processed     BOOLEAN DEFAULT FALSE,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_webhooks" ON webhook_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_webhook_source    ON webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_created   ON webhook_events(created_at);

-- ============================================================
-- REVENUE ANALYTICS TABLE (for Phase 7 Revenue Engine)
-- ============================================================

CREATE TABLE IF NOT EXISTS revenue_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date     DATE NOT NULL,             -- YYYY-MM-DD
  platform        TEXT,                      -- "indeed", "linkedin", etc.
  role_type       TEXT,                      -- "admin", "finance", "sales"
  client_category TEXT,                      -- "startup", "enterprise", "gov"
  region          TEXT,                      -- "ZA", "US", "UK"
  gross_revenue   NUMERIC DEFAULT 0,
  deals_closed    INTEGER DEFAULT 0,
  proposals_sent  INTEGER DEFAULT 0,
  close_rate      NUMERIC DEFAULT 0,        -- closed / sent
  avg_response_ms BIGINT DEFAULT 0,         -- avg time to respond to leads
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (period_date, platform, role_type, region)
);

ALTER TABLE revenue_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_revenue_analytics" ON revenue_analytics
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_revenue_period    ON revenue_analytics(period_date);
CREATE INDEX IF NOT EXISTS idx_revenue_platform  ON revenue_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_revenue_role_type ON revenue_analytics(role_type);
CREATE INDEX IF NOT EXISTS idx_revenue_region    ON revenue_analytics(region);

-- ============================================================
-- AGENT ACTIVITY TABLE (for AI Workforce Layer)
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name  TEXT NOT NULL,           -- "LeadHunterAgent", "ProposalAgent", etc.
  action      TEXT NOT NULL,           -- "lead_found", "proposal_sent", etc.
  outcome     TEXT,                    -- "success", "failure", "partial"
  kpi_delta   NUMERIC DEFAULT 0,       -- +/- change in KPI value
  payload     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_agent_activities" ON agent_activities
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_agent_name    ON agent_activities(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_action  ON agent_activities(action);
CREATE INDEX IF NOT EXISTS idx_agent_created ON agent_activities(created_at);

-- ============================================================
-- LEAD QUALIFICATION TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          TEXT NOT NULL,
  budget_verified  BOOLEAN DEFAULT FALSE,
  trust_score      NUMERIC DEFAULT 0,     -- 0-10
  risk_score       NUMERIC DEFAULT 0,     -- 0-10 (higher = riskier)
  qualification    TEXT DEFAULT 'unqualified', -- "unqualified", "warm", "hot", "disqualified"
  disqualify_reason TEXT,
  deposit_required BOOLEAN DEFAULT FALSE,
  flags            TEXT[] DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_lead_scores" ON lead_scores
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_lead_scores_lead   ON lead_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_qualification ON lead_scores(qualification);

-- ============================================================
-- SLA TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS sla_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      UUID REFERENCES deals(id),
  milestone    TEXT NOT NULL,            -- "delivery_week_1", "final_delivery", etc.
  due_date     DATE NOT NULL,
  delivered_at TIMESTAMPTZ,
  status       TEXT DEFAULT 'pending',   -- "pending", "delivered", "overdue", "disputed"
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sla_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_sla_records" ON sla_records
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_sla_deal   ON sla_records(deal_id);
CREATE INDEX IF NOT EXISTS idx_sla_status ON sla_records(status);
CREATE INDEX IF NOT EXISTS idx_sla_due    ON sla_records(due_date);
