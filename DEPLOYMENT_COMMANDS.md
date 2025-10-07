# Quick Deployment Commands

## 🚀 Deploy to Render (Same Domain Setup)

### 1. Install Dependencies
```bash
cd deal-agent-ui
npm install
```

### 2. Test Locally
```bash
# Terminal 1: Backend
cd orchestrator
npm run dev

# Terminal 2: Frontend with proxy
cd deal-agent-ui
npm run build:prod
npm run start:prod

# Visit: http://localhost:8080
```

### 3. Push to GitHub
```bash
git add .
git commit -m "Add proxy configuration for same-domain deployment"
git push origin main
```

### 4. Deploy Backend on Render

**Service Settings:**
- Name: `realestate-api`
- Root Directory: `orchestrator`
- Environment: Docker
- Build: Auto (uses Dockerfile)
- Start: Auto (uses Dockerfile CMD)

**Environment Variables:**
```bash
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=<your-key>
SERPER_API_KEY=<your-key>
OPENAI_MODEL=gpt-4o-mini
CORS_ORIGINS=https://my-docs.ai,http://localhost:4200
BROWSER_HEADED=false
BROWSER_ENGINE=chromium
COMET_ENABLED=true
SKIP_EXTRACTION=true
```

**Test:**
```bash
curl https://realestate-api.onrender.com/healthz
```

### 5. Deploy Frontend on Render

**Service Settings:**
- Name: `realestate-frontend`
- Root Directory: `deal-agent-ui`
- Environment: Node
- Build: `npm install && npm run build:prod`
- Start: `npm run start:prod`

**Environment Variables:**
```bash
NODE_ENV=production
PORT=8080
API_URL=https://realestate-api.onrender.com
```

**Test:**
```bash
curl https://realestate-frontend.onrender.com
```

### 6. Add Custom Domain

1. Render Dashboard → `realestate-frontend` → Settings → Custom Domains
2. Add: `my-docs.ai`
3. Update DNS at your registrar:
   ```
   Type: CNAME
   Name: @
   Value: realestate-frontend.onrender.com
   ```

### 7. Verify Deployment

```bash
# Check backend
curl https://realestate-api.onrender.com/healthz

# Check frontend (proxies to backend)
curl https://my-docs.ai/healthz

# Visit in browser
open https://my-docs.ai
```

## 📝 Environment Files Summary

### Backend `.env` (orchestrator/)
```bash
OPENAI_API_KEY=sk-...
SERPER_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
CORS_ORIGINS=https://my-docs.ai,http://localhost:4200
PORT=3001
BROWSER_HEADED=false
COMET_ENABLED=true
SKIP_EXTRACTION=true
```

### Frontend `environment.prod.ts`
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://my-docs.ai' // Same domain, proxied
};
```

## 🔄 Update Deployment

```bash
# Make changes
git add .
git commit -m "Your changes"
git push origin main

# Render auto-deploys both services
```

## 🐛 Quick Troubleshooting

### CORS Error
```bash
# Check backend CORS_ORIGINS includes your domain
# Restart backend service after changing env vars
```

### Proxy Error
```bash
# Verify API_URL in frontend env vars
# Check backend is running: curl https://realestate-api.onrender.com/healthz
```

### 502 Bad Gateway
```bash
# Backend is sleeping (free tier)
# Wait 30-60 seconds and retry
```

### SSE Connection Failed
```bash
# Check /ui/events endpoint
curl -N https://my-docs.ai/ui/events
# Should see: event: connected
```

## 📊 Monitor Services

```bash
# Backend logs
# Render Dashboard → realestate-api → Logs

# Frontend logs
# Render Dashboard → realestate-frontend → Logs

# Check proxy activity
# Look for [Proxy] messages in frontend logs
```

## 🎯 Key URLs

- **Production**: https://my-docs.ai
- **Backend API**: https://realestate-api.onrender.com
- **Frontend**: https://realestate-frontend.onrender.com
- **Local Dev**: http://localhost:4200 (frontend) + http://localhost:3001 (backend)
- **Local Proxy**: http://localhost:8080 (frontend with proxy)

---

**Need detailed instructions?** See [PROXY_DEPLOYMENT_GUIDE.md](./PROXY_DEPLOYMENT_GUIDE.md)
