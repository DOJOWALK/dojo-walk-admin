PRAGMA foreign_keys = ON;

-- Additive management tables. Existing customers, walkers, bookings and walks remain untouched.

CREATE TABLE IF NOT EXISTS walker_employment_profiles (
  walker_id TEXT PRIMARY KEY REFERENCES walkers(id) ON DELETE CASCADE,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time','part_time')),
  employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('pending','active','on_leave','suspended','exited')),
  pay_basis TEXT NOT NULL DEFAULT 'per_walk'
    CHECK (pay_basis IN ('per_walk','hourly','monthly')),
  hired_on TEXT,
  weekly_rest_days INTEGER NOT NULL DEFAULT 1 CHECK (weekly_rest_days BETWEEN 0 AND 3),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_walker_employment_status
  ON walker_employment_profiles(employment_status, employment_type);

CREATE TABLE IF NOT EXISTS walker_leave_requests (
  id TEXT PRIMARY KEY,
  walker_id TEXT NOT NULL REFERENCES walkers(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (leave_type IN ('paid','unpaid','other')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_at TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_walker_leave_dates
  ON walker_leave_requests(walker_id, start_date, end_date, status);

CREATE TABLE IF NOT EXISTS walker_pay_rates (
  id TEXT PRIMARY KEY,
  walker_id TEXT REFERENCES walkers(id) ON DELETE CASCADE,
  area_name TEXT,
  service_type TEXT NOT NULL
    CHECK (service_type IN ('single_walk','monthly_once','monthly_am_pm','temporary_am_pm')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (20,30,45,60)),
  rate_inr INTEGER NOT NULL CHECK (rate_inr >= 0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_walker_pay_rates_lookup
  ON walker_pay_rates(is_active, walker_id, area_name, service_type, duration_minutes, effective_from);

CREATE TABLE IF NOT EXISTS service_pricing_rules (
  id TEXT PRIMARY KEY,
  area_name TEXT NOT NULL,
  service_type TEXT NOT NULL
    CHECK (service_type IN ('single_walk','monthly_once','monthly_am_pm','temporary_am_pm')),
  walks_per_day INTEGER NOT NULL CHECK (walks_per_day IN (1,2)),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (20,30,45,60)),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('one_time','monthly','custom')),
  customer_price_inr INTEGER NOT NULL CHECK (customer_price_inr >= 0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_service_pricing_lookup
  ON service_pricing_rules(is_active, area_name, service_type, walks_per_day, duration_minutes, billing_cycle, effective_from);

CREATE TABLE IF NOT EXISTS customer_pricing_overrides (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL
    CHECK (service_type IN ('single_walk','monthly_once','monthly_am_pm','temporary_am_pm')),
  walks_per_day INTEGER NOT NULL CHECK (walks_per_day IN (1,2)),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (20,30,45,60)),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('one_time','monthly','custom')),
  customer_price_inr INTEGER NOT NULL CHECK (customer_price_inr >= 0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_customer_pricing_overrides
  ON customer_pricing_overrides(customer_id, is_active, effective_from);

CREATE TABLE IF NOT EXISTS walker_settlements (
  id TEXT PRIMARY KEY,
  walker_id TEXT NOT NULL REFERENCES walkers(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  completed_walks INTEGER NOT NULL DEFAULT 0 CHECK (completed_walks >= 0),
  gross_earnings_inr INTEGER NOT NULL DEFAULT 0 CHECK (gross_earnings_inr >= 0),
  adjustments_inr INTEGER NOT NULL DEFAULT 0,
  final_payable_inr INTEGER NOT NULL DEFAULT 0 CHECK (final_payable_inr >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  approved_at TEXT,
  paid_at TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (period_end >= period_start),
  UNIQUE(walker_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_walker_settlements_period
  ON walker_settlements(period_start, period_end, status);

CREATE TABLE IF NOT EXISTS walker_settlement_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL REFERENCES walker_settlements(id) ON DELETE CASCADE,
  walk_id TEXT NOT NULL REFERENCES walks(id),
  amount_inr INTEGER NOT NULL CHECK (amount_inr >= 0),
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(settlement_id, walk_id)
);

CREATE INDEX IF NOT EXISTS idx_walker_settlement_items_walk
  ON walker_settlement_items(walk_id);
