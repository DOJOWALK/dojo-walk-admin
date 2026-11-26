PRAGMA foreign_keys = ON;

-- Temporary registration details are retained only until phone ownership is verified.
CREATE TABLE IF NOT EXISTS portal_customer_registrations (
  id TEXT PRIMARY KEY,
  phone_normalized TEXT NOT NULL,
  full_name TEXT NOT NULL,
  address TEXT NOT NULL,
  area TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_customer_registration_phone
  ON portal_customer_registrations(phone_normalized, expires_at);
