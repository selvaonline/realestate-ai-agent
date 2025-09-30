# Deployment Guide - RealEstate AI Agent

## Overview
This guide covers deploying both the backend (orchestrator) and frontend (deal-agent-ui) to cloud platforms.

---

## Environment Configuration

### ✅ Dual Environment Setup (Completed)

Your app now supports both local and production environments:

**Local Development:**
- Frontend: http://localhost:4200
- Backend: http://localhost:3001

**Production (Cloud):**
- Frontend: https://deal-agent-ui.onrender.com
- Backend: https://realestate-ai-agent.onrender.com

---

## Backend Deployment (Orchestrator)

### Option 1: Render.com (Recommended)

#### Step 1: Prepare for Deployment

**Create `render.yaml` in the orchestrator folder:**
```yaml
services:
  - type: web
    name: realestate-ai-agent
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_VERSION
        value: 20.19.5
      - key: OPENAI_API_KEY
        sync: false
      - key: SERPER_API_KEY
        sync: false
      - key: OPENAI_MODEL
        value: gpt-4o-mini
      - key: PORT
        value: 3001
```

#### Step 2: Deploy to Render

1. **Push to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Create Render Account**:
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

3. **Create New Web Service**:
   - Dashboard → New → Web Service
   - Connect your GitHub repository
   - Root directory: `orchestrator`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **Set Environment Variables**:
   - Add `OPENAI_API_KEY`
   - Add `SERPER_API_KEY`
   - Add `OPENAI_MODEL=gpt-4o-mini`
   - Add `PORT=3001`

5. **Deploy**:
   - Click "Create Web Service"
   - Wait 5-10 minutes for build
   - Get your URL: `https://realestate-ai-agent.onrender.com`

#### Step 3: Update Frontend Environment

Edit `deal-agent-ui/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://realestate-ai-agent.onrender.com' // Your Render URL
};
```

---

### Option 2: Heroku

```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku

# Login
heroku login

# Create app
cd orchestrator
heroku create realestate-ai-agent

# Set environment variables
heroku config:set OPENAI_API_KEY=sk-...
heroku config:set SERPER_API_KEY=...
heroku config:set OPENAI_MODEL=gpt-4o-mini

# Deploy
git push heroku main

# Open app
heroku open
```

---

### Option 3: AWS/GCP/Azure

See [Backend Cloud Deployment](#backend-cloud-deployment-detailed) section below.

---

## Frontend Deployment (deal-agent-ui)

### Option 1: Render.com (Static Site)

#### Step 1: Build for Production
```bash
cd deal-agent-ui
npm run build
```

#### Step 2: Create Render Static Site

1. **Render Dashboard** → New → Static Site
2. **Connect Repository**: Your GitHub repo
3. **Settings**:
   - Root Directory: `deal-agent-ui`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist/deal-agent-ui/browser`
4. **Environment**: Node
5. **Auto-Deploy**: Yes (on git push)

#### Step 3: Deploy
- Click "Create Static Site"
- Wait for build (3-5 minutes)
- Your URL: `https://deal-agent-ui.onrender.com`

---

### Option 2: Vercel (Fastest)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd deal-agent-ui
vercel

# Follow prompts:
# - Project name: deal-agent-ui
# - Build command: npm run build
# - Output directory: dist/deal-agent-ui/browser

# Production deployment
vercel --prod
```

**Configure Environment:**
- Vercel Dashboard → Settings → Environment Variables
- Add build-time variable: `API_URL=https://realestate-ai-agent.onrender.com`

---

### Option 3: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd deal-agent-ui
netlify deploy

# Production deployment
netlify deploy --prod
```

**Build Settings:**
- Build command: `npm run build`
- Publish directory: `dist/deal-agent-ui/browser`

---

## Environment Variables Summary

### Backend (.env)
```bash
OPENAI_API_KEY=sk-...                    # Required
SERPER_API_KEY=...                       # Required
OPENAI_MODEL=gpt-4o-mini                # Optional (default)
PORT=3001                                # Optional (default)
BROWSER_HEADED=false                     # Optional
BROWSER_DEVTOOLS=false                   # Optional
```

### Frontend (Angular environments)

**src/environments/environment.ts** (Local):
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3001'
};
```

**src/environments/environment.prod.ts** (Production):
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://realestate-ai-agent.onrender.com'
};
```

---

## Testing Deployment

### Backend Health Check
```bash
curl https://realestate-ai-agent.onrender.com/healthz
# Expected: {"ok":true}
```

### Backend Test Query
```bash
curl -X POST https://realestate-ai-agent.onrender.com/run_sync \
  -H "Content-Type: application/json" \
  -d '{"query": "CVS pharmacy Dallas"}'
```

### Frontend
1. Visit: https://deal-agent-ui.onrender.com
2. Try query: "7-eleven"
3. Check browser console for errors
4. Verify it connects to backend (no CORS errors)

---

## CORS Configuration

Your backend already has CORS enabled (index.ts):
```typescript
app.use(cors()); // Allows all origins
```

**For Production**, restrict to your frontend domain:
```typescript
app.use(cors({
  origin: [
    'http://localhost:4200',                    // Local dev
    'https://deal-agent-ui.onrender.com',       // Production frontend
    'https://deal-agent-ui.vercel.app'         // Alternative frontend
  ]
}));
```

---

## Build Commands Reference

### Local Development
```bash
# Backend
cd orchestrator
npm run dev          # Development with hot reload

