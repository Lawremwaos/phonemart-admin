# Deployment Guide - Free Hosting Options

## 🚀 Quick Deploy Options

### 1. **Vercel** (Recommended - Easiest)

**Why Vercel:**
- ✅ Zero configuration needed
- ✅ Automatic deployments from GitHub
- ✅ Free SSL/HTTPS
- ✅ Custom domains
- ✅ Preview deployments for PRs
- ✅ Global CDN

**Steps to Deploy:**

1. **Push your code to GitHub:**
   ```bash
   cd PHONEMART_FRONTEND
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/PHONEMART_FRONTEND.git
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite settings
   - Click "Deploy"
   - Done! Your app will be live in ~2 minutes

**Configuration:**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**Your app will be live at:** `https://your-project-name.vercel.app`

---

### 2. **Netlify** (Also Great)

**Why Netlify:**
- ✅ Easy drag-and-drop or Git integration
- ✅ Free SSL/HTTPS
- ✅ Form handling
- ✅ Serverless functions (if needed later)

**Steps to Deploy:**

1. **Push to GitHub** (same as above)

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with GitHub
   - Click "Add new site" → "Import an existing project"
   - Select your GitHub repository
   - Configure:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Click "Deploy site"

**Your app will be live at:** `https://random-name.netlify.app`

---

### 3. **GitHub Pages** (Free but requires setup)

**Why GitHub Pages:**
- ✅ Free with GitHub account
- ✅ Custom domain support
- ✅ Good for open source projects

**Steps to Deploy:**

1. **Install gh-pages package:**
   ```bash
   cd PHONEMART_FRONTEND
   npm install --save-dev gh-pages
   ```

2. **Update package.json:**
   Add these scripts:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   },
   "homepage": "https://YOUR_USERNAME.github.io/PHONEMART_FRONTEND"
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

4. **Enable GitHub Pages:**
   - Go to your repo → Settings → Pages
   - Source: `gh-pages` branch
   - Save

**Your app will be live at:** `https://YOUR_USERNAME.github.io/PHONEMART_FRONTEND`

---

### 4. **Firebase Hosting** (Google)

**Why Firebase:**
- ✅ Free tier: 10GB storage, 360MB/day transfer
- ✅ Fast global CDN
- ✅ Easy custom domains

**Steps to Deploy:**

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login:**
   ```bash
   firebase login
   ```

3. **Initialize:**
   ```bash
   cd PHONEMART_FRONTEND
   firebase init hosting
   ```
   - Select: Use an existing project or create new
   - Public directory: `dist`
   - Single-page app: `Yes`
   - Overwrite index.html: `No`

4. **Build and Deploy:**
   ```bash
   npm run build
   firebase deploy
   ```

**Your app will be live at:** `https://your-project-id.web.app`

---

### 5. **Render** (Good alternative)

**Why Render:**
- ✅ Free tier available
- ✅ Auto-deploy from Git
- ✅ SSL included

**Steps:**
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. New → Static Site
4. Connect your repo
5. Build command: `npm run build`
6. Publish directory: `dist`
7. Deploy

---

## 📝 Important Notes Before Deploying

### Environment Variables
If you need environment variables, create a `.env` file:
```env
VITE_API_URL=https://your-api-url.com
```

### Build Configuration
Your `vite.config.ts` should handle routing. Make sure you have:

```typescript
export default defineConfig({
  plugins: [react()],
  base: '/', // or '/PHONEMART_FRONTEND/' for GitHub Pages
})
```

### Router Configuration
For GitHub Pages, update your router:
```typescript
<BrowserRouter basename="/PHONEMART_FRONTEND">
```

---

## 🎯 Recommendation

**For beginners:** Use **Vercel** - it's the easiest and requires zero configuration.

**For more control:** Use **Netlify** - similar to Vercel with more customization options.

**For GitHub integration:** Use **GitHub Pages** - if you want everything in one place.

---

## 🔗 Quick Links

- [Vercel](https://vercel.com)
- [Netlify](https://netlify.com)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Render](https://render.com)
- [GitHub Pages](https://pages.github.com)

---

## 💡 Pro Tips

1. **Custom Domain:** All platforms allow free custom domains
2. **Continuous Deployment:** Push to GitHub = Auto deploy
3. **Preview Deployments:** Test before going live
4. **Analytics:** Most platforms offer basic analytics for free

---

## 🆘 Troubleshooting

**Build fails?**
- Check Node version (should be 18+)
- Run `npm install` locally first
- Check build logs in hosting dashboard

**404 on refresh?**
- Configure redirect rules (all platforms support this)
- For Vite: Add `_redirects` file in `public/` folder

**Assets not loading?**
- Check base path in `vite.config.ts`
- Ensure all assets are in `public/` folder
