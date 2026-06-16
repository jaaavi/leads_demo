-- Migration: Create WhatsApp session and messaging tables
-- Created for WhatsApp integration with lead messaging

-- WhatsApp Sessions table - stores WhatsApp bot connection info
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  instance_id VARCHAR(255) UNIQUE NOT NULL,
  qr_code LONGTEXT,
  qr_code_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  connected INT DEFAULT 0,
  phone_number VARCHAR(20),
  bot_name VARCHAR(255),
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_instance_id (instance_id),
  INDEX idx_connected (connected)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WhatsApp Messages table - stores sent and received messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  instance_id VARCHAR(255) NOT NULL,
  lead_id INT,
  recipient_phone VARCHAR(20) NOT NULL,
  message_text LONGTEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  direction VARCHAR(10) DEFAULT 'outbound',
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  delivery_status VARCHAR(50) DEFAULT 'pending',
  external_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  INDEX idx_instance_id (instance_id),
  INDEX idx_lead_id (lead_id),
  INDEX idx_recipient_phone (recipient_phone),
  INDEX idx_created_at (created_at),
  INDEX idx_direction (direction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Message Templates table - stores personalized message templates
CREATE TABLE IF NOT EXISTS message_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  variables JSON,
  created_by INT,
  is_active INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add phone_type column to places table if it doesn't exist
ALTER TABLE places ADD COLUMN IF NOT EXISTS phone_type VARCHAR(50) DEFAULT NULL COMMENT 'fixed or mobile';

-- Add city column to leads table if it doesn't exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city VARCHAR(255) DEFAULT NULL;

-- Add city and phone_type filtering indexes
ALTER TABLE places ADD INDEX IF NOT EXISTS idx_city_phone_type (city, phone_type);
ALTER TABLE leads ADD INDEX IF NOT EXISTS idx_city (city);
