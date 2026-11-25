CREATE TABLE IF NOT EXISTS booking_pauses (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pause_from_date TEXT NOT NULL,
  pause_from_slot TEXT NOT NULL CHECK (pause_from_slot IN ('morning','evening')),
  expected_resume_date TEXT NOT NULL,
  expected_resume_slot TEXT NOT NULL CHECK (expected_resume_slot IN ('morning','evening')),
  actual_resume_date TEXT,
  actual_resume_slot TEXT CHECK (actual_resume_slot IN ('morning','evening')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resumed')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_booking_pauses_booking_status ON booking_pauses(booking_id,status);
CREATE INDEX IF NOT EXISTS idx_booking_pauses_dates ON booking_pauses(pause_from_date,expected_resume_date);
