/*
  # Incident responsible from notification recipients

  The incident responsible is a support recipient, not a regular employee.
*/

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS assigned_to_email text,
  ADD COLUMN IF NOT EXISTS assigned_to_name text;

CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to_email ON incidents(assigned_to_email);

