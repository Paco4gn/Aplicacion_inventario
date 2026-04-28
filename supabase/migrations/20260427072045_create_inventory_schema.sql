
/*
  # IT Inventory Management System - Full Schema

  ## Tables Created
  - `employees` - Company staff members with their assigned equipment
  - `assets` - All IT hardware/equipment records
  - `asset_assignments` - History of asset-to-employee assignments
  - `incidents` - IT incident reports and maintenance logs
  - `software` - Software catalog
  - `licenses` - Software license tracking
  - `components` - Hardware components / spare parts inventory
  - `component_movements` - Stock in/out movements for components
  - `audit_logs` - Full audit trail of all system actions

  ## Security
  - RLS enabled on all tables
  - Public read/write policies (no auth configured yet; ready for auth expansion)
*/

-- EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  department text DEFAULT '',
  position text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to employees"
  ON employees FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert employees"
  ON employees FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update employees"
  ON employees FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete employees"
  ON employees FOR DELETE TO anon, authenticated USING (true);

-- ASSETS
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text UNIQUE NOT NULL,
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'PC', -- PC, Laptop, Server, Printer, Torre, etc.
  brand text DEFAULT '',
  model text DEFAULT '',
  status text NOT NULL DEFAULT 'active', -- active, repair, retired
  location text DEFAULT '',
  purchase_date date,
  purchase_value numeric(10,2),
  notes text DEFAULT '',
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select assets"
  ON assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert assets"
  ON assets FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update assets"
  ON assets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete assets"
  ON assets FOR DELETE TO anon, authenticated USING (true);

-- ASSET ASSIGNMENTS (asset <-> employee history)
CREATE TABLE IF NOT EXISTS asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  returned_at timestamptz,
  notes text DEFAULT ''
);

ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select assignments"
  ON asset_assignments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert assignments"
  ON asset_assignments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update assignments"
  ON asset_assignments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete assignments"
  ON asset_assignments FOR DELETE TO anon, authenticated USING (true);

-- INCIDENTS
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open', -- open, in_progress, closed
  priority text NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  resolution text DEFAULT '',
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select incidents"
  ON incidents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert incidents"
  ON incidents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update incidents"
  ON incidents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete incidents"
  ON incidents FOR DELETE TO anon, authenticated USING (true);

-- SOFTWARE
CREATE TABLE IF NOT EXISTS software (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vendor text DEFAULT '',
  category text DEFAULT '',
  version text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE software ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select software"
  ON software FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert software"
  ON software FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update software"
  ON software FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete software"
  ON software FOR DELETE TO anon, authenticated USING (true);

-- LICENSES
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id uuid NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  license_key text DEFAULT '',
  license_type text DEFAULT 'commercial', -- commercial, oem, volume, freeware
  seats integer DEFAULT 1,
  seats_used integer DEFAULT 0,
  purchase_date date,
  expiry_date date,
  cost numeric(10,2),
  vendor_contact text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select licenses"
  ON licenses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert licenses"
  ON licenses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update licenses"
  ON licenses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete licenses"
  ON licenses FOR DELETE TO anon, authenticated USING (true);

-- COMPONENTS (spare parts stock)
CREATE TABLE IF NOT EXISTS components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  component_type text DEFAULT '', -- RAM, HDD, SSD, GPU, etc.
  brand text DEFAULT '',
  model text DEFAULT '',
  stock integer DEFAULT 0,
  min_stock integer DEFAULT 1,
  location text DEFAULT '',
  unit_cost numeric(10,2),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select components"
  ON components FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert components"
  ON components FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update components"
  ON components FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete components"
  ON components FOR DELETE TO anon, authenticated USING (true);

-- COMPONENT MOVEMENTS
CREATE TABLE IF NOT EXISTS component_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  movement_type text NOT NULL DEFAULT 'in', -- in, out
  quantity integer NOT NULL DEFAULT 1,
  reason text DEFAULT '',
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  moved_at timestamptz DEFAULT now()
);

ALTER TABLE component_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select movements"
  ON component_movements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert movements"
  ON component_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update movements"
  ON component_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete movements"
  ON component_movements FOR DELETE TO anon, authenticated USING (true);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL, -- created, updated, deleted, assigned, etc.
  entity_type text NOT NULL, -- asset, employee, incident, license, etc.
  entity_id text,
  entity_name text DEFAULT '',
  details jsonb DEFAULT '{}',
  performed_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select audit_logs"
  ON audit_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert audit_logs"
  ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON asset_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
