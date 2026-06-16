-- Add soft delete support to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at);

-- Add soft delete support to places table
ALTER TABLE places ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_places_deleted_at ON places(deleted_at);
