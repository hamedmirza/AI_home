/*
  # Fix AI Learning and Realtime for Anonymous Users

  1. Changes to RLS Policies
    - Allow anonymous users to read/write chat_messages
    - Allow anonymous users to use AI learning tables
  
  2. Security
    - Still maintain RLS but allow anonymous access
*/

-- Drop existing RLS policies on chat_messages that might block anonymous users
DROP POLICY IF EXISTS "Anyone can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can create chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can update chat messages" ON chat_messages;

-- Create permissive policies for chat_messages (allow anonymous)
CREATE POLICY "Anyone can view chat messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update chat messages"
  ON chat_messages FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Make learned_patterns work without requiring real auth
DROP POLICY IF EXISTS "Users can view own learned patterns" ON learned_patterns;
DROP POLICY IF EXISTS "Users can create own learned patterns" ON learned_patterns;
DROP POLICY IF EXISTS "Users can update own learned patterns" ON learned_patterns;
DROP POLICY IF EXISTS "Users can delete own learned patterns" ON learned_patterns;

-- Allow user_id to be NULL for anonymous users
ALTER TABLE learned_patterns ALTER COLUMN user_id DROP NOT NULL;

-- Drop old unique constraint
ALTER TABLE learned_patterns DROP CONSTRAINT IF EXISTS learned_patterns_user_id_pattern_type_pattern_key_key;

-- Create new permissive policies for learned_patterns
CREATE POLICY "Anyone can view learned patterns"
  ON learned_patterns FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create learned patterns"
  ON learned_patterns FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update learned patterns"
  ON learned_patterns FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete learned patterns"
  ON learned_patterns FOR DELETE
  USING (true);

-- Make conversations work without auth
ALTER TABLE conversations ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;

CREATE POLICY "Anyone can view conversations"
  ON conversations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update conversations"
  ON conversations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete conversations"
  ON conversations FOR DELETE
  USING (true);

-- Update messages table policies
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON messages;
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON messages;

CREATE POLICY "Anyone can view messages"
  ON messages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create messages"
  ON messages FOR INSERT
  WITH CHECK (true);

-- Update user_corrections policies
DROP POLICY IF EXISTS "Users can view corrections for own messages" ON user_corrections;
DROP POLICY IF EXISTS "Users can create corrections for own messages" ON user_corrections;

CREATE POLICY "Anyone can view corrections"
  ON user_corrections FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create corrections"
  ON user_corrections FOR INSERT
  WITH CHECK (true);

-- Update conversation_embeddings policies
DROP POLICY IF EXISTS "Users can view embeddings for own messages" ON conversation_embeddings;
DROP POLICY IF EXISTS "Users can create embeddings for own messages" ON conversation_embeddings;

CREATE POLICY "Anyone can view embeddings"
  ON conversation_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create embeddings"
  ON conversation_embeddings FOR INSERT
  WITH CHECK (true);