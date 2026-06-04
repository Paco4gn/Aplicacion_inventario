ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS screen_size text DEFAULT '',
  ADD COLUMN IF NOT EXISTS resolution text DEFAULT '',
  ADD COLUMN IF NOT EXISTS connection_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS toner_model text DEFAULT '',
  ADD COLUMN IF NOT EXISTS imei text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sim_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS assigned_position text DEFAULT '';

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_incidents_due_at ON incidents(due_at);
CREATE INDEX IF NOT EXISTS idx_assets_parent_asset_id ON assets(parent_asset_id);
