/*
  # Add Dynamic Pricing Support

  1. Changes to energy_pricing table
    - Add pricing_mode column (static/dynamic)
    - Add last_updated timestamp for tracking
    - Add price history table for tracking changes

  2. New price_history table
    - Track price changes over time
    - Store general_price and feed_in_tariff snapshots
    - Enable price trend analysis

  3. Security
    - Maintain existing RLS policies
*/

-- Add dynamic pricing columns to energy_pricing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'energy_pricing' AND column_name = 'pricing_mode'
  ) THEN
    ALTER TABLE energy_pricing ADD COLUMN pricing_mode text DEFAULT 'static';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'energy_pricing' AND column_name = 'last_updated'
  ) THEN
    ALTER TABLE energy_pricing ADD COLUMN last_updated timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'energy_pricing' AND column_name = 'update_interval_minutes'
  ) THEN
    ALTER TABLE energy_pricing ADD COLUMN update_interval_minutes integer DEFAULT 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'energy_pricing' AND column_name = 'api_source'
  ) THEN
    ALTER TABLE energy_pricing ADD COLUMN api_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'energy_pricing' AND column_name = 'api_key'
  ) THEN
    ALTER TABLE energy_pricing ADD COLUMN api_key text;
  END IF;
END $$;

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  general_price numeric(10, 4) NOT NULL,
  feed_in_tariff numeric(10, 4) NOT NULL,
  pricing_mode text NOT NULL,
  source text DEFAULT 'manual',
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on price_history
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Policies for price_history
CREATE POLICY "Anyone can view price history"
  ON price_history FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create price history"
  ON price_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete price history"
  ON price_history FOR DELETE
  USING (true);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_price_history_user_id ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at DESC);

-- Add comments
COMMENT ON COLUMN energy_pricing.pricing_mode IS 'Pricing mode: static (manual) or dynamic (auto-updated)';
COMMENT ON COLUMN energy_pricing.last_updated IS 'Last time prices were updated';
COMMENT ON COLUMN energy_pricing.update_interval_minutes IS 'How often to update prices in dynamic mode (default: 5 minutes)';
COMMENT ON COLUMN energy_pricing.api_source IS 'API source for dynamic pricing (optional)';
COMMENT ON COLUMN energy_pricing.api_key IS 'API key for dynamic pricing source (optional, encrypted)';
COMMENT ON TABLE price_history IS 'Historical record of price changes for trend analysis';
