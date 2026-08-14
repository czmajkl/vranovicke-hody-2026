ALTER TABLE users ADD COLUMN profile_photo_data TEXT;

CREATE TABLE interaction_questions (
  interaction_id TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (interaction_id, question_text)
);

CREATE INDEX interaction_questions_interaction_idx ON interaction_questions(interaction_id);

CREATE TABLE shots (
  id TEXT PRIMARY KEY,
  giver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT
);

CREATE INDEX shots_giver_idx ON shots(giver_user_id, created_at);
CREATE INDEX shots_recipient_idx ON shots(current_recipient_user_id, status, created_at);
CREATE INDEX shots_accepted_idx ON shots(accepted_by_user_id, accepted_at);

CREATE TABLE shot_transfers (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX shot_transfers_shot_idx ON shot_transfers(shot_id, created_at);
