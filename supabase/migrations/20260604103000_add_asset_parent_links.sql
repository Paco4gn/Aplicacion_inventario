ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_parent_asset ON assets(parent_asset_id);
