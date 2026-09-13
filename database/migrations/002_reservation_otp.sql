BEGIN;

DO $$ BEGIN
  CREATE TYPE otp_purpose AS ENUM ('reservation', 'login');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  birth_date DATE,
  notification_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_requests (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(30) NOT NULL,
  purpose otp_purpose NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  verified_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reservation_code VARCHAR(24);
CREATE UNIQUE INDEX IF NOT EXISTS reservations_code_key ON reservations(reservation_code) WHERE reservation_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS otp_requests_phone_purpose_created_idx ON otp_requests(phone, purpose, "createdAt");

-- Database-level protection for concurrent online reservations of the same table.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_no_overlapping_table_time;
ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlapping_table_time
  EXCLUDE USING gist (
    table_id WITH =,
    tstzrange(reservation_time, end_time, '[)') WITH &&
  ) WHERE (end_time IS NOT NULL AND status IN ('pending', 'confirmed', 'checked_in'));

COMMIT;
