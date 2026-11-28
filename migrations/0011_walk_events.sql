PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS walk_events (
  id TEXT PRIMARY KEY,
  walk_id TEXT NOT NULL REFERENCES walks(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin','walker','customer')),
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('started','completed','note_added','photo_added')),
  event_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_walk_events_walk_time
  ON walk_events(walk_id, event_time, id);
CREATE INDEX IF NOT EXISTS idx_walk_events_actor
  ON walk_events(actor_role, actor_user_id, event_time);
