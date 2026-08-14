ALTER TABLE users ADD COLUMN drink_preference TEXT;

ALTER TABLE photos ADD COLUMN web_photo_data TEXT;
ALTER TABLE photos ADD COLUMN interaction_id TEXT REFERENCES interactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_drink_preference ON users(drink_preference);
CREATE INDEX IF NOT EXISTS idx_photos_interaction ON photos(interaction_id);
