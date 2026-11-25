ALTER TABLE bookings ADD COLUMN price_per_walk_inr INTEGER NOT NULL DEFAULT 65 CHECK (price_per_walk_inr >= 0);
CREATE INDEX IF NOT EXISTS idx_walks_booking_status ON walks(booking_id,status);
