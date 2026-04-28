/*
  # Drop all existing RLS policies before re-creating them
  Clears every known policy name across all tables to allow clean recreation.
*/

-- ASSETS
DROP POLICY IF EXISTS "Authenticated can select assets" ON assets;
DROP POLICY IF EXISTS "Authenticated can insert assets" ON assets;
DROP POLICY IF EXISTS "Authenticated can update assets" ON assets;
DROP POLICY IF EXISTS "Authenticated can delete assets" ON assets;
DROP POLICY IF EXISTS "Admin can select assets" ON assets;
DROP POLICY IF EXISTS "Admin can insert assets" ON assets;
DROP POLICY IF EXISTS "Admin can update assets" ON assets;
DROP POLICY IF EXISTS "Admin can delete assets" ON assets;

-- EMPLOYEES
DROP POLICY IF EXISTS "Authenticated can select employees" ON employees;
DROP POLICY IF EXISTS "Authenticated can insert employees" ON employees;
DROP POLICY IF EXISTS "Authenticated can update employees" ON employees;
DROP POLICY IF EXISTS "Authenticated can delete employees" ON employees;
DROP POLICY IF EXISTS "Admin can select employees" ON employees;
DROP POLICY IF EXISTS "Admin can insert employees" ON employees;
DROP POLICY IF EXISTS "Admin can update employees" ON employees;
DROP POLICY IF EXISTS "Admin can delete employees" ON employees;

-- ASSET_ASSIGNMENTS
DROP POLICY IF EXISTS "Authenticated can select assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Authenticated can insert assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Authenticated can update assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Authenticated can delete assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Admin can select assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Admin can insert assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Admin can update assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Admin can delete assignments" ON asset_assignments;

-- INCIDENTS
DROP POLICY IF EXISTS "Authenticated can select incidents" ON incidents;
DROP POLICY IF EXISTS "Authenticated can insert incidents" ON incidents;
DROP POLICY IF EXISTS "Authenticated can update incidents" ON incidents;
DROP POLICY IF EXISTS "Authenticated can delete incidents" ON incidents;
DROP POLICY IF EXISTS "Admin can select incidents" ON incidents;
DROP POLICY IF EXISTS "Admin can insert incidents" ON incidents;
DROP POLICY IF EXISTS "Admin can update incidents" ON incidents;
DROP POLICY IF EXISTS "Admin can delete incidents" ON incidents;

-- SOFTWARE
DROP POLICY IF EXISTS "Authenticated can select software" ON software;
DROP POLICY IF EXISTS "Authenticated can insert software" ON software;
DROP POLICY IF EXISTS "Authenticated can update software" ON software;
DROP POLICY IF EXISTS "Authenticated can delete software" ON software;
DROP POLICY IF EXISTS "Admin can select software" ON software;
DROP POLICY IF EXISTS "Admin can insert software" ON software;
DROP POLICY IF EXISTS "Admin can update software" ON software;
DROP POLICY IF EXISTS "Admin can delete software" ON software;

-- LICENSES
DROP POLICY IF EXISTS "Authenticated can select licenses" ON licenses;
DROP POLICY IF EXISTS "Authenticated can insert licenses" ON licenses;
DROP POLICY IF EXISTS "Authenticated can update licenses" ON licenses;
DROP POLICY IF EXISTS "Authenticated can delete licenses" ON licenses;
DROP POLICY IF EXISTS "Admin can select licenses" ON licenses;
DROP POLICY IF EXISTS "Admin can insert licenses" ON licenses;
DROP POLICY IF EXISTS "Admin can update licenses" ON licenses;
DROP POLICY IF EXISTS "Admin can delete licenses" ON licenses;

-- COMPONENTS
DROP POLICY IF EXISTS "Authenticated can select components" ON components;
DROP POLICY IF EXISTS "Authenticated can insert components" ON components;
DROP POLICY IF EXISTS "Authenticated can update components" ON components;
DROP POLICY IF EXISTS "Authenticated can delete components" ON components;
DROP POLICY IF EXISTS "Admin can select components" ON components;
DROP POLICY IF EXISTS "Admin can insert components" ON components;
DROP POLICY IF EXISTS "Admin can update components" ON components;
DROP POLICY IF EXISTS "Admin can delete components" ON components;

-- COMPONENT_MOVEMENTS
DROP POLICY IF EXISTS "Authenticated can select movements" ON component_movements;
DROP POLICY IF EXISTS "Authenticated can insert movements" ON component_movements;
DROP POLICY IF EXISTS "Authenticated can update movements" ON component_movements;
DROP POLICY IF EXISTS "Authenticated can delete movements" ON component_movements;
DROP POLICY IF EXISTS "Admin can select movements" ON component_movements;
DROP POLICY IF EXISTS "Admin can insert movements" ON component_movements;
DROP POLICY IF EXISTS "Admin can update movements" ON component_movements;
DROP POLICY IF EXISTS "Admin can delete movements" ON component_movements;

-- AUDIT_LOGS
DROP POLICY IF EXISTS "Authenticated can select audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Admin can select audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Admin can insert audit_logs" ON audit_logs;
