-- Add barrio (neighborhood) column to places table for Nominatim enrichment
ALTER TABLE places ADD COLUMN barrio VARCHAR(255) DEFAULT NULL AFTER city;
ALTER TABLE places ADD INDEX idx_barrio (barrio);
