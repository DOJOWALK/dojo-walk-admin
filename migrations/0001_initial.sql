PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT,
  address TEXT,
  area TEXT,
  notes TEXT,
  booking_source TEXT NOT NULL DEFAULT 'whatsapp' CHECK (booking_source IN ('whatsapp','phone','walk_in','other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dogs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT,
  age_text TEXT,
  size TEXT,
  temperament TEXT,
  medical_notes TEXT,
  emergency_notes TEXT,
  photo_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  dog_id TEXT NOT NULL REFERENCES dogs(id),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly_am_pm','monthly_once','temporary_am_pm','single_walk')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  morning_time TEXT,
  evening_time TEXT,
  walks_per_day INTEGER NOT NULL,
  walk_duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_inr INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','paused')),
  booking_source TEXT NOT NULL DEFAULT 'whatsapp' CHECK (booking_source IN ('whatsapp','phone','walk_in','other')),
  advance_received_inr INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS walks (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  dog_id TEXT NOT NULL REFERENCES dogs(id),
  walk_date TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('morning','evening')),
  scheduled_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','missed','cancelled')),
  started_at TEXT,
  completed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_id, walk_date, slot)
);

CREATE TABLE IF NOT EXISTS walk_media (
  id TEXT PRIMARY KEY,
  walk_id TEXT NOT NULL REFERENCES walks(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo','video')),
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  booking_id TEXT REFERENCES bookings(id),
  amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'upi' CHECK (payment_method IN ('cash','upi','bank','other')),
  reference_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_dogs_customer ON dogs(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates ON bookings(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_walks_date_slot ON walks(walk_date, slot, status);
CREATE INDEX IF NOT EXISTS idx_walk_media_walk ON walk_media(walk_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_date ON payments(customer_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);