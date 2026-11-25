ALTER TABLE bookings ADD COLUMN price_per_walk_inr INTEGER NOT NULL DEFAULT 0 CHECK (price_per_walk_inr >= 0);
ALTER TABLE bookings ADD COLUMN billing_start_date TEXT;
CREATE INDEX IF NOT EXISTS idx_walks_booking_status ON walks(booking_id,status);

-- Move currently active services onto per-walk billing from the migration date.
-- Historical completed walks remain under the old pricing and are not charged again.
UPDATE bookings
SET plan_type='single_walk',
    end_date=NULL,
    price_inr=0,
    sunday_extra_enabled=0,
    price_per_walk_inr=65,
    billing_start_date=date('now','+5 hours','+30 minutes')
WHERE status='active';
