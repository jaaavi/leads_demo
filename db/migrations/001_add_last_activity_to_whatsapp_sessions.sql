-- Migration: Ensure last_activity column exists in whatsapp_sessions table
-- This migration is safe to run multiple times as it checks for column existence

ALTER TABLE whatsapp_sessions ADD COLUMN last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- If the above fails with error 1060 (duplicate column), the migration has already been applied
