ALTER TABLE bookings ADD COLUMN start_slot TEXT NOT NULL DEFAULT 'morning' CHECK (start_slot IN ('morning','evening'));
