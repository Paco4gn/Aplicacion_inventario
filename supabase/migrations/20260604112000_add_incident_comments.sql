CREATE TABLE IF NOT EXISTS incident_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_name text DEFAULT 'informatica',
  body text NOT NULL,
  internal boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE incident_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select incident comments"
  ON incident_comments FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public insert incident comments"
  ON incident_comments FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public update incident comments"
  ON incident_comments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public delete incident comments"
  ON incident_comments FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_incident_comments_incident ON incident_comments(incident_id, created_at);
