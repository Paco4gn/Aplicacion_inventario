/*
  # Incident assignment and email recipients

  Adds a responsible employee field to incidents and a small configurable
  recipient list used by the notify-incident Edge Function.
*/

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS assigned_to_id uuid REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to_id ON incidents(assigned_to_id);

CREATE TABLE IF NOT EXISTS incident_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE incident_notification_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can select incident notification recipients" ON incident_notification_recipients;
DROP POLICY IF EXISTS "Admin can insert incident notification recipients" ON incident_notification_recipients;
DROP POLICY IF EXISTS "Admin can update incident notification recipients" ON incident_notification_recipients;
DROP POLICY IF EXISTS "Admin can delete incident notification recipients" ON incident_notification_recipients;

CREATE POLICY "Admin can select incident notification recipients"
  ON incident_notification_recipients FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can insert incident notification recipients"
  ON incident_notification_recipients FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can update incident notification recipients"
  ON incident_notification_recipients FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin can delete incident notification recipients"
  ON incident_notification_recipients FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

INSERT INTO incident_notification_recipients (email, name, enabled)
VALUES
  ('jcromar@feval.com', 'Juan Carlos Roman', true),
  ('fgallego@feval.com', 'Francisco Gallego', true)
ON CONFLICT (email) DO UPDATE
SET enabled = true,
    updated_at = now();
