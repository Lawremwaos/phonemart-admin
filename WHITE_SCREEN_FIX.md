# Fix White Screen Issue

## Quick Diagnosis Steps

### Step 1: Check Browser Console
1. Open your deployed site
2. Press **F12** (or right-click → Inspect)
3. Go to **Console** tab
4. Look for **RED errors** - these tell you what's wrong

### Step 2: Common Causes & Fixes

#### ❌ **Error: "Supabase env vars missing"**
**Fix:** Environment variables not set in Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `VITE_SUPABASE_URL` = `https://pufedomcrqrmngmcifux.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmVkb21jcnFybW5nbWNpZnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4Nzk4ODcsImV4cCI6MjA4NDQ1NTg4N30.Mi6oizD0LyC7p3RmMS-85J9MXiLfIrq6Q-k2tFt5yOw`
3. **Redeploy** after adding variables

#### ❌ **Error: "Cannot read property of undefined"**
**Fix:** Context provider issue
- Check if all context providers are properly initialized
- Verify ShopContext has default users

#### ❌ **Error: "Failed to fetch" or Network errors**
**Fix:** Supabase connection issue
- Verify Supabase project is active
- Check if tables exist (run verification query)
- Check Supabase project URL is correct

#### ❌ **No errors in console but still white screen**
**Fix:** Check Network tab
1. Open DevTools → **Network** tab
2. Refresh page
3. Look for failed requests (red)
4. Check if `index.html` loads (should be 200 status)

### Step 3: Verify Environment Variables in Vercel

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Verify both variables exist:
   - ✅ `VITE_SUPABASE_URL`
   - ✅ `VITE_SUPABASE_ANON_KEY`
5. Make sure they're enabled for **Production**, **Preview**, and **Development**

### Step 4: Force Redeploy

After adding/changing environment variables:
1. Go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**
4. Wait for build to complete

### Step 5: Test Locally First

Before deploying, test locally:
```bash
# Make sure .env file exists with:
VITE_SUPABASE_URL=https://pufedomcrqrmngmcifux.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Then run:
npm run dev
```

If it works locally but not on Vercel = Environment variable issue

## Most Common Fix

**90% of white screen issues are missing environment variables!**

1. ✅ Add env vars in Vercel
2. ✅ Redeploy
3. ✅ Check browser console for errors
4. ✅ Verify Supabase tables exist

## Still Not Working?

Share the **exact error message** from browser console (F12 → Console tab)
