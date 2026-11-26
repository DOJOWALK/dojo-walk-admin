PRAGMA foreign_keys = ON;

-- Chat conversations are separate from walk_media. Chat attachments are PHOTO ONLY.
CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  conversation_type TEXT NOT NULL CHECK (conversation_type IN ('walk','support')),
  walk_id TEXT REFERENCES walks(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  walker_id TEXT REFERENCES walkers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (conversation_type = 'walk' AND walk_id IS NOT NULL AND customer_id IS NOT NULL AND walker_id IS NOT NULL)
    OR
    (conversation_type = 'support' AND walk_id IS NULL AND
      ((customer_id IS NOT NULL AND walker_id IS NULL) OR
       (customer_id IS NULL AND walker_id IS NOT NULL)))
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_one_walk_conversation
  ON chat_conversations(walk_id) WHERE conversation_type = 'walk';
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_open_customer_support
  ON chat_conversations(customer_id) WHERE conversation_type = 'support' AND status = 'open' AND customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_open_walker_support
  ON chat_conversations(walker_id) WHERE conversation_type = 'support' AND status = 'open' AND walker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_customer
  ON chat_conversations(customer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_walker
  ON chat_conversations(walker_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status
  ON chat_conversations(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin','walker','customer')),
  sender_id TEXT NOT NULL,
  message_text TEXT,
  photo_r2_key TEXT,
  photo_mime_type TEXT,
  photo_size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  CHECK (
    (message_text IS NOT NULL AND length(trim(message_text)) BETWEEN 1 AND 4000)
    OR photo_r2_key IS NOT NULL
  ),
  CHECK (
    (photo_r2_key IS NULL AND photo_mime_type IS NULL AND photo_size_bytes IS NULL)
    OR
    (photo_r2_key IS NOT NULL
      AND photo_mime_type IN ('image/jpeg','image/png','image/webp')
      AND photo_size_bytes BETWEEN 1 AND 10485760)
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_time
  ON chat_messages(conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON chat_messages(conversation_id, read_at, created_at);
