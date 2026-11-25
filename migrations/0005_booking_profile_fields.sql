ALTER TABLE customers ADD COLUMN flat_tower TEXT;
ALTER TABLE customers ADD COLUMN society TEXT;
ALTER TABLE customers ADD COLUMN locality TEXT;
ALTER TABLE customers ADD COLUMN city TEXT;
ALTER TABLE customers ADD COLUMN state TEXT;
ALTER TABLE customers ADD COLUMN pincode TEXT;

ALTER TABLE dogs ADD COLUMN gender TEXT CHECK (gender IN ('Male','Female') OR gender IS NULL);

-- Keep existing customer address and area values intact for older records.
