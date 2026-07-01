# Continuum Deployment Guide

## Quick Deploy (Vercel + Railway) — 10 minutes

### Prerequisites
- GitHub account (free)
- Vercel account (free, linked to GitHub)
- Railway account (free)
- GROQ API key (get at https://console.groq.com)

---

## Step 1: Push to GitHub

```bash
cd d:\downloads\cognee\continuum
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/continuum.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.**

---

## Step 2: Deploy Frontend on Vercel

1. Go to **https://vercel.com/import**
2. Select "Import Git Repository"
3. Paste your GitHub repo URL: `https://github.com/YOUR_GITHUB_USERNAME/continuum`
4. Click "Continue"
5. **Framework Preset:** select "Vite"
6. **Build Command:** `cd frontend && npm install && npm run build`
7. **Output Directory:** `frontend/dist`
8. **Environment Variables:** Add this key:
   - `VITE_API_URL` = `https://continuum-api.railway.app` (you'll update this after deploying the backend)
9. Click "Deploy"

✅ Your frontend is now live at: `https://continuum-YOUR_PROJECT_NAME.vercel.app`

---

## Step 3: Deploy Backend on Railway

1. Go to **https://railway.app** and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `continuum` repository
4. Railway auto-detects Python. Configure:
   - **Start Command:** `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT` (or uses Procfile)
   - **Working Directory:** `backend` (optional, if not auto-detected)
5. Add **Environment Variables** in the Railway dashboard:
   - `GROQ_API_KEY` = your actual Groq API key
   - `USE_COGNEE` = `false` (for now, optional)
   - `HOST` = `0.0.0.0`
   - `PORT` = `$PORT` (Railway sets this automatically)
6. Click "Deploy"

✅ Backend is live at: `https://continuum-api.railway.app` (Railway assigns a domain automatically)

---

## Step 4: Connect Frontend to Backend

1. Go back to your **Vercel project settings**
2. Navigate to **Environment Variables**
3. Update `VITE_API_URL` = `https://continuum-api.railway.app`
4. Trigger a redeploy: Click "Deployments" → select latest → "Redeploy"

---

## Step 5: Update CORS in Backend (if needed)

If you see CORS errors in the browser console:

1. Go to your Railway project
2. Edit `ALLOWED_ORIGINS` environment variable:
   ```
   http://localhost:5173,http://localhost:8000,https://continuum-YOUR_PROJECT_NAME.vercel.app
   ```
3. Redeploy the backend

---

## What's Deployed?

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend (React + Vite) | Vercel | `https://continuum-*.vercel.app` |
| Backend (FastAPI) | Railway | `https://continuum-api.railway.app` |
| Database | Local (Cognee) | N/A |
| LLM | Groq | (Remote, via API key) |

---

## Testing Your Deployment

1. Open your Vercel frontend URL
2. Click **"Launch Studio"**
3. Click **"▶ Play demo"** to test the full pipeline
4. You should see:
   - Live transcript with speaker names
   - Real-time contradiction detection ($40k → $55k conflict)
   - Live 3D knowledge graph updates
   - Stats updating in real-time

---

## Common Issues

### "Cannot connect to backend"
- Check Railway backend is running: visit `https://continuum-api.railway.app/healthz`
- Verify `VITE_API_URL` is set correctly in Vercel
- Check CORS: add your Vercel domain to Railway environment variables

### "GROQ API key not found"
- Make sure `GROQ_API_KEY` is set in Railway environment variables
- Verify the key is valid at https://console.groq.com

### "Cognee errors"
- Set `USE_COGNEE=false` in Railway env vars (app runs in heuristic mode)
- Or install Cognee: `pip install cognee` in Railway

---

## Monitoring & Logs

**Vercel Logs:**
- Dashboard → Deployments → View logs

**Railway Logs:**
- Dashboard → Logs tab (real-time streaming)

---

## Next Steps (Optional)

### Add a Custom Domain
- **Vercel:** Domains → Add → Connect your domain
- **Railway:** Connect domain in project settings

### Enable Analytics
- Vercel: Automatic (see in Analytics tab)
- Railway: View in "Monitoring" tab

### CI/CD Pipeline
- Both platforms auto-deploy on git push to `main`
- No additional setup needed!

---

## Rollback

To rollback to a previous version:

**Vercel:** Deployments → click any deployment → "Promote to Production"
**Railway:** Deployments → select version → "Redeploy"

---

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Railway Docs:** https://docs.railway.app
- **Groq Docs:** https://console.groq.com/docs

---

**🚀 You're live!** Share your Vercel URL with the judges.
