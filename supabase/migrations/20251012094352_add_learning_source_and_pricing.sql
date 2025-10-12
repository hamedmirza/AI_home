/*
  # Add Learning Source Tracking and Energy Pricing

  1. Changes to learned_patterns table
    - Add learning_source column to track how pattern was learned
    - Add source_metadata for additional context
    - Values: 'user_interaction', 'feedback', 'automation', 'pattern_detection'

  2. New user_preferences table for pricing
    - Store general electricity price (per kWh)
    - Store feed-in tariff (solar export price per kWh)
    - Store currency preference

  3. Security
    - Maintain existing RLS policies
*/

-- Add learning source tracking to learned_patterns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learned_patterns' AND column_name = 'learning_source'
  ) THEN
    ALTER TABLE learned_patterns ADD COLUMN learning_source text DEFAULT 'user_interaction';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learned_patterns' AND column_name = 'source_metadata'
  ) THEN
    ALTER TABLE learned_patterns ADD COLUMN source_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for learning source queries
CREATE INDEX IF NOT EXISTS idx_learned_patterns_learning_source 
  ON learned_patterns(learning_source);

-- Create energy_pricing table if it doesn't exist
CREATE TABLE IF NOT EXISTS energy_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  general_price numeric(10, 4) DEFAULT 0.30,
  feed_in_tariff numeric(10, 4) DEFAULT 0.08,
  currency text DEFAULT 'USD',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE energy_pricing ENABLE ROW LEVEL SECURITY;

-- Create policies for energy_pricing
CREATE POLICY "Anyone can view energy pricing"
  ON energy_pricing FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create energy pricing"
  ON energy_pricing FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update energy pricing"
  ON energy_pricing FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete energy pricing"
  ON energy_pricing FOR DELETE
  USING (true);

-- Add comment explaining the pricing columns
COMMENT ON COLUMN energy_pricing.general_price IS 'Cost per kWh for grid electricity';
COMMENT ON COLUMN energy_pricing.feed_in_tariff IS 'Payment per kWh for solar export to grid';
COMMENT ON COLUMN energy_pricing.currency IS 'Currency code (USD, EUR, GBP, etc.)';
