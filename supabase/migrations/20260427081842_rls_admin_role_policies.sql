/*
  # RLS: Proper role-based policies using app_metadata JWT claim

  ## Why this fixes the "always true" warnings
  Previous policies used USING(true) / WITH CHECK(true) which is always satisfied.
  These new policies evaluate a real condition on every request:
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'

  This reads the `role` field from `app_metadata` inside the signed JWT.
  app_metadata is server-controlled — users cannot modify it themselves.
  Only users with role=admin in their JWT can access any table.

  ## Tables covered
  assets, employees, asset_assignments, incidents, software, licenses,
  components, component_movements, audit_logs
*/

-- Tag the admin user with role=admin in app_metadata
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'informatica@feval.com';

-- ============================================================
-- ASSETS
-- ============================================================
CREATE POLICY "Admin can select assets"
  ON assets FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert assets"
  ON assets FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update assets"
  ON assets FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete assets"
  ON assets FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE POLICY "Admin can select employees"
  ON employees FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert employees"
  ON employees FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update employees"
  ON employees FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete employees"
  ON employees FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- ASSET_ASSIGNMENTS
-- ============================================================
CREATE POLICY "Admin can select assignments"
  ON asset_assignments FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert assignments"
  ON asset_assignments FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update assignments"
  ON asset_assignments FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete assignments"
  ON asset_assignments FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- INCIDENTS
-- ============================================================
CREATE POLICY "Admin can select incidents"
  ON incidents FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert incidents"
  ON incidents FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update incidents"
  ON incidents FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete incidents"
  ON incidents FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- SOFTWARE
-- ============================================================
CREATE POLICY "Admin can select software"
  ON software FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert software"
  ON software FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update software"
  ON software FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete software"
  ON software FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- LICENSES
-- ============================================================
CREATE POLICY "Admin can select licenses"
  ON licenses FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert licenses"
  ON licenses FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update licenses"
  ON licenses FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete licenses"
  ON licenses FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- COMPONENTS
-- ============================================================
CREATE POLICY "Admin can select components"
  ON components FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert components"
  ON components FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update components"
  ON components FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete components"
  ON components FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- COMPONENT_MOVEMENTS
-- ============================================================
CREATE POLICY "Admin can select movements"
  ON component_movements FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert movements"
  ON component_movements FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update movements"
  ON component_movements FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete movements"
  ON component_movements FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- AUDIT_LOGS (SELECT + INSERT only — immutable log, no update/delete)
-- ============================================================
CREATE POLICY "Admin can select audit_logs"
  ON audit_logs FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert audit_logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
