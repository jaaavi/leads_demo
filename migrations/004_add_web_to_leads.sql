-- Add web field to leads table
ALTER TABLE leads ADD COLUMN web VARCHAR(255) DEFAULT NULL AFTER phone;
ALTER TABLE leads ADD COLUMN phone_type VARCHAR(50) DEFAULT NULL AFTER phone;
ALTER TABLE leads ADD COLUMN city VARCHAR(100) DEFAULT NULL AFTER phone_type;
ALTER TABLE leads ADD COLUMN assigned_to INT DEFAULT NULL AFTER status;
ALTER TABLE leads ADD COLUMN estimated_value DECIMAL(12,2) DEFAULT 0 AFTER assigned_to;
ALTER TABLE leads ADD COLUMN estimated_benefit DECIMAL(12,2) DEFAULT 0 AFTER estimated_value;
ALTER TABLE leads ADD COLUMN contact_method VARCHAR(50) DEFAULT NULL AFTER estimated_benefit;
ALTER TABLE leads ADD COLUMN tags TEXT DEFAULT NULL AFTER contact_method;

-- Add foreign key for assigned_to
ALTER TABLE leads ADD FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_phone_type ON leads(phone_type);
CREATE INDEX idx_leads_city ON leads(city);
