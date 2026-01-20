# 🚨 URGENT: Add Environment Variables to Vercel

## The Problem
Your console shows:
- ❌ `VITE_SUPABASE_URL: Missing`
- ❌ `VITE_SUPABASE_ANON_KEY: Missing`
- ❌ `Available users: Array(0)` - No users loaded!

**This is why login isn't working!** The app can't connect to Supabase to load users.

## ✅ Fix: Add Environment Variables (5 minutes)

### Step 1: Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. **Sign in**
3. **Click on your project** (the deployed one)

### Step 2: Go to Settings
1. Click **"Settings"** (top menu bar)
2. Click **"Environment Variables"** (left sidebar)

### Step 3: Add First Variable
Click **"Add New"** button

**Variable 1:**
- **Key:** `VITE_SUPABASE_URL`
- **Value:** `https://pufedomcrqrmngmcifux.supabase.co`
- **Environments:** 
  - ✅ **Production**
  - ✅ **Preview**
  - ✅ **Development**
- Click **"Save"**

### Step 4: Add Second Variable
Click **"Add New"** again

**Variable 2:**
- **Key:** `VITE_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmVkb21jcnFybW5nbWNpZnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4Nzk4ODcsImV4cCI6MjA4NDQ1NTg4N30.Mi6oizD0LyC7p3RmMS-85J9MXiLfIrq6Q-k2tFt5yOw`
- **Environments:**
  - ✅ **Production**
  - ✅ **Preview**
  - ✅ **Development**
- Click **"Save"**

### Step 5: REDEPLOY (CRITICAL!)
**Environment variables are NOT applied to existing deployments!**

1. Go to **"Deployments"** tab (top menu)
2. Find the **latest deployment**
3. Click the **⋯** (three dots) menu on the right
4. Click **"Redeploy"**
5. Click **"Redeploy"** again to confirm
6. **Wait 2-3 minutes** for deployment to complete

### Step 6: Test
1. **Visit your app** (after redeploy completes)
2. **Open browser console** (F12)
3. **Should see:**
   - ✅ "Loaded users from Supabase: X [emails]"
   - ✅ No more "Missing" errors
4. **Try login:**
   - Email: `admin@phonemart.com`
   - Password: `admin123`

## ✅ Verification Checklist

After redeploying, check console (F12):
- [ ] No "Supabase env vars missing" error
- [ ] "Loaded users from Supabase: X" (X should be > 0)
- [ ] "Available users: [...]" shows admin@phonemart.com
- [ ] Login works!

## ⚠️ Important Notes

1. **You MUST redeploy** after adding environment variables
2. **Check all 3 environments** (Production, Preview, Development)
3. **Values are case-sensitive:**
   - `VITE_SUPABASE_URL` (not `vite_supabase_url`)
   - `VITE_SUPABASE_ANON_KEY` (not `vite_supabase_anon_key`)

## Still Not Working?

1. **Double-check values** - copy-paste exactly from this guide
2. **Verify redeployment** - check Vercel deployment logs
3. **Clear browser cache** - Ctrl+Shift+R (hard refresh)
4. **Check deployment status** - should show "Ready" ✅
