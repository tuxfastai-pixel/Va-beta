-- Runtime locking and task reservation primitives
-- Created: 2026-05-10

CREATE TABLE IF NOT EXISTS runtime_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE runtime_locks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_runtime_locks_owner ON runtime_locks(owner_id);
CREATE INDEX IF NOT EXISTS idx_runtime_locks_lease ON runtime_locks(lease_expires_at);

CREATE TABLE IF NOT EXISTS runtime_task_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_key TEXT NOT NULL UNIQUE,
  task_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved', -- reserved | completed | failed | released
  reserved_until TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE runtime_task_reservations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_runtime_task_owner ON runtime_task_reservations(owner_id);
CREATE INDEX IF NOT EXISTS idx_runtime_task_status ON runtime_task_reservations(status);
CREATE INDEX IF NOT EXISTS idx_runtime_task_until ON runtime_task_reservations(reserved_until);
-- Server-only RLS boundary.
alter table public.runtime_locks enable row level security;
alter table public.runtime_task_reservations enable row level security;
