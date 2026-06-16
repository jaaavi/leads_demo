-- Migration: Add user_id column to jobs table
-- Allows filtering jobs by user for non-admin users

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id INT NULL;
ALTER TABLE jobs ADD INDEX IF NOT EXISTS idx_user_id (user_id);