# Frontend
cd deal-agent-ui
npm start            # Development server on :4200
```

### Production Build
```bash
# Backend
cd orchestrator
npm run build        # Compiles TypeScript to dist/
npm start            # Runs compiled code

# Frontend
cd deal-agent-ui
npm run build        # Creates optimized build in dist/
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All API keys in environment variables (not hardcoded)
- [ ] Frontend points to production backend URL
- [ ] CORS configured properly
- [ ] Test locally with production build
- [ ] Git repository is up-to-date

### Backend Deployment
- [ ] Environment variables set on platform
- [ ] Build completes successfully
- [ ] `/healthz` endpoint responds
- [ ] Test `/run_sync` with sample query
- [ ] Logs show no errors

### Frontend Deployment
- [ ] Production build succeeds
- [ ] Environment correctly set (production)
- [ ] Can access the site
- [ ] UI connects to backend (check console)
- [ ] Sample search works end-to-end

### Post-Deployment
- [ ] Test from different devices/browsers
- [ ] Monitor error logs
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Document deployment URLs

---

## Troubleshooting

### Issue: "CORS Error"
**Solution**: Check backend CORS configuration allows frontend domain

### Issue: "Failed to fetch"
**Solution**: 
1. Verify backend is running: `curl https://your-backend.com/healthz`
2. Check frontend environment.prod.ts has correct backend URL
3. Ensure backend is using HTTPS (not HTTP)

### Issue: "Module not found" during build
**Solution**: Run `npm install` in both folders before building

### Issue: Backend timeout on Render free tier
**Solution**: 
- Free tier spins down after 15 min inactivity
- First request after sleep takes 30-60 seconds
- Upgrade to paid tier ($7/month) for always-on

### Issue: "Environment file not found"
**Solution**: Ensure both environment files exist:
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

---

## Backend Cloud Deployment (Detailed)

### AWS Elastic Beanstalk

1. **Install EB CLI**:
   ```bash
   pip install awsebcli
   ```

2. **Initialize**:
   ```bash
   cd orchestrator
   eb init -p node.js realestate-agent
   ```

3. **Create environment**:
   ```bash
   eb create realestate-agent-prod
   ```

4. **Set environment variables**:
   ```bash
   eb setenv OPENAI_API_KEY=sk-... SERPER_API_KEY=...
   ```

5. **Deploy**:
   ```bash
   eb deploy
   ```

### Google Cloud Run

1. **Create Dockerfile** (orchestrator/Dockerfile):
   ```dockerfile
   FROM node:20
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 3001
   CMD ["npm", "start"]
   ```

2. **Deploy**:
   ```bash
   gcloud run deploy realestate-agent \
     --source . \
     --region us-central1 \
     --allow-unauthenticated
   ```

---

## Monitoring & Maintenance

### Uptime Monitoring
- Set up [UptimeRobot](https://uptimerobot.com) (free)
- Monitor: `https://realestate-ai-agent.onrender.com/healthz`
- Alert interval: 5 minutes

### Error Tracking
- Use Render logs: Dashboard → Logs tab
- Or integrate [Sentry](https://sentry.io)

### Cost Optimization
**Render Free Tier:**
- 750 hours/month free
- Spins down after 15 min inactivity
- Upgrade to $7/month for always-on

**Alternative: Railway**
- $5/month flat rate
- No sleep
- Better performance

---

## Updating Production

### Backend Updates
```bash
cd orchestrator
git pull origin main
# Render auto-deploys on git push
# Or manually: Render Dashboard → Manual Deploy
```

### Frontend Updates
```bash
cd deal-agent-ui
git pull origin main
npm run build
# Deploy to your platform
```

### Zero-Downtime Updates
1. Test changes locally
2. Deploy to backend first
3. Test backend independently
4. Deploy frontend
5. Monitor logs for errors

---

## Security Best Practices

1. **Never commit .env files** (already in .gitignore)
2. **Rotate API keys regularly** (every 90 days)
3. **Use HTTPS only** (Render/Vercel provide free SSL)
4. **Enable rate limiting** (future enhancement)
5. **Monitor API usage** to prevent abuse
6. **Set up alerts** for unusual activity

---

## Performance Optimization

### Backend
- Enable compression: `app.use(compression())`
- Cache search results (Redis)
- Use CDN for static assets

### Frontend
- Already optimized build (Angular production mode)
- Enable service worker for caching
- Lazy load components

---

## Support URLs

After deployment, your app will be accessible at:

**Development:**
- Frontend: http://localhost:4200
- Backend: http://localhost:3001

**Production:**
- Frontend: https://deal-agent-ui.onrender.com
- Backend: https://realestate-ai-agent.onrender.com

Update these URLs in your documentation and sales deck!

---

## Quick Deploy Commands

```bash
# 1. Update backend URL in frontend
# Edit: deal-agent-ui/src/environments/environment.prod.ts

# 2. Build frontend
cd deal-agent-ui
npm run build

# 3. Deploy frontend (example: Vercel)
vercel --prod

# 4. Deploy backend (Render auto-deploys on git push)
git add .
git commit -m "Update deployment"
git push origin main

# Done! Test at your production URLs
```

---

**Need Help?** Check the platform-specific docs:
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Netlify Docs](https://docs.netlify.com)

Good luck with your deployment! 🚀
