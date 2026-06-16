-- Migration: Add reminder_subject and job_id fields
-- Allows tracking which job scraped a place/lead and specify reminder types

ALTER TABLE places ADD COLUMN job_id INT NULL;
ALTER TABLE places ADD COLUMN reminder_subject ENUM('previsualización', 'visita_en_persona', 'contactar_de_nuevo', 'insistir') NULL;
ALTER TABLE places ADD INDEX idx_job_id (job_id);

ALTER TABLE leads ADD COLUMN job_id INT NULL;
ALTER TABLE leads ADD COLUMN reminder_subject ENUM('previsualización', 'visita_en_persona', 'contactar_de_nuevo', 'insistir') NULL;
ALTER TABLE leads ADD INDEX idx_job_id (job_id);
