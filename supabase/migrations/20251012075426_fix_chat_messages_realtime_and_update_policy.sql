/*
  # Fix Chat Messages Real-time Sync and Update Policy

  ## Changes
  1. Add UPDATE policy for chat_messages table (was missing!)
     - Allows feedback updates to be saved to database
     - Required for real-time sync to work properly
  
  2. Enable Realtime replication on chat_messages table
     - Broadcasts INSERT, UPDATE, DELETE events via WebSocket
     - Required for both chats to receive real-time updates
  
  ## Security
  - Public UPDATE policy (consistent with existing demo policies)
  - Realtime enabled for instant bidirectional sync
*/

-- Drop policy if it exists and recreate
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_messages' 
    AND policyname = 'Public update access to chat_messages'
  ) THEN
    DROP POLICY "Public update access to chat_messages" ON chat_messages;
  END IF;
END $$;

-- Add UPDATE policy for chat_messages
CREATE POLICY "Public update access to chat_messages"
  ON chat_messages FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Enable Realtime replication on chat_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;