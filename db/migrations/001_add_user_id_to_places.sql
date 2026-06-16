ALTER TABLE places ADD COLUMN user_id INT NULL;
ALTER TABLE places ADD CONSTRAINT fk_places_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_places_user_id ON places(user_id);
