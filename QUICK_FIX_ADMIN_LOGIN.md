# 🚨 QUICK FIX: Admin Login Not Working

## Problem
Admin credentials (`admin@phonemart.com` / `admin123`) are not working.

## Solution: Run This SQL in Supabase

### Step 1: Go to Supabase SQL Editor
1. Visit: https://supabase.com/dashboard
2. Open project: `pufedomcrqrmngmcifux`
3. Click **SQL Editor** → **New query**

### Step 2: Copy and Run This SQL

Open the file `supabase/create_admin_user.sql` and copy ALL the SQL code, OR copy this:

```sql
-- Create shops table if it doesn't exist
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text not null,
  email text,
  whatsapp_group text,
  created_at timestamptz not null default now()
);

-- Create users table if it doesn't exist
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  shop_id uuid references shops(id) on delete cascade,
  roles text[] not null default array['technician']::text[],
  created_at timestamptz not null default now()
);
create index if not exists users_shop_id_idx on users(shop_id);
create index if not exists users_email_idx on users(email);

-- Create default shop
insert into shops (name, address, phone, email)
values ('PHONEMART - Main Branch', 'THIKA', '+254715592682', 'main@phonemart.com')
on conflict do nothing;

-- Create admin user
do $$
declare
  main_shop_id uuid;
begin
  select id into main_shop_id from shops where name = 'PHONEMART - Main Branch' limit 1;
  
  if main_shop_id is null then
    insert into shops (name, address, phone, email)
    values ('PHONEMART - Main Branch', 'THIKA', '+254715592682', 'main@phonemart.com')
    returning id into main_shop_id;
  end if;

  insert into users (name, email, password, shop_id, roles)
  values ('Admin User', 'admin@phonemart.com', 'admin123', main_shop_id, ARRAY['admin'])
  on conflict (email) do update
  set password = 'admin123', roles = ARRAY['admin'];
end $$;

-- Verify
select id, name, email, roles from users where email = 'admin@phonemart.com';
```

### Step 3: Click "Run"

You should see:
- "Success. No rows returned" (for CREATE TABLE statements)
- A row showing the admin user (from the SELECT at the end)

### Step 4: Test Login

1. **Refresh your app** (or wait for Vercel to redeploy)
2. **Login with:**
   - Email: `admin@phonemart.com`
   - Password: `admin123`

## What This Does

1. ✅ Creates `shops` table (if missing)
2. ✅ Creates `users` table (if missing)
3. ✅ Creates default shop
4. ✅ Creates admin user with correct credentials
5. ✅ Verifies admin user exists

## After Running SQL

1. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Try login again**
3. **Should work now!**

## Still Not Working?

1. **Check browser console** (F12) for errors
2. **Verify tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name IN ('shops', 'users');
   ```
   Should return 2 rows.

3. **Verify admin user exists:**
   ```sql
   SELECT * FROM users WHERE email = 'admin@phonemart.com';
   ```
   Should return 1 row with email, password, and roles.

4. **Check Supabase project is active** (not paused)

## Create More Users

After admin login works, you can add more staff via:
- **Admin Settings** → **Staff** tab (in the app)
- Or manually via SQL (see examples in `supabase/schema.sql`)
