ALTER TABLE users ADD COLUMN relationship_status TEXT NOT NULL DEFAULT 'not_looking';

CREATE INDEX IF NOT EXISTS users_relationship_status_idx
ON users(relationship_status);
