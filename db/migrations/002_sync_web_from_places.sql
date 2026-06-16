-- Update leads.web from places.web
-- This script syncs the web field from the places table to the leads table

UPDATE leads l
JOIN places p ON l.id = p.lead_id
SET l.web = p.web
WHERE p.web IS NOT NULL AND p.web <> ''
AND (l.web IS NULL OR l.web = '');
