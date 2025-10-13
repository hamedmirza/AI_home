/*
  # Phase 3: Audit & Traces with AI Suggestions

  1. New Tables
    - `action_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `action_type` (text) - 'service_call', 'automation_trigger', 'manual_toggle'
      - `entity_id` (text) - Target entity
      - `service` (text) - Service called (e.g., light.turn_on)
      - `data` (jsonb) - Service call parameters
      - `reason` (text) - Why this action was taken (AI reasoning)
      - `source` (text) - 'ai_assistant', 'user_manual', 'automation', 'voice'
      - `before_state` (text) - State before action
      - `after_state` (text) - State after action
      - `success` (boolean) - Whether action succeeded
      - `error_message` (text) - Error if failed
      - `duration_ms` (integer) - How long action took
      - `created_at` (timestamptz)

    - `ai_suggestions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `suggestion_type` (text) - 'automation', 'optimization', 'cost_saving', 'pattern'
      - `title` (text) - Short suggestion title
      - `description` (text) - Detailed explanation
      - `confidence` (numeric) - 0.0 to 1.0
      - `impact` (text) - 'high', 'medium', 'low'
      - `category` (text) - 'energy', 'comfort', 'security', 'convenience'
      - `data` (jsonb) - Supporting data and metrics
      - `entities_involved` (text[]) - Related entity IDs
      - `status` (text) - 'pending', 'accepted', 'rejected', 'implemented'
      - `implemented_at` (timestamptz)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)

    - `rollback_points`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `action_log_id` (uuid, references action_logs)
      - `entity_states` (jsonb) - Complete state snapshot
      - `description` (text)
      - `can_rollback` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own logs and suggestions
    - Suggestions can be created by system (no user_id check on insert)

  3. Indexes
    - Index on user_id for fast filtering
    - Index on created_at for time-based queries
    - Index on entity_id for entity history
*/

-- Action Logs Table
CREATE TABLE IF NOT EXISTS action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  entity_id text NOT NULL,
  service text,
  data jsonb DEFAULT '{}'::jsonb,
  reason text,
  source text NOT NULL DEFAULT 'user_manual',
  before_state text,
  after_state text,
  success boolean DEFAULT true,
  error_message text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own action logs"
  ON action_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own action logs"
  ON action_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_entity_id ON action_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_source ON action_logs(source);

-- AI Suggestions Table
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  confidence numeric DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  impact text DEFAULT 'medium' CHECK (impact IN ('high', 'medium', 'low')),
  category text NOT NULL CHECK (category IN ('energy', 'comfort', 'security', 'convenience', 'maintenance')),
  data jsonb DEFAULT '{}'::jsonb,
  entities_involved text[] DEFAULT ARRAY[]::text[],
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'implemented', 'expired')),
  implemented_at timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestions"
  ON ai_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestions"
  ON ai_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert suggestions"
  ON ai_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_id ON ai_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created_at ON ai_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_category ON ai_suggestions(category);

-- Rollback Points Table
CREATE TABLE IF NOT EXISTS rollback_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_log_id uuid REFERENCES action_logs(id) ON DELETE CASCADE,
  entity_states jsonb NOT NULL,
  description text NOT NULL,
  can_rollback boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rollback_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rollback points"
  ON rollback_points FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rollback points"
  ON rollback_points FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_rollback_points_user_id ON rollback_points(user_id);
CREATE INDEX IF NOT EXISTS idx_rollback_points_action_log_id ON rollback_points(action_log_id);
CREATE INDEX IF NOT EXISTS idx_rollback_points_created_at ON rollback_points(created_at DESC);
