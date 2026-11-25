ALTER TABLE customers ADD COLUMN blocked_until TEXT;
ALTER TABLE customers ADD COLUMN block_reason TEXT;

CREATE TABLE IF NOT EXISTS customer_deletion_history (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  dog_names TEXT NOT NULL,
  reason TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
