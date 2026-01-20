# 🔍 Debug Admin Login Issue

## Step 1: Verify Admin User Exists in Database

Run this in Supabase SQL Editor:

```sql
-- Check if admin user exists
SELECT id, name, email, password, roles, shop_id 
FROM users 
WHERE email = 'admin@phonemart.com';
```

**Expected Result:** Should return 1 row with:
- email: `admin@phonemart.com`
- password: `admin123`
- roles: `{admin}`

**If no results:** The user wasn't created. Run `create_admin_user.sql` again.

## Step 2: Check Browser Console

1. **Open your app**
2. **Press F12** (open browser console)
3. **Go to Console tab**
4. **Try to login**
5. **Look for these messages:**
   - "Loaded users from Supabase: X [array of emails]"
   - "Login attempt: {email: '...', usersCount: X}"
   - "Available users: [...]"
   - "Login successful: ..." OR "Login failed - user not found"

## Step 3: Common Issues & Fixes

### Issue 1: "Loaded users from Supabase: 0 []"
**Problem:** Users aren't loading from database
**Fix:** 
- Check Supabase connection (env vars set correctly?)
- Check browser console for Supabase errors
- Verify tables exist (run verification query)

### Issue 2: "usersCount: 0" when trying to login
**Problem:** Users array is empty when login is called
**Fix:**
- Wait a few seconds after page loads before logging in
- Check if there are Supabase connection errors
- Verify environment variables are set in Vercel

### Issue 3: User exists but password doesn't match
**Problem:** Password stored differently than expected
**Fix:**
- Run this to reset admin password:
  ```sql
  UPDATE users 
  SET password = 'admin123' 
  WHERE email = 'admin@phonemart.com';
  ```

### Issue 4: Email case mismatch
**Problem:** Email stored as `Admin@Phonemart.com` but you're typing `admin@phonemart.com`
**Fix:** Already handled - login now uses case-insensitive matching

## Step 4: Manual Password Reset

If login still doesn't work, reset the password:

```sql
-- Reset admin password
UPDATE users 
SET password = 'admin123' 
WHERE email = 'admin@phonemart.com';

-- Verify
SELECT email, password FROM users WHERE email = 'admin@phonemart.com';
```

## Step 5: Check All Users

See what users exist:

```sql
SELECT id, name, email, roles, created_at 
FROM users 
ORDER BY created_at;
```

## Quick Test: Direct Database Query

Run this to see exactly what's stored:

```sql
SELECT 
  'Email: ' || email as email_check,
  'Password: ' || password as password_check,
  'Password length: ' || length(password) as pwd_length,
  'Roles: ' || array_to_string(roles, ',') as roles_check
FROM users 
WHERE email = 'admin@phonemart.com';
```

This shows exactly what's stored in the database.

## Still Not Working?

Share the console output from Step 2, and I can help debug further!
