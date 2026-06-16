-- Migration: Add soft delete support with deleted_at column to leads and places tables
-- This migration adds deleted_at timestamps to enable soft deletes instead of hard deletes

-- Add deleted_at column to leads table
ALTER TABLE leads ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;

-- Add index on deleted_at for efficient filtering of active records
CREATE INDEX idx_leads_deleted_at ON leads(deleted_at);

-- Add deleted_at column to places table
ALTER TABLE places ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;

-- Add index on deleted_at for efficient filtering of active records
CREATE INDEX idx_places_deleted_at ON places(deleted_at);
