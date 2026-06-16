-- Migration: create jobs and saved_locations tables

CREATE TABLE IF NOT EXISTS jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lugar VARCHAR(255) NOT NULL,
  variations_total INT DEFAULT 0,
  processed INT DEFAULT 0,
  status ENUM('queued','running','done','failed') DEFAULT 'queued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL DEFAULT NULL,
  meta JSON NULL
);

CREATE TABLE IF NOT EXISTS saved_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  source VARCHAR(100) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
