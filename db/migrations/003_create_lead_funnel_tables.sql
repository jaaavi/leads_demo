-- Migration: Create lead funnel management tables
-- Tracks funnel phases and collects lead data across multiple stages

-- Table to track current funnel phase for each lead
CREATE TABLE IF NOT EXISTS lead_funnel_phases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL UNIQUE,
  current_phase INT DEFAULT 1 COMMENT '1=Apertura, 2=Recopilacion, 3=Prompt, 4=Cierre',
  opening_message_type VARCHAR(50) COMMENT 'NATURAL, CORTA, AGENCIA, PERSONAL',
  opening_message_sent_at TIMESTAMP NULL,
  opening_message_sent TINYINT DEFAULT 0,
  phase_2_completed TINYINT DEFAULT 0,
  phase_2_completed_at TIMESTAMP NULL,
  phase_3_prompt_generated TINYINT DEFAULT 0,
  phase_3_prompt_generated_at TIMESTAMP NULL,
  phase_4_preview_url VARCHAR(500),
  phase_4_message_sent TINYINT DEFAULT 0,
  phase_4_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_lead (lead_id),
  INDEX idx_phase (current_phase)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table to store phase 2 (Recopilacion) form data
CREATE TABLE IF NOT EXISTS lead_funnel_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL UNIQUE,
  sector VARCHAR(255),
  descripcion LONGTEXT COMMENT 'Una frase que defina lo que ofrecen o los hace diferentes',
  servicios LONGTEXT COMMENT 'Servicios o productos principales',
  redes_sociales VARCHAR(500),
  fotos_representativas LONGTEXT COMMENT 'URLs o referencias a fotos',
  estilo_web VARCHAR(255) COMMENT 'moderna, limpia, acogedora, profesional, elegante, etc.',
  referencias_visuales LONGTEXT COMMENT 'Descripciones o URLs de referencias',
  direccion VARCHAR(500),
  telefofo_contacto VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table to store phase 3 generated prompts
CREATE TABLE IF NOT EXISTS lead_funnel_prompts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  prompt_content LONGTEXT COMMENT 'Generated prompt for the web designer',
  created_by INT COMMENT 'User who generated the prompt',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
