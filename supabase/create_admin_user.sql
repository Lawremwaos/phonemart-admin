-- Quick Fix: Create Admin User Manually
-- Run this in Supabase SQL Editor if admin login is not working

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

-- Step 4: Get the shop ID (or create if needed)
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

-- Verify admin user was created
select id, name, email, roles from users where email = 'admin@phonemart.com';
