# 🚀 Quick Deploy to Vercel (5 Minutes)

## Step-by-Step Guide

### Step 1: Push to GitHub (if not already done)

```bash
cd PHONEMART_FRONTEND

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/PHONEMART_FRONTEND.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

1. **Go to:** [vercel.com](https://vercel.com)
2. **Click:** "Sign Up" → Choose "Continue with GitHub"
3. **Click:** "Add New..." → "Project"
4. **Import:** Your `PHONEMART_FRONTEND` repository
5. **Configure:**
   - Framework Preset: **Vite** (auto-detected)
   - Root Directory: `./` (or `PHONEMART_FRONTEND` if repo is in parent folder)
   - Build Command: `npm run build` (auto-filled)
   - Output Directory: `dist` (auto-filled)
   - Install Command: `npm install` (auto-filled)
6. **Click:** "Deploy"
7. **Wait:** ~2 minutes
8. **Done!** Your app is live! 🎉

### Step 3: Access Your App

Your app will be available at:
- **URL:** `https://your-project-name.vercel.app`
- **Custom Domain:** Add in Vercel dashboard (Settings → Domains)

---

## ✅ That's It!

Every time you push to GitHub, Vercel will automatically:
- Build your app
- Deploy the new version
- Give you a preview URL for testing

---

## 🔧 Optional: Environment Variables

If you need environment variables:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add your variables (e.g., `VITE_API_URL`)
3. Redeploy

---

## 📱 Test Your Deployment

After deployment, test:
- ✅ Homepage loads
- ✅ Navigation works
- ✅ Sales page works
- ✅ Dashboard displays
- ✅ Receipts generate
- ✅ Reports work

---

## 🆘 Need Help?

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Vite Deployment:** [vitejs.dev/guide/static-deploy](https://vitejs.dev/guide/static-deploy)

---

## 🎯 Alternative: Netlify (Just as Easy)

1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. "Add new site" → "Import an existing project"
4. Select your repo
5. Build: `npm run build`, Publish: `dist`
6. Deploy!

**Netlify URL:** `https://random-name.netlify.app`
