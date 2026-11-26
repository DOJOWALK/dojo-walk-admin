PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS booking_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  dog_id TEXT NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('monthly_am_pm','monthly_once','temporary_am_pm','single_walk')),
  preferred_date TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (20,30,45,60)),
  pickup_address TEXT NOT NULL,
  pickup_latitude REAL,
  pickup_longitude REAL,
  instructions TEXT,
  estimated_price_inr INTEGER NOT NULL DEFAULT 0 CHECK (estimated_price_inr >= 0),
  proposed_date TEXT,
  proposed_time TEXT,
  final_price_inr INTEGER CHECK (final_price_inr IS NULL OR final_price_inr >= 0),
  admin_note TEXT,
  status TEXT NOT NULL DEFAULT 'new_request'
    CHECK (status IN ('new_request','under_review','time_proposed','customer_confirmed','rejected','cancelled','converted')),
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  customer_confirmed_at TEXT,
  CHECK ((pickup_latitude IS NULL AND pickup_longitude IS NULL) OR
         (pickup_latitude BETWEEN -90 AND 90 AND pickup_longitude BETWEEN -180 AND 180))
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_customer_created
  ON booking_requests(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status_created
  ON booking_requests(status, created_at DESC);
