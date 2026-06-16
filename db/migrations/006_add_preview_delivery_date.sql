-- Migration: add preview_delivery_date to leads
ALTER TABLE leads
  ADD COLUMN preview_delivery_date DATETIME NULL DEFAULT NULL;
