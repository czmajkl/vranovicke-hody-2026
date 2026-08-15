CREATE TABLE wine_donations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bottles INTEGER NOT NULL DEFAULT 1 CHECK (bottles > 0 AND bottles <= 12),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX wine_donations_user_idx ON wine_donations(user_id, created_at);
