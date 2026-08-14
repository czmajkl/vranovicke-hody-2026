ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN dance_level TEXT;

CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_dance_level ON users(dance_level);
