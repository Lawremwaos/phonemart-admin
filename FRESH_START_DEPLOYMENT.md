# Fresh Start - Deploy New Vercel Project

## Step 1: Delete Old Projects in Vercel

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. For each of the 6 projects:
   - Click on the project
   - Go to **Settings** (gear icon)
   - Scroll to the bottom
   - Click **Delete Project**
   - Type the project name to confirm
   - Click **Delete**

## Step 2: Create New Project

1. In Vercel Dashboard, click **Add New...** → **Project**
2. Import from Git:
   - Select **GitHub**
   - Authorize if needed
   - Find and select: **Lawremwaos/phonemart-admin**
   - Click **Import**

3. Configure Project:
   - **Project Name:** `phonemart-admin` (or any name you prefer)
   - **Framework Preset:** Vite (should auto-detect)
   - **Root Directory:** `./` (leave as default)
   - **Build Command:** `npm run build` (should be auto-filled)
   - **Output Directory:** `dist` (should be auto-filled)
   - **Install Command:** `npm install` (should be auto-filled)

4. **Environment Variables** (IMPORTANT - Add these BEFORE deploying):
   - Click **Environment Variables**
   - Add these two variables:

   **Variable 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://pufedomcrqrmngmcifux.supabase.co`
   - Environments: Select all (Production, Preview, Development)

   **Variable 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmVkb21jcnFybW5nbWNpZnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4Nzk4ODcsImV4cCI6MjA4NDQ1NTg4N30.Mi6oizD0LyC7p3RmMS-85J9MXiLfIrq6Q-k2tFt5yOw`
   - Environments: Select all (Production, Preview, Development)

5. Click **Deploy**

## Step 3: Set Up Database (Supabase)

After deployment, you need to set up the database:

1. Go to Supabase: https://supabase.com/dashboard
2. Select your project: `pufedomcrqrmngmcifux`
3. Click **SQL Editor** → **New Query**

4. **Run the Full Schema** (copy from `supabase/schema.sql`):
   - This creates all tables

5. **Create Admin User** (run this script):

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
```

6. **Add Ticket Columns** (run this):

```sql
ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS ticket_number text,
ADD COLUMN IF NOT EXISTS collected boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS repairs_ticket_number_idx ON repairs(ticket_number);
```

## Step 4: Test Login

1. Go to your new Vercel deployment URL
2. Login with:
   - **Email:** `admin@phonemart.com`
   - **Password:** `admin123`

## Step 5: Verify Everything Works

- ✅ Login works
- ✅ Dashboard loads
- ✅ Can create repair sales
- ✅ Can view inventory
- ✅ Can view pending collections

## Important Notes

- **Keep this one project** - Don't create multiple projects for the same repo
- **Environment variables** must be set BEFORE first deployment
- **Database setup** must be done in Supabase SQL Editor
- **Bookmark the new URL** so you always use the correct one

## If Something Goes Wrong

1. Check Vercel deployment logs for errors
2. Verify environment variables are set correctly
3. Check Supabase SQL Editor for any errors
4. Make sure you're using the correct project URL
