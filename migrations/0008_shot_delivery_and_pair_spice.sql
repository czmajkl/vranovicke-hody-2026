ALTER TABLE shots ADD COLUMN delivered_at TEXT;
ALTER TABLE shots ADD COLUMN delivered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shots_delivery_idx
ON shots(giver_user_id, status, delivered_at, accepted_at);

CREATE TABLE pair_spice_events (
  id TEXT PRIMARY KEY,
  interaction_id TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('spicy', 'extra')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(interaction_id, level)
);

CREATE INDEX IF NOT EXISTS pair_spice_pair_idx
ON pair_spice_events(user_a_id, user_b_id, level, created_at);
