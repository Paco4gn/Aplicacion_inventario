/*
  # Add warranty and lifecycle fields to assets

  1. Changes to `assets` table
    - `warranty_expiry` (date, nullable) — warranty expiration date
    - `end_of_life` (date, nullable) — planned end-of-life / replacement date

  2. Notes
    - Both fields are optional (nullable)
    - Uses IF NOT EXISTS pattern to be idempotent
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'warranty_expiry'
  ) THEN
    ALTER TABLE assets ADD COLUMN warranty_expiry date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'end_of_life'
  ) THEN
    ALTER TABLE assets ADD COLUMN end_of_life date;
  END IF;
END $$;
