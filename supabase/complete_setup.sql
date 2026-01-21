-- COMPLETE SETUP SCRIPT FOR PHONEMART POS
-- Run this entire script in Supabase SQL Editor to set up everything

-- ============================================
-- PART 1: CREATE ALL TABLES
-- ============================================

-- Suppliers
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  email text,
  address text,
  categories text[] not null default array['spare_parts']::text[],
  created_at timestamptz not null default now()
);

-- Inventory
create table if not exists inventory_items (
  id bigserial primary key,
  name text not null,
  category text not null check (category in ('Phone','Spare','Accessory')),
  item_type text,
  stock int not null default 0,
  price numeric not null default 0,
  reorder_level int not null default 0,
  initial_stock int not null default 0,
  shop_id text,
  supplier text,
  cost_price numeric,
  admin_cost_price numeric,
  pending_allocation boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists inventory_items_shop_id_idx on inventory_items(shop_id);
create index if not exists inventory_items_name_idx on inventory_items(name);

-- Purchases
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  supplier text not null,
  total numeric not null default 0,
  shop_id text
);

create table if not exists purchase_items (
  id bigserial primary key,
  purchase_id uuid not null references purchases(id) on delete cascade,
  item_id bigint not null,
  item_name text not null,
  qty int not null,
  cost_price numeric not null
);
create index if not exists purchase_items_purchase_id_idx on purchase_items(purchase_id);

-- Stock allocations
create table if not exists stock_allocations (
  id uuid primary key default gen_random_uuid(),
  item_id bigint not null,
  item_name text not null,
  total_qty int not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by text,
  requested_date timestamptz not null default now(),
  approved_by text,
  approved_date timestamptz
);

create table if not exists stock_allocation_lines (
  id bigserial primary key,
  allocation_id uuid not null references stock_allocations(id) on delete cascade,
  shop_id text not null,
  shop_name text not null,
  qty int not null
);
create index if not exists stock_allocation_lines_alloc_id_idx on stock_allocation_lines(allocation_id);

-- Returns / warranty claims
create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  customer_name text not null,
  customer_phone text,
  repair_id text,
  item_name text not null,
  item_type text not null,
  fault_description text not null,
  supplier_name text not null,
  supplier_id uuid,
  cost_price numeric not null default 0,
  status text not null default 'pending' check (status in ('pending','resolved','rejected')),
  resolution text,
  shop_id text
);

-- Repairs
create table if not exists repairs (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  customer_name text not null,
  phone_number text not null,
  imei text,
  phone_model text not null,
  issue text not null,
  technician text,
  outsourced_cost numeric not null default 0,
  labor_cost numeric not null default 0,
  total_cost numeric not null default 0,
  total_agreed_amount numeric,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','IN_PROGRESS','WAITING_PARTS','REPAIR_COMPLETED','PAYMENT_PENDING','FULLY_PAID','COLLECTED')),
  shop_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending','partial','fully_paid')),
  amount_paid numeric not null default 0,
  balance numeric not null default 0,
  customer_status text check (customer_status in ('waiting','coming_back')),
  payment_timing text check (payment_timing in ('before','after')),
  deposit_amount numeric,
  payment_approved boolean not null default false,
  payment_made boolean not null default false,
  pending_transaction_codes jsonb,
  ticket_number text,
  collected boolean not null default false
);
create index if not exists repairs_ticket_number_idx on repairs(ticket_number);

create table if not exists repair_parts (
  id bigserial primary key,
  repair_id uuid not null references repairs(id) on delete cascade,
  item_id bigint,
  item_name text not null,
  qty int not null,
  cost numeric not null default 0
);
create index if not exists repair_parts_repair_id_idx on repair_parts(repair_id);

create table if not exists additional_repair_items (
  id bigserial primary key,
  repair_id uuid not null references repairs(id) on delete cascade,
  item_name text not null,
  source text not null check (source in ('inventory','outsourced')),
  item_id bigint,
  supplier_name text
);
create index if not exists additional_repair_items_repair_id_idx on additional_repair_items(repair_id);

-- Sales
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  shop_id text,
  sale_type text not null check (sale_type in ('in-shop','wholesale','retail')),
  total numeric not null default 0,
  status text not null default 'closed' check (status in ('open','closed')),
  closed_at timestamptz
);
create index if not exists sales_shop_id_idx on sales(shop_id);
create index if not exists sales_date_idx on sales(date);

create table if not exists sale_items (
  id bigserial primary key,
  sale_id uuid not null references sales(id) on delete cascade,
  name text not null,
  qty int not null,
  price numeric not null
);
create index if not exists sale_items_sale_id_idx on sale_items(sale_id);

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid references repairs(id) on delete cascade,
  sale_id uuid references sales(id) on delete cascade,
  date timestamptz not null default now(),
  amount numeric not null,
  payment_method text not null,
  transaction_code text,
  bank_name text,
  shop_id text
);
create index if not exists payments_repair_id_idx on payments(repair_id);
create index if not exists payments_sale_id_idx on payments(sale_id);

-- Shops
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text not null,
  email text,
  whatsapp_group text,
  created_at timestamptz not null default now()
);

-- Users (Staff)
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

-- ============================================
-- PART 2: CREATE DEFAULT SHOP AND ADMIN USER
-- ============================================

-- Create default shop
insert into shops (name, address, phone, email)
values ('PHONEMART - Main Branch', 'THIKA', '+254715592682', 'main@phonemart.com')
on conflict do nothing;

-- Create admin user
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

  -- Create admin user
  insert into users (name, email, password, shop_id, roles)
  values ('Admin User', 'admin@phonemart.com', 'admin123', main_shop_id, ARRAY['admin'])
  on conflict (email) do update
  set password = 'admin123', roles = ARRAY['admin'];
end $$;

-- ============================================
-- PART 3: VERIFY SETUP
-- ============================================

-- Check admin user was created
select 'Admin User Created:' as status, id, name, email, roles 
from users 
where email = 'admin@phonemart.com';

-- Check shop was created
select 'Shop Created:' as status, id, name, address, phone 
from shops 
where name = 'PHONEMART - Main Branch';
