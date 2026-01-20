# How to Redeploy on Vercel

## Option 1: Automatic Redeploy (If GitHub Connected)

If your Vercel project is connected to GitHub, it will **automatically redeploy** when you push changes.

**Current Status:** All changes are already pushed to GitHub ✅

**To trigger a redeploy:**
1. Wait 1-2 minutes - Vercel should auto-detect the push
2. Or go to Vercel Dashboard → Your Project → Deployments
3. You should see a new deployment in progress

## Option 2: Manual Redeploy via Vercel Dashboard

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Sign in

2. **Select Your Project:**
   - Click on your project name

3. **Redeploy:**
   - Go to **"Deployments"** tab (top menu)
   - Find the latest deployment
   - Click the **⋯** (three dots) menu on the right
   - Click **"Redeploy"**
   - Confirm by clicking **"Redeploy"** again

4. **Wait for Build:**
   - Build typically takes 2-3 minutes
   - You'll see progress: "Building..." → "Ready"

## Option 3: Force Redeploy with Empty Commit

If you want to force a redeploy right now:

```bash
git commit --allow-empty -m "Trigger redeploy"
git push
```

This creates an empty commit that triggers Vercel to redeploy.

## Verify Deployment

After redeployment completes:

1. **Check Deployment Status:**
   - Go to Vercel Dashboard → Deployments
   - Latest deployment should show ✅ "Ready"

2. **Test Your App:**
   - Visit your deployment URL
   - Test login: `admin@phonemart.com` / `admin123`
   - Verify staff can login (after running the SQL schema update)

## Important: Update Supabase Schema First!

⚠️ **Before testing, make sure you've run the SQL schema update for users/shops tables!**

See `UPDATE_SCHEMA_FOR_USERS.md` for instructions.

## Current Changes in This Deployment

- ✅ Supplier persistence fixed
- ✅ Staff login persistence (requires schema update)
- ✅ All Supabase migrations
- ✅ Improved error handling
