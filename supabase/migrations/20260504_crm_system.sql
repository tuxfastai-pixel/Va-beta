-- CRM Data Model Tables
-- Created: 2026-05-04
-- Purpose: Support deal tracking, contracts, invoices, and recurring billing

-- 1. Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  region TEXT DEFAULT 'global', -- 'south_africa' or 'global'
  source TEXT, -- 'indeed', 'linkedin', 'tender', 'inbound', 'referral'
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_source ON clients(source);

-- 2. Deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  stage TEXT DEFAULT 'lead', -- lead, contacted, interview, negotiation, closed_won, closed_lost
  probability INT DEFAULT 20, -- 0-100
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_client_id ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);

-- 3. Activities table (call, email, meeting, followup, proposal, etc.)
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'call', 'email', 'meeting', 'followup', 'proposal', 'interview'
  note TEXT NOT NULL,
  metadata JSONB, -- flexible field for storing extra data
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);

-- 4. Contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- full contract text
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'signed', 'expired'
  signed_at TIMESTAMP,
  signer_name TEXT,
  signer_ip TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_deal_id ON contracts(deal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- 5. Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'paid', 'overdue', 'cancelled'
  payment_link TEXT,
  due_date TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_deal_id ON invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- 6. Subscriptions table (for recurring billing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  interval TEXT DEFAULT 'monthly', -- 'weekly', 'monthly', 'quarterly', 'yearly'
  next_billing_date TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'cancelled'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);

-- 7. Auto-applications log table
CREATE TABLE IF NOT EXISTS auto_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  job_title TEXT NOT NULL,
  platform TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT now(),
  status TEXT DEFAULT 'pending', -- 'pending', 'responded', 'interview', 'rejected', 'hired'
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_auto_applications_platform ON auto_applications(platform);
CREATE INDEX IF NOT EXISTS idx_auto_applications_applied_at ON auto_applications(applied_at DESC);

-- 8. Escalations log table
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  job_title TEXT NOT NULL,
  platform TEXT NOT NULL,
  score NUMERIC NOT NULL,
  reasons TEXT[], -- array of escalation reasons
  manual_action TEXT,
  created_at TIMESTAMP DEFAULT now(),
  reviewed_at TIMESTAMP,
  outcome TEXT -- 'applied', 'ignored', 'saved'
);

CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON escalations(created_at DESC);

-- Grant permissions if needed
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
