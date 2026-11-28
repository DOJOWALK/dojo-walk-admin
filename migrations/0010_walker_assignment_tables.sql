PRAGMA foreign_keys = ON;

-- These operational tables were historically created lazily by Admin API routes.
-- Declare them in migrations as well so a fresh database has the same base schema.
CREATE TABLE IF NOT EXISTS walkers (
  id TEXT PRIMARY KEY,
  walker_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  local_address TEXT NOT NULL,
  permanent_address TEXT NOT NULL,
  aadhaar_received INTEGER NOT NULL DEFAULT 0,
  pan_received INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS walk_assignments (
  walk_id TEXT PRIMARY KEY REFERENCES walks(id) ON DELETE CASCADE,
  walker_id TEXT NOT NULL REFERENCES walkers(id),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_walk_assignments_walker ON walk_assignments(walker_id);
