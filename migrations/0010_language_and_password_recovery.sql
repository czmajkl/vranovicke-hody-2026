ALTER TABLE users ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'cs' CHECK (preferred_language IN ('cs', 'en'));
ALTER TABLE users ADD COLUMN recovery_pin_hash TEXT;

CREATE INDEX IF NOT EXISTS users_preferred_language_idx
ON users(preferred_language);
