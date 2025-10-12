/*
  # AI Learning and Training Data Schema

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text) - Auto-generated summary of conversation
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references conversations)
      - `role` (text) - 'user' or 'assistant'
      - `content` (text) - The message content
      - `metadata` (jsonb) - Additional context (entities mentioned, actions taken, etc.)
      - `created_at` (timestamptz)
      
    - `user_corrections`
      - `id` (uuid, primary key)
      - `message_id` (uuid, references messages)
      - `original_response` (text)
      - `corrected_response` (text)
      - `correction_type` (text) - 'entity_name', 'action', 'intent', 'preference', etc.
      - `created_at` (timestamptz)
      
    - `learned_patterns`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `pattern_type` (text) - 'preference', 'routine', 'command_alias', 'context'
      - `pattern_key` (text) - The pattern identifier
      - `pattern_value` (jsonb) - The pattern data
      - `confidence_score` (float) - 0-1 score indicating pattern reliability
      - `usage_count` (integer) - How many times this pattern has been used
      - `last_used_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `conversation_embeddings`
      - `id` (uuid, primary key)
      - `message_id` (uuid, references messages)
      - `embedding` (vector(384)) - Text embedding for semantic search
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own conversations and learning data
    - Implement policies for authenticated users

  3. Indexes
    - Index on conversation timestamps for efficient retrieval
    - Index on pattern_type and pattern_key for fast lookups
    - GiST index on embeddings for vector similarity search
*/

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from own conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- User corrections table
CREATE TABLE IF NOT EXISTS user_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  original_response text NOT NULL,
  corrected_response text NOT NULL,
  correction_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view corrections for own messages"
  ON user_corrections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      WHERE messages.id = user_corrections.message_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create corrections for own messages"
  ON user_corrections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      WHERE messages.id = user_corrections.message_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Learned patterns table
CREATE TABLE IF NOT EXISTS learned_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pattern_type text NOT NULL,
  pattern_key text NOT NULL,
  pattern_value jsonb NOT NULL,
  confidence_score float DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count integer DEFAULT 0,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pattern_type, pattern_key)
);

ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learned patterns"
  ON learned_patterns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own learned patterns"
  ON learned_patterns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learned patterns"
  ON learned_patterns FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own learned patterns"
  ON learned_patterns FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Conversation embeddings table
CREATE TABLE IF NOT EXISTS conversation_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  embedding vector(384),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversation_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view embeddings for own messages"
  ON conversation_embeddings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      WHERE messages.id = conversation_embeddings.message_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create embeddings for own messages"
  ON conversation_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      WHERE messages.id = conversation_embeddings.message_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_created 
  ON conversations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_user_type 
  ON learned_patterns(user_id, pattern_type, pattern_key);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_last_used 
  ON learned_patterns(user_id, last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_embeddings_message 
  ON conversation_embeddings(message_id);

-- Create GiST index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector 
  ON conversation_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function to update conversation updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET updated_at = now() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp when new message is added
DROP TRIGGER IF EXISTS update_conversation_on_message ON messages;
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Function to update learned pattern timestamp and usage
CREATE OR REPLACE FUNCTION update_pattern_usage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_used_at = now();
  NEW.usage_count = NEW.usage_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update pattern usage stats
DROP TRIGGER IF EXISTS update_pattern_stats ON learned_patterns;
CREATE TRIGGER update_pattern_stats
  BEFORE UPDATE ON learned_patterns
  FOR EACH ROW
  WHEN (OLD.pattern_value IS DISTINCT FROM NEW.pattern_value)
  EXECUTE FUNCTION update_pattern_usage();
