/*
# TransitOps AI — Initial Schema

## Overview
Creates the full database schema for TransitOps AI, a transit fleet management SaaS.
Includes role-based user profiles and shared fleet operational tables (vehicles, drivers,
trips, maintenance, fuel logs, expenses, notifications, documents).

## New Tables
1. `profiles` — extends `auth.users` with role, full name, phone, avatar. One row per auth user.
   - `id` uuid PK, references auth.users(id) ON DELETE CASCADE
   - `email` text unique not null
   - `full_name` text not null
   - `role` text not null (admin | fleet_manager | driver | safety_officer | financial_analyst)
   - `phone` text
   - `avatar_url` text
   - `created_at` timestamptz default now()
2. `vehicles` — fleet vehicles with registration, capacity, insurance, status.
   - `id` uuid PK
   - `registration_number` text unique not null
   - `model` text not null
   - `type` text not null (truck | van | bus | trailer | car)
   - `load_capacity` numeric not null (kg)
   - `odometer` numeric not null default 0 (km)
   - `acquisition_cost` numeric not null default 0
   - `status` text not null default 'available' (available | on_trip | in_shop | retired)
   - `insurance_provider` text
   - `insurance_policy_number` text
   - `insurance_expiry` date
   - `created_at` timestamptz default now()
3. `drivers` — drivers with license, safety score, status.
   - `id` uuid PK
   - `name` text not null
   - `license_number` text unique not null
   - `license_expiry` date not null
   - `safety_score` numeric not null default 100
   - `phone` text
   - `email` text
   - `status` text not null default 'available' (available | on_trip | suspended | off_duty)
   - `created_at` timestamptz default now()
4. `trips` — trip assignments linking vehicles + drivers with cargo and revenue.
   - `id` uuid PK
   - `vehicle_id` uuid FK vehicles(id)
   - `driver_id` uuid FK drivers(id)
   - `origin` text not null
   - `destination` text not null
   - `cargo_weight` numeric not null
   - `departure_time` timestamptz not null
   - `arrival_time` timestamptz
   - `status` text not null default 'pending' (pending | dispatched | completed | cancelled)
   - `revenue` numeric not null default 0
   - `notes` text
   - `created_at` timestamptz default now()
5. `maintenance` — vehicle service records with status lifecycle.
   - `id` uuid PK
   - `vehicle_id` uuid FK vehicles(id)
   - `service_type` text not null
   - `description` text
   - `cost` numeric not null default 0
   - `start_date` timestamptz not null default now()
   - `end_date` timestamptz
   - `status` text not null default 'open' (open | closed)
   - `created_at` timestamptz default now()
6. `fuel_logs` — fuel entries per vehicle for efficiency tracking.
   - `id` uuid PK
   - `vehicle_id` uuid FK vehicles(id)
   - `liters` numeric not null
   - `cost` numeric not null
   - `odometer_reading` numeric not null
   - `date` timestamptz not null default now()
   - `created_at` timestamptz default now()
7. `expenses` — operational expenses, optionally linked to a vehicle.
   - `id` uuid PK
   - `category` text not null (fuel | maintenance | salary | insurance | other)
   - `amount` numeric not null
   - `description` text
   - `vehicle_id` uuid FK vehicles(id) nullable
   - `date` timestamptz not null default now()
   - `created_at` timestamptz default now()
8. `notifications` — per-user in-app notifications.
   - `id` uuid PK
   - `user_id` uuid FK auth.users(id) ON DELETE CASCADE
   - `message` text not null
   - `type` text not null default 'info' (info | warning | error | success)
   - `read` boolean not null default false
   - `created_at` timestamptz default now()
9. `documents` — vehicle document uploads (metadata only; file stored as URL).
   - `id` uuid PK
   - `vehicle_id` uuid FK vehicles(id) ON DELETE CASCADE
   - `file_name` text not null
   - `file_url` text not null
   - `file_type` text
   - `uploaded_at` timestamptz default now()

## Security
- RLS enabled on every table.
- `profiles`: owner-scoped CRUD (users manage their own profile).
- Fleet tables (vehicles, drivers, trips, maintenance, fuel_logs, expenses, documents):
  shared operational data — all authenticated users can read/write. RBAC enforced in the UI.
- `notifications`: owner-scoped (user_id = auth.uid()).

## Notes
1. A trigger `handle_new_user_profile` auto-creates a `profiles` row when a new auth user signs up,
   defaulting role to 'fleet_manager' and copying email + full_name from metadata.
2. All fleet tables use `gen_random_uuid()` for IDs.
3. Timestamps default to `now()`.
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ profiles ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT 'New User',
  role text NOT NULL DEFAULT 'fleet_manager' CHECK (role IN ('admin','fleet_manager','driver','safety_officer','financial_analyst')),
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'fleet_manager')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- ============ vehicles ============
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text UNIQUE NOT NULL,
  model text NOT NULL,
  type text NOT NULL CHECK (type IN ('truck','van','bus','trailer','car')),
  load_capacity numeric NOT NULL DEFAULT 0,
  odometer numeric NOT NULL DEFAULT 0,
  acquisition_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','on_trip','in_shop','retired')),
  insurance_provider text,
  insurance_policy_number text,
  insurance_expiry date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_vehicles" ON vehicles;
CREATE POLICY "auth_select_vehicles" ON vehicles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_vehicles" ON vehicles;
CREATE POLICY "auth_insert_vehicles" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_vehicles" ON vehicles;
CREATE POLICY "auth_update_vehicles" ON vehicles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_vehicles" ON vehicles;
CREATE POLICY "auth_delete_vehicles" ON vehicles FOR DELETE
  TO authenticated USING (true);

-- ============ drivers ============
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  license_number text UNIQUE NOT NULL,
  license_expiry date NOT NULL,
  safety_score numeric NOT NULL DEFAULT 100,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','on_trip','suspended','off_duty')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_drivers" ON drivers;
CREATE POLICY "auth_select_drivers" ON drivers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_drivers" ON drivers;
CREATE POLICY "auth_insert_drivers" ON drivers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_drivers" ON drivers;
CREATE POLICY "auth_update_drivers" ON drivers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_drivers" ON drivers;
CREATE POLICY "auth_delete_drivers" ON drivers FOR DELETE
  TO authenticated USING (true);

-- ============ trips ============
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  cargo_weight numeric NOT NULL DEFAULT 0,
  departure_time timestamptz NOT NULL DEFAULT now(),
  arrival_time timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispatched','completed','cancelled')),
  revenue numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_trips" ON trips;
CREATE POLICY "auth_select_trips" ON trips FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_trips" ON trips;
CREATE POLICY "auth_insert_trips" ON trips FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_trips" ON trips;
CREATE POLICY "auth_update_trips" ON trips FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_trips" ON trips;
CREATE POLICY "auth_delete_trips" ON trips FOR DELETE
  TO authenticated USING (true);

-- ============ maintenance ============
CREATE TABLE IF NOT EXISTS maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  service_type text NOT NULL,
  description text,
  cost numeric NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_maintenance" ON maintenance;
CREATE POLICY "auth_select_maintenance" ON maintenance FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_maintenance" ON maintenance;
CREATE POLICY "auth_insert_maintenance" ON maintenance FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_maintenance" ON maintenance;
CREATE POLICY "auth_update_maintenance" ON maintenance FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_maintenance" ON maintenance;
CREATE POLICY "auth_delete_maintenance" ON maintenance FOR DELETE
  TO authenticated USING (true);

-- ============ fuel_logs ============
CREATE TABLE IF NOT EXISTS fuel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  liters numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  odometer_reading numeric NOT NULL DEFAULT 0,
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_fuel_logs" ON fuel_logs;
CREATE POLICY "auth_select_fuel_logs" ON fuel_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_fuel_logs" ON fuel_logs;
CREATE POLICY "auth_insert_fuel_logs" ON fuel_logs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_fuel_logs" ON fuel_logs;
CREATE POLICY "auth_update_fuel_logs" ON fuel_logs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_fuel_logs" ON fuel_logs;
CREATE POLICY "auth_delete_fuel_logs" ON fuel_logs FOR DELETE
  TO authenticated USING (true);

-- ============ expenses ============
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('fuel','maintenance','salary','insurance','other')),
  amount numeric NOT NULL DEFAULT 0,
  description text,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_expenses" ON expenses;
CREATE POLICY "auth_select_expenses" ON expenses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_expenses" ON expenses;
CREATE POLICY "auth_insert_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_expenses" ON expenses;
CREATE POLICY "auth_update_expenses" ON expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_expenses" ON expenses;
CREATE POLICY "auth_delete_expenses" ON expenses FOR DELETE
  TO authenticated USING (true);

-- ============ notifications ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','error','success')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ documents ============
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_documents" ON documents;
CREATE POLICY "auth_select_documents" ON documents FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_documents" ON documents;
CREATE POLICY "auth_insert_documents" ON documents FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_documents" ON documents;
CREATE POLICY "auth_update_documents" ON documents FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_documents" ON documents;
CREATE POLICY "auth_delete_documents" ON documents FOR DELETE
  TO authenticated USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle ON fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_vehicle ON documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);