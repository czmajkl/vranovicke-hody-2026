ALTER TABLE shots ADD COLUMN shot_kind TEXT NOT NULL DEFAULT 'slivovica';

CREATE TABLE photo_challenge_completions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, challenge_id)
);

CREATE INDEX photo_challenge_completions_user_idx
  ON photo_challenge_completions(user_id, completed_at);
