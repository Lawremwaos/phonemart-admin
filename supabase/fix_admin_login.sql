-- Fix Admin Login - Run this in Supabase SQL Editor
-- This will ensure the admin user exists with correct credentials

-- Step 1: Ensure shops table exists
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text not null,
  email text,
  whatsapp_group text,
  created_at timestamptz not null default now()
);

-- Step 2: Ensure users table exists
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  shop_id uuid references shops(id) on delete cascade,
  roles text[] not null default array['technician']::text[],
  created_at timestamptz not null default now()
);

-- Create indexes if they don't exist
create index if not exists users_shop_id_idx on users(shop_id);
create index if not exists users_email_idx on users(email);

-- Step 3: Create or get main shop
do $$
declare
  main_shop_id uuid;
begin
  -- Get existing shop or create new one
  select id into main_shop_id from shops where name = 'PHONEMART - Main Branch' limit 1;
  
  if main_shop_id is null then
    insert into shops (name, address, phone, email)
    values ('PHONEMART - Main Branch', 'THIKA', '+254715592682', 'main@phonemart.com')
    returning id into main_shop_id;
  end if;

  -- Delete existing admin user if exists (to recreate with correct password)
  delete from users where email = 'admin@phonemart.com';

  -- Create admin user with password 'admin123'
  insert into users (name, email, password, shop_id, roles)
  values ('Admin User', 'admin@phonemart.com', 'admin123', main_shop_id, ARRAY['admin']);
  
  raise notice 'Admin user created successfully!';
end $$;

-- Step 4: Verify admin user was created
select 
  u.id, 
  u.name, 
  u.email, 
  u.roles,
  s.name as shop_name
from users u
left join shops s on u.shop_id = s.id
where u.email = 'admin@phonemart.com';

-- Expected result: You should see one row with:
-- email: admin@phonemart.com
-- password: admin123
-- roles: {admin}
