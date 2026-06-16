-- Migration: Add instance_id column to whatsapp_messages table
-- Ensures messages are properly linked to WhatsApp session instances

ALTER TABLE whatsapp_messages ADD COLUMN instance_id VARCHAR(255) NOT NULL DEFAULT 'main-bot' AFTER id;
CREATE INDEX idx_instance ON whatsapp_messages(instance_id);
