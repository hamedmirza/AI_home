/*
  # Home Assistant Database Schema

  ## Overview
  This migration creates the complete database structure for Home Assistant integration,
  including entity caching, historical data tracking, chat history, and user preferences.

  ## Tables Created

  ### 1. entities
  Caches Home Assistant entities for fast lookups and reduces API calls
  - `entity_id` (text, primary key) - Unique entity identifier from Home Assistant
  - `friendly_name` (text) - Human-readable name
  - `domain` (text) - Entity domain (sensor, light, switch, etc.)
  - `state` (text) - Current state value
  - `unit_of_measurement` (text, nullable) - Unit for sensors
  - `device_class` (text, nullable) - Type classification
  - `attributes` (jsonb) - Full attributes object from Home Assistant
  - `last_updated` (timestamptz) - When state was last updated
  - `last_synced` (timestamptz) - When entity was last synced from HA
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. entity_history
  Tracks historical state changes for sensors and other entities
  - `id` (uuid, primary key) - Unique record identifier
  - `entity_id` (text, foreign key) - References entities table
  - `state` (text) - State value at this time
  - `state_numeric` (numeric, nullable) - Numeric state for calculations
  - `attributes` (jsonb) - Attributes snapshot at this time
  - `recorded_at` (timestamptz) - When this state was recorded
  - `created_at` (timestamptz) - Record creation timestamp

  ### 3. chat_messages
  Stores AI assistant conversation history
  - `id` (uuid, primary key) - Unique message identifier
  - `session_id` (text) - Groups messages by conversation session
  - `role` (text) - Either 'user' or 'assistant'
  - `content` (text) - Message content
  - `metadata` (jsonb, nullable) - Additional data (tokens used, model, etc.)
  - `created_at` (timestamptz) - Message timestamp

  ### 4. user_preferences
  Stores user settings and preferences
  - `id` (uuid, primary key) - Unique preference identifier
  - `key` (text, unique) - Preference key
  - `value` (jsonb) - Preference value (flexible JSON storage)
  - `updated_at` (timestamptz) - Last update timestamp
  - `created_at` (timestamptz) - Record creation timestamp

  ### 5. sync_status
  Tracks synchronization status for background jobs
  - `id` (uuid, primary key) - Unique status identifier
  - `sync_type` (text, unique) - Type of sync (entities, history, etc.)
  - `last_sync_at` (timestamptz) - When sync last completed
  - `next_sync_at` (timestamptz, nullable) - Scheduled next sync
  - `status` (text) - Current status (idle, running, error)
  - `error_message` (text, nullable) - Error details if failed
  - `metadata` (jsonb) - Additional sync information
  - `updated_at` (timestamptz) - Last update timestamp

  ## Indexes
  - Entity lookups by domain and friendly_name
  - Historical data queries by entity_id and time range
  - Chat message retrieval by session_id and timestamp
  - Preference key lookups

  ## Security
  - RLS enabled on all tables
  - Public access policies (no auth required for this demo)
  - Production deployments should implement proper authentication
*/

-- Create entities table for caching Home Assistant entities
CREATE TABLE IF NOT EXISTS entities (
  entity_id text PRIMARY KEY,
  friendly_name text NOT NULL,
  domain text NOT NULL,
  state text NOT NULL,
  unit_of_measurement text,
  device_class text,
  attributes jsonb DEFAULT '{}'::jsonb,
  last_updated timestamptz DEFAULT now(),
  last_synced timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for domain-based queries
CREATE INDEX IF NOT EXISTS idx_entities_domain ON entities(domain);
CREATE INDEX IF NOT EXISTS idx_entities_friendly_name ON entities(friendly_name);
CREATE INDEX IF NOT EXISTS idx_entities_last_synced ON entities(last_synced);

-- Create entity_history table for time-series data
CREATE TABLE IF NOT EXISTS entity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL,
  state text NOT NULL,
  state_numeric numeric,
  attributes jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_entity FOREIGN KEY (entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE
);

-- Create indexes for historical queries
CREATE INDEX IF NOT EXISTS idx_entity_history_entity_id ON entity_history(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_history_recorded_at ON entity_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_history_entity_time ON entity_history(entity_id, recorded_at DESC);

-- Create chat_messages table for AI conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for chat history queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time ON chat_messages(session_id, created_at ASC);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for preference lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key);

-- Create sync_status table for tracking background sync jobs
CREATE TABLE IF NOT EXISTS sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text UNIQUE NOT NULL,
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error', 'disabled')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Create index for sync status queries
CREATE INDEX IF NOT EXISTS idx_sync_status_type ON sync_status(sync_type);

-- Enable Row Level Security
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (demo mode - tighten for production)
CREATE POLICY "Public read access to entities"
  ON entities FOR SELECT
  USING (true);

CREATE POLICY "Public write access to entities"
  ON entities FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to entities"
  ON entities FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public delete access to entities"
  ON entities FOR DELETE
  USING (true);

CREATE POLICY "Public read access to entity_history"
  ON entity_history FOR SELECT
  USING (true);

CREATE POLICY "Public write access to entity_history"
  ON entity_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public read access to chat_messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Public write access to chat_messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public delete access to chat_messages"
  ON chat_messages FOR DELETE
  USING (true);

CREATE POLICY "Public read access to user_preferences"
  ON user_preferences FOR SELECT
  USING (true);

CREATE POLICY "Public write access to user_preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to user_preferences"
  ON user_preferences FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access to sync_status"
  ON sync_status FOR SELECT
  USING (true);

CREATE POLICY "Public write access to sync_status"
  ON sync_status FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to sync_status"
  ON sync_status FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Initialize sync_status records
INSERT INTO sync_status (sync_type, status, metadata)
VALUES 
  ('entities', 'idle', '{"interval_minutes": 5}'::jsonb),
  ('history', 'idle', '{"interval_minutes": 1}'::jsonb)
ON CONFLICT (sync_type) DO NOTHING;