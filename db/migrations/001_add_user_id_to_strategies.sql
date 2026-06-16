-- Add user_id column to strategies table to support user-specific strategies for comercial_pro users
ALTER TABLE strategies ADD COLUMN user_id INT DEFAULT NULL;

-- Create index for user_id to improve query performance
CREATE INDEX idx_user_id ON strategies(user_id);

-- Create composite index for user_id and is_active for faster filtering
CREATE INDEX idx_user_active ON strategies(user_id, is_active);
