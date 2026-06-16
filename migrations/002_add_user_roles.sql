-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'admin' AFTER email;

-- Add accessible_views column (JSON array of views commercial users can see)
ALTER TABLE users ADD COLUMN accessible_views JSON DEFAULT NULL AFTER role;

-- Create permissions table to define what each role can access
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  permission_key VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default role permissions
INSERT IGNORE INTO role_permissions (role_name, permission_key, description) VALUES
('admin', 'view_all_leads', 'Can view all leads'),
('admin', 'view_funnel', 'Can access lead funnel functionality'),
('admin', 'view_whatsapp_messages', 'Can view WhatsApp messages'),
('admin', 'manage_users', 'Can manage user accounts and roles'),
('admin', 'view_all_stats', 'Can view all statistics'),
('admin', 'edit_leads', 'Can edit lead information'),
('comercial', 'view_assigned_leads', 'Can view only assigned leads'),
('comercial', 'edit_assigned_leads', 'Can edit only assigned leads'),
('comercial', 'view_own_stats', 'Can view own statistics'),
('comercial', 'add_notes', 'Can add notes to leads');

-- Create table for user-to-admin permission mappings (for commercial users to see specific views)
CREATE TABLE IF NOT EXISTS user_view_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  view_name VARCHAR(100) NOT NULL,
  granted_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_view (user_id, view_name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);
