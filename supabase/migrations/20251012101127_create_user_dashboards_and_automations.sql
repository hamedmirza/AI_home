/*
  # User Dashboards and Automations

  1. New Tables
    - `user_dashboards` - Store custom dashboards created by users
    - `dashboard_cards` - Store cards/widgets on dashboards
    - `user_automations` - Store AI-created automations
    - `entity_classifications` - Store user's entity organization

  2. Security
    - Enable RLS on all tables
    - Allow anyone to manage their data
*/

-- Create user_dashboards table
CREATE TABLE IF NOT EXISTS user_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'layout-dashboard',
  layout jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create dashboard_cards table
CREATE TABLE IF NOT EXISTS dashboard_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid REFERENCES user_dashboards(id) ON DELETE CASCADE,
  card_type text NOT NULL,
  title text,
  entity_ids text[] DEFAULT ARRAY[]::text[],
  config jsonb DEFAULT '{}'::jsonb,
  position jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_automations table
CREATE TABLE IF NOT EXISTS user_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  trigger jsonb NOT NULL,
  conditions jsonb DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL,
  enabled boolean DEFAULT true,
  created_by text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create entity_classifications table
CREATE TABLE IF NOT EXISTS entity_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  entity_id text NOT NULL,
  category text NOT NULL,
  room text,
  tags text[] DEFAULT ARRAY[]::text[],
  hidden boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_id)
);

-- Enable RLS
ALTER TABLE user_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_classifications ENABLE ROW LEVEL SECURITY;

-- Policies for user_dashboards
CREATE POLICY "Anyone can view dashboards"
  ON user_dashboards FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create dashboards"
  ON user_dashboards FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update dashboards"
  ON user_dashboards FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete dashboards"
  ON user_dashboards FOR DELETE
  USING (true);

-- Policies for dashboard_cards
CREATE POLICY "Anyone can view dashboard cards"
  ON dashboard_cards FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create dashboard cards"
  ON dashboard_cards FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update dashboard cards"
  ON dashboard_cards FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete dashboard cards"
  ON dashboard_cards FOR DELETE
  USING (true);

-- Policies for user_automations
CREATE POLICY "Anyone can view automations"
  ON user_automations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create automations"
  ON user_automations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update automations"
  ON user_automations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete automations"
  ON user_automations FOR DELETE
  USING (true);

-- Policies for entity_classifications
CREATE POLICY "Anyone can view classifications"
  ON entity_classifications FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create classifications"
  ON entity_classifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update classifications"
  ON entity_classifications FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete classifications"
  ON entity_classifications FOR DELETE
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_cards_dashboard_id ON dashboard_cards(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_user_automations_user_id ON user_automations(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_classifications_user_id ON entity_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_classifications_entity_id ON entity_classifications(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_classifications_category ON entity_classifications(category);

-- Add comments
COMMENT ON TABLE user_dashboards IS 'User-created custom dashboards';
COMMENT ON TABLE dashboard_cards IS 'Cards/widgets on user dashboards';
COMMENT ON TABLE user_automations IS 'User and AI-created automations';
COMMENT ON TABLE entity_classifications IS 'User organization of entities by room, category, etc.';
