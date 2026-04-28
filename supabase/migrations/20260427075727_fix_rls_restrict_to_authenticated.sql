/*
  # Fix RLS Policies - Restrict all write operations to authenticated users only

  ## Problem
  All INSERT/UPDATE/DELETE policies were using USING/WITH CHECK = true,
  allowing unrestricted access to anon users. This bypasses row-level security.

  ## Solution
  - DROP all existing permissive policies
  - Re-create READ (SELECT) policies: authenticated only (anon cannot read)
  - Re-create WRITE policies: authenticated only, with proper conditions
  - audit_logs: only authenticated can insert; no one can update/delete (immutable log)

  This app uses a single shared admin account, so authenticated = allowed.
  Anon users (unauthenticated) get zero access to any table.
*/

-- ============================================================
-- ASSETS
-- ============================================================
DROP POLICY IF EXISTS "Public select assets" ON assets;
DROP POLICY IF EXISTS "Public insert assets" ON assets;
DROP POLICY IF EXISTS "Public update assets" ON assets;
DROP POLICY IF EXISTS "Public delete assets" ON assets;

CREATE POLICY "Authenticated can select assets"
  ON assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert assets"
  ON assets FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update assets"
  ON assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete assets"
  ON assets FOR DELETE TO authenticated USING (true);

-- ============================================================
-- EMPLOYEES
-- ============================================================
DROP POLICY IF EXISTS "Public full access to employees" ON employees;
DROP POLICY IF EXISTS "Public insert employees" ON employees;
DROP POLICY IF EXISTS "Public update employees" ON employees;
DROP POLICY IF EXISTS "Public delete employees" ON employees;

CREATE POLICY "Authenticated can select employees"
  ON employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert employees"
  ON employees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update employees"
  ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete employees"
  ON employees FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ASSET_ASSIGNMENTS
-- ============================================================
DROP POLICY IF EXISTS "Public select assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Public insert assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Public update assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Public delete assignments" ON asset_assignments;

CREATE POLICY "Authenticated can select assignments"
  ON asset_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert assignments"
  ON asset_assignments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update assignments"
  ON asset_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete assignments"
  ON asset_assignments FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INCIDENTS
-- ============================================================
DROP POLICY IF EXISTS "Public select incidents" ON incidents;
DROP POLICY IF EXISTS "Public insert incidents" ON incidents;
DROP POLICY IF EXISTS "Public update incidents" ON incidents;
DROP POLICY IF EXISTS "Public delete incidents" ON incidents;

CREATE POLICY "Authenticated can select incidents"
  ON incidents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert incidents"
  ON incidents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update incidents"
  ON incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete incidents"
  ON incidents FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SOFTWARE
-- ============================================================
DROP POLICY IF EXISTS "Public select software" ON software;
DROP POLICY IF EXISTS "Public insert software" ON software;
DROP POLICY IF EXISTS "Public update software" ON software;
DROP POLICY IF EXISTS "Public delete software" ON software;

CREATE POLICY "Authenticated can select software"
  ON software FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert software"
  ON software FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update software"
  ON software FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete software"
  ON software FOR DELETE TO authenticated USING (true);

-- ============================================================
-- LICENSES
-- ============================================================
DROP POLICY IF EXISTS "Public select licenses" ON licenses;
DROP POLICY IF EXISTS "Public insert licenses" ON licenses;
DROP POLICY IF EXISTS "Public update licenses" ON licenses;
DROP POLICY IF EXISTS "Public delete licenses" ON licenses;

CREATE POLICY "Authenticated can select licenses"
  ON licenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert licenses"
  ON licenses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update licenses"
  ON licenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete licenses"
  ON licenses FOR DELETE TO authenticated USING (true);

-- ============================================================
-- COMPONENTS
-- ============================================================
DROP POLICY IF EXISTS "Public select components" ON components;
DROP POLICY IF EXISTS "Public insert components" ON components;
DROP POLICY IF EXISTS "Public update components" ON components;
DROP POLICY IF EXISTS "Public delete components" ON components;

CREATE POLICY "Authenticated can select components"
  ON components FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert components"
  ON components FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update components"
  ON components FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete components"
  ON components FOR DELETE TO authenticated USING (true);

-- ============================================================
-- COMPONENT_MOVEMENTS
-- ============================================================
DROP POLICY IF EXISTS "Public select movements" ON component_movements;
DROP POLICY IF EXISTS "Public insert movements" ON component_movements;
DROP POLICY IF EXISTS "Public update movements" ON component_movements;
DROP POLICY IF EXISTS "Public delete movements" ON component_movements;

CREATE POLICY "Authenticated can select movements"
  ON component_movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert movements"
  ON component_movements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update movements"
  ON component_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete movements"
  ON component_movements FOR DELETE TO authenticated USING (true);

-- ============================================================
-- AUDIT_LOGS (immutable: no update/delete ever allowed)
-- ============================================================
DROP POLICY IF EXISTS "Public select audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Public insert audit_logs" ON audit_logs;

CREATE POLICY "Authenticated can select audit_logs"
  ON audit_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert audit_logs"
  ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
