# PHONEMART POS - Deployment Guide

## Step 1: Create .env file (REQUIRED)

Create a file named `.env` in the root directory with:

```
VITE_SUPABASE_URL=https://pufedomcrqrmngmcifux.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmVkb21jcnFybW5nbWNpZnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4Nzk4ODcsImV4cCI6MjA4NDQ1NTg4N30.Mi6oizD0LyC7p3RmMS-85J9MXiLfIrq6Q-k2tFt5yOw
```

## Step 2: Run Supabase Schema

1. Go to https://supabase.com/dashboard
2. Open your project: `pufedomcrqrmngmcifux`
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Open `supabase/schema.sql` from this project
6. Copy ALL the SQL code (including the new tables for repairs, sales, payments)
7. Paste into Supabase SQL Editor
8. Click **Run** (or press Ctrl+Enter)

This creates all the tables:
- `suppliers` - Supplier information
- `inventory_items` - Inventory stock
- `purchases` & `purchase_items` - Purchase records
- `stock_allocations` & `stock_allocation_lines` - Stock allocation requests
- `returns` - Returns/warranty claims
- `repairs` & `repair_parts` & `additional_repair_items` - Repair records
- `sales` & `sale_items` - Sales records
- `payments` - Payment tracking

## Step 3: Deploy to Vercel (NEW Project)

### Option A: Deploy via Vercel Dashboard

1. Go to https://vercel.com and sign in
2. Click **Add New...** → **Project**
3. **Import Git Repository** (connect GitHub/GitLab if needed)
   - OR click **Browse** and upload the project folder
4. **Project Settings:**
   - **Framework Preset:** Vite
   - **Root Directory:** (leave default)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. **Environment Variables** (IMPORTANT!):
   - Click **Environment Variables**
   - Add:
     - **Key:** `VITE_SUPABASE_URL`
     - **Value:** `https://pufedomcrqrmngmcifux.supabase.co`
   - Add:
     - **Key:** `VITE_SUPABASE_ANON_KEY`
     - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmVkb21jcnFybW5nbWNpZnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4Nzk4ODcsImV4cCI6MjA4NDQ1NTg4N30.Mi6oizD0LyC7p3RmMS-85J9MXiLfIrq6Q-k2tFt5yOw`
   - Select **Production**, **Preview**, and **Development** for both
6. Click **Deploy**

### Option B: Deploy via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
# Follow prompts, add env vars when asked
```

## Step 4: Verify Deployment

1. After deployment, Vercel gives you a URL like: `https://your-project.vercel.app`
2. Open the URL
3. Login with:
   - **Email:** `admin@phonemart.com`
   - **Password:** `admin123`
4. Test:
   - Add a supplier
   - Add inventory item
   - Make a purchase
   - Check if data persists (refresh page)

## Important Notes

- **Fresh Start:** The database starts EMPTY (no demo data). You'll add suppliers/stock from scratch.
- **Shared Data:** All staff see the same data (real POS, not per-browser).
- **Admin Only:** Cost prices are hidden from staff (only admin sees purchase costs).

## Troubleshooting

- **White Screen:** Check browser console for errors. Make sure env vars are set in Vercel.
- **"Supabase env vars missing" warning:** Add env vars in Vercel dashboard.
- **Tables not found:** Run the SQL schema in Supabase SQL Editor.
