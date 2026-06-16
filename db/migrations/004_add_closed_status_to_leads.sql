-- Migration: add 'closed' to leads.status enum
-- This migration modifies the ENUM of the 'status' column to include 'closed'.

ALTER TABLE leads MODIFY status ENUM('new', 'contacted', 'qualified', 'converted', 'discarded', 'closed') DEFAULT 'new';
