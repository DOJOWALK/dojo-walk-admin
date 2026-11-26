PRAGMA foreign_keys = ON;

-- Short-lived OTP challenges. The plaintext OTP is never stored in D1.
CREATE TABLE IF NOT EXISTS portal_otp_challenges (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('walker','customer')),
  phone_normalized TEXT NOT NULL,
  account_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_otp_lookup
  ON portal_otp_challenges(role, phone_normalized, created_at, consumed_at);

CREATE TABLE IF NOT EXISTS portal_otp_send_limits (
  role TEXT NOT NULL CHECK (role IN ('walker','customer')),
  phone_normalized TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  sends INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(role, phone_normalized)
);
