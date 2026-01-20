-- Verify Admin User Exists and Check Details
-- Run this to debug login issues

-- Check if admin user exists
SELECT 
  id,
  name,
  email,
  password,
  shop_id,
  roles,
  created_at
FROM users 
WHERE email = 'admin@phonemart.com';

-- If no results, the user doesn't exist. Run create_admin_user.sql first.

-- Check all users
SELECT id, name, email, roles FROM users ORDER BY created_at;

-- Check shops
SELECT id, name FROM shops;
