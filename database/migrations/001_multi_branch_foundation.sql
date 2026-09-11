BEGIN;

DO $$ BEGIN
  CREATE TYPE branch_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reservation_source AS ENUM ('online', 'phone', 'walk_in');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  opening_time TIME NOT NULL DEFAULT '09:00',
  closing_time TIME NOT NULL DEFAULT '22:00',
  is_accepting_reservations BOOLEAN NOT NULL DEFAULT TRUE,
  status branch_status NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_settings (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
  default_table_duration_minutes INTEGER NOT NULL DEFAULT 120 CHECK (default_table_duration_minutes > 0),
  reservation_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (reservation_interval_minutes > 0),
  reservation_lead_time_minutes INTEGER NOT NULL DEFAULT 30 CHECK (reservation_lead_time_minutes > 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS table_areas (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, name)
);

CREATE TABLE IF NOT EXISTS staff_branches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, branch_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) UNIQUE;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES table_areas(id);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS source reservation_source NOT NULL DEFAULT 'online';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

CREATE UNIQUE INDEX IF NOT EXISTS tables_branch_name_key ON tables(branch_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS categories_branch_name_key ON categories(branch_id, name);
CREATE INDEX IF NOT EXISTS reservations_branch_time_idx ON reservations(branch_id, reservation_time);
CREATE INDEX IF NOT EXISTS orders_branch_idx ON orders(branch_id);

INSERT INTO roles(name) VALUES
  ('chain_manager'), ('branch_manager'), ('waiter'), ('kitchen'), ('cashier'), ('customer')
ON CONFLICT (name) DO NOTHING;

COMMIT;
