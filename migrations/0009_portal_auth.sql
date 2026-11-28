PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('walker','customer')),
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  walker_id TEXT REFERENCES walkers(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (role='customer' AND customer_id IS NOT NULL AND walker_id IS NULL)
    OR (role='walker' AND walker_id IS NOT NULL AND customer_id IS NULL)
  ),
  UNIQUE(role, phone_normalized),
  UNIQUE(customer_id),
  UNIQUE(walker_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_users_role_active
  ON portal_users(role, is_active);

CREATE TABLE IF NOT EXISTS portal_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_user_expiry
  ON portal_sessions(user_id, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS portal_login_attempts (
  phone_normalized TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
