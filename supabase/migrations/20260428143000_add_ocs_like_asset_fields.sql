/*
  # Add OCS-like technical inventory fields

  Adds optional fields for hardware/software inventory data commonly collected by tools
  like OCS Inventory, while keeping the manual inventory workflow intact.
*/

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS operating_system text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ip_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mac_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS processor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ram_gb numeric(10,2),
  ADD COLUMN IF NOT EXISTS storage_gb numeric(10,2),
  ADD COLUMN IF NOT EXISTS last_inventory_at timestamptz;
