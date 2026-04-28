CREATE TABLE IF NOT EXISTS license_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  returned_at timestamptz,
  notes text DEFAULT ''
);

ALTER TABLE license_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select license_assignments"
  ON license_assignments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert license_assignments"
  ON license_assignments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update license_assignments"
  ON license_assignments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete license_assignments"
  ON license_assignments FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_license_assignments_license ON license_assignments(license_id);
CREATE INDEX IF NOT EXISTS idx_license_assignments_employee ON license_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_license_assignments_asset ON license_assignments(asset_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_license_assignments_one_active
  ON license_assignments(license_id)
  WHERE returned_at IS NULL;
