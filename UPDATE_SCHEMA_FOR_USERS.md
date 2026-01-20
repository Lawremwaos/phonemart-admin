# ⚠️ IMPORTANT: Update Supabase Schema for User Persistence

## Problem Fixed
Staff login credentials were not persisting because users and shops were stored only in browser memory. Now they're stored in Supabase database.

## Action Required: Update Your Supabase Schema

### Step 1: Go to Supabase SQL Editor
1. Visit: https://supabase.com/dashboard
2. Open your project: `pufedomcrqrmngmcifux`
3. Click **SQL Editor** → **New query**

### Step 2: Run This SQL Code

Copy and paste this into the SQL Editor:

```sql
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
```

### Step 3: Click "Run"

You should see "Success. No rows returned" (this is correct!)

### Step 4: Verify Tables Were Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('shops', 'users')
ORDER BY table_name;
```

Expected result: 2 rows (shops and users)

## What This Does

1. **Creates `shops` table** - Stores all shop locations
2. **Creates `users` table** - Stores all staff members with their credentials
3. **Auto-creates default data** - On first app load, default shops and users are created automatically

## Default Login Credentials (Created Automatically)

After running the schema, the app will automatically create:

**Admin:**
- Email: `admin@phonemart.com`
- Password: `admin123`

**Technicians:**
- Email: `tech1@phonemart.com` / Password: `tech123`
- Email: `tech2@phonemart.com` / Password: `tech123`
- Email: `tech3@phonemart.com` / Password: `tech123`
- Email: `tech4@phonemart.com` / Password: `tech123`

**Manager:**
- Email: `manager@phonemart.com` / Password: `manager123`

## After Running Schema

1. **Redeploy your Vercel app** (or wait for auto-deploy)
2. **Visit your app**
3. **Login with default credentials**
4. **Add your staff** via Admin Settings → Staff tab
5. **All staff will now persist** - they won't disappear on refresh!

## Important Notes

- ✅ **Default users are created automatically** on first app load if database is empty
- ✅ **All staff added via Admin Settings** are now saved to database
- ✅ **Credentials persist** across page refreshes and devices
- ✅ **All shops** are also saved to database

## Troubleshooting

If login still doesn't work:
1. Check browser console (F12) for errors
2. Verify tables exist (run verification query above)
3. Clear browser cache and try again
4. Check Supabase project is active
