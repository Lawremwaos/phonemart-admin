# Fix Admin Login - Step by Step Guide

## Problem
Admin login shows "invalid email or password" because the admin user doesn't exist in the database.

## Solution: Create Admin User in Supabase

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project: `pufedomcrqrmngmcifux`
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Admin User Creation Script
Copy and paste this entire script into the SQL Editor:

```sql
-- Step 1: Create shops table if it doesn't exist
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text not null,
  email text,
  whatsapp_group text,
  created_at timestamptz not null default now()
);

-- Step 2: Create users table if it doesn't exist
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

-- Step 3: Create a default shop if none exists
insert into shops (name, address, phone, email)
values ('PHONEMART - Main Branch', 'THIKA', '+254715592682', 'main@phonemart.com')
on conflict do nothing;

-- Step 4: Create admin user
do $$
declare
  main_shop_id uuid;
begin
  -- Get or create main shop
  select id into main_shop_id from shops where name = 'PHONEMART - Main Branch' limit 1;
  
  if main_shop_id is null then
    insert into shops (name, address, phone, email)
    values ('PHONEMART - Main Branch', 'THIKA', '+254715592682', 'main@phonemart.com')
    returning id into main_shop_id;
  end if;

  -- Create admin user (or update if exists)
  insert into users (name, email, password, shop_id, roles)
  values ('Admin User', 'admin@phonemart.com', 'admin123', main_shop_id, ARRAY['admin'])
  on conflict (email) do update
  set password = 'admin123', roles = ARRAY['admin'];
end $$;

-- Step 5: Verify admin user was created
select id, name, email, roles from users where email = 'admin@phonemart.com';
```

### Step 3: Run the Query
1. Click **Run** (or press `Ctrl+Enter`)
2. You should see a success message
3. At the bottom, you should see the admin user details:
   - Email: `admin@phonemart.com`
   - Roles: `{admin}`

### Step 4: Test Login
1. Go to your Vercel site: https://phonemart-admin-eiqt.vercel.app/
2. Login with:
   - **Email:** `admin@phonemart.com`
   - **Password:** `admin123`

### Step 5: Add Ticket Columns (If Not Done)
Also run this to add the ticket system columns:

```sql
-- Add ticket_number and collected columns to repairs table
ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS ticket_number text,
ADD COLUMN IF NOT EXISTS collected boolean NOT NULL DEFAULT false;

-- Create index on ticket_number for faster lookups
CREATE INDEX IF NOT EXISTS repairs_ticket_number_idx ON repairs(ticket_number);
```

## Default Admin Credentials
- **Email:** admin@phonemart.com
- **Password:** admin123

## Troubleshooting

### If you still get "invalid email or password":
1. Check that the query ran successfully (no errors)
2. Verify the user exists: Run `SELECT * FROM users WHERE email = 'admin@phonemart.com';`
3. Check that environment variables are set in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Make sure you're using the correct email (case-sensitive): `admin@phonemart.com`

### To create additional staff users:
```sql
-- Replace with actual values
INSERT INTO users (name, email, password, shop_id, roles)
VALUES ('Staff Name', 'staff@phonemart.com', 'password123', 
  (SELECT id FROM shops LIMIT 1), 
  ARRAY['technician']);
```
