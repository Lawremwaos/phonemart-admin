# ⚠️ URGENT: Add Environment Variables to Vercel

## The Error You're Seeing
```
Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
Uncaught Error: supabaseUrl is required.
```

## ✅ Quick Fix (5 minutes)

### Step 1: Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. Sign in
3. Click on your project (the one that's deployed)

### Step 2: Add Environment Variables
1. Click **"Settings"** (top menu)
2. Click **"Environment Variables"** (left sidebar)
3. Click **"Add New"** button

### Step 3: Add First Variable
**Variable 1:**
- **Key:** `VITE_SUPABASE_URL`
- **Value:** `https://pufedomcrqrmngmcifux.supabase.co`
- **Environments:** 
  - ✅ Production
  - ✅ Preview  
  - ✅ Development
- Click **"Save"**

### Step 4: Add Second Variable
Click **"Add New"** again

**Variable 2:**
- **Key:** `VITE_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmVkb21jcnFybW5nbWNpZnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4Nzk4ODcsImV4cCI6MjA4NDQ1NTg4N30.Mi6oizD0LyC7p3RmMS-85J9MXiLfIrq6Q-k2tFt5yOw`
- **Environments:**
  - ✅ Production
  - ✅ Preview
  - ✅ Development
- Click **"Save"**

### Step 5: Redeploy (CRITICAL!)
**You MUST redeploy after adding environment variables!**

1. Go to **"Deployments"** tab (top menu)
2. Find the latest deployment
3. Click the **⋯** (three dots) menu
4. Click **"Redeploy"**
5. Wait 2-3 minutes for deployment to complete

### Step 6: Test
1. Visit your site URL
2. Open browser console (F12)
3. Should **NOT** see the Supabase error anymore
4. Should see login page

## ✅ Verification Checklist

After redeploying, verify:
- [ ] No errors in browser console
- [ ] Login page loads
- [ ] Can login with `admin@phonemart.com` / `admin123`
- [ ] Can add suppliers (tests Supabase connection)

## ⚠️ Important Notes

1. **Environment variables are NOT automatically applied to existing deployments**
   - You MUST redeploy after adding them

2. **Make sure all 3 environments are checked** (Production, Preview, Development)
   - This ensures variables work in all deployment types

3. **The values are case-sensitive**
   - `VITE_SUPABASE_URL` (not `vite_supabase_url`)
   - `VITE_SUPABASE_ANON_KEY` (not `vite_supabase_anon_key`)

## 🆘 Still Not Working?

1. **Double-check the values:**
   - Copy-paste the exact values from this guide
   - No extra spaces before/after

2. **Verify redeployment:**
   - Check Vercel deployment logs
   - Should see "Building..." then "Ready"

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or open in incognito/private window

4. **Check Vercel build logs:**
   - Go to Deployments → Click on latest deployment
   - Check "Build Logs" for any errors
