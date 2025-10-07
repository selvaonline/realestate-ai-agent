# Proxy Deployment Guide - Same Domain Setup

This guide explains how to deploy both frontend and backend on the same domain (`my-docs.ai`) using a proxy configuration.

## Architecture

```
my-docs.ai (Frontend + Proxy)
    ├── / → Angular App (Static Files)
    ├── /run → Proxied to Backend API
    ├── /events/* → Proxied to Backend API
    ├── /result/* → Proxied to Backend API
    ├── /ui/events → Proxied to Backend API (SSE)
    ├── /api/* → Proxied to Backend API
    └── /chat/* → Proxied to Backend API

realestate-api.onrender.com (Backend API)
    └── All API endpoints
```

## Prerequisites

1. GitHub account with your code pushed
2. Render.com account
3. Custom domain `my-docs.ai` configured

## Step-by-Step Deployment

### Step 1: Install Frontend Dependencies

```bash
cd deal-agent-ui
npm install
```

This will install the new dependencies:
- `express` - Web server
- `http-proxy-middleware` - API proxy

### Step 2: Deploy Backend to Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - **Service Name**: `realestate-api`
   - **Root Directory**: `orchestrator`
   - **Environment**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Region**: Oregon (or your preferred region)
   - **Plan**: Free

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3001
   OPENAI_API_KEY=<your-key>
   SERPER_API_KEY=<your-key>
   OPENAI_MODEL=gpt-4o-mini
   CORS_ORIGINS=https://my-docs.ai,http://localhost:4200
   BROWSER_HEADED=false
   BROWSER_DEVTOOLS=false
   BROWSER_ENGINE=chromium
   COMET_ENABLED=true
   SKIP_EXTRACTION=true
   MIN_BROWSE_SCORE=70
   ```

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Note the URL: `https://realestate-api.onrender.com`

5. **Test Backend**:
   ```bash
   curl https://realestate-api.onrender.com/healthz
   # Should return: {"ok":true}
   ```

### Step 3: Deploy Frontend with Proxy to Render

1. **Create Another Web Service**:
   - Click "New +" → "Web Service"
   - Connect same GitHub repository
   - **Service Name**: `realestate-frontend`
   - **Root Directory**: `deal-agent-ui`
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build:prod`
   - **Start Command**: `npm run start:prod`
   - **Region**: Oregon (same as backend)
   - **Plan**: Free

2. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=8080
   API_URL=https://realestate-api.onrender.com
   ```

3. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment (3-5 minutes)
   - Note the URL: `https://realestate-frontend.onrender.com`

4. **Test Frontend**:
   - Visit: `https://realestate-frontend.onrender.com`
   - Try a search query
   - Check browser console - should see proxy logs

### Step 4: Configure Custom Domain

1. **In Render Dashboard**:
   - Go to `realestate-frontend` service
   - Click "Settings" → "Custom Domains"
   - Click "Add Custom Domain"
   - Enter: `my-docs.ai`

2. **Update DNS Records**:
   - Go to your domain registrar (e.g., Cloudflare, GoDaddy)
   - Add/Update DNS records as shown by Render:
     ```
     Type: CNAME
     Name: @ (or my-docs)
     Value: realestate-frontend.onrender.com
     ```
   - Or if using A record:
     ```
     Type: A
     Name: @
     Value: <IP provided by Render>
     ```

3. **Wait for DNS Propagation** (5-60 minutes)

4. **Verify SSL Certificate**:
   - Render automatically provisions SSL via Let's Encrypt
   - Check: `https://my-docs.ai` should have valid SSL

### Step 5: Update Backend CORS

Make sure backend allows requests from your custom domain:

In Render backend (`realestate-api`) environment variables:
```
CORS_ORIGINS=https://my-docs.ai,http://localhost:4200
```

### Step 6: Test End-to-End

1. **Visit**: `https://my-docs.ai`
2. **Open Browser Console** (F12)
3. **Try a search**: "CVS pharmacy Dallas"
4. **Verify**:
   - ✅ No CORS errors
   - ✅ API requests go to `https://my-docs.ai/run` (not showing backend URL)
   - ✅ SSE connection works: `https://my-docs.ai/ui/events`
   - ✅ Search results appear

## How It Works

### Proxy Server (`deal-agent-ui/server.js`)

The Express server:
1. **Serves static Angular files** from `dist/deal-agent-ui/browser`
2. **Proxies API requests** to the backend:
   - `/run` → `https://realestate-api.onrender.com/run`
   - `/events/*` → `https://realestate-api.onrender.com/events/*`
   - `/ui/events` → `https://realestate-api.onrender.com/ui/events`
3. **Handles SSE** (Server-Sent Events) for real-time updates
4. **Supports client-side routing** (Angular routes)

### Environment Configuration

**Development** (`environment.ts`):
```typescript
apiUrl: 'http://localhost:3001'  // Direct to local backend
```

**Production** (`environment.prod.ts`):
```typescript
apiUrl: 'https://my-docs.ai'  // Same domain, proxied
```

## Local Testing with Proxy

To test the proxy setup locally:

```bash
# Terminal 1: Start backend
cd orchestrator
npm run dev

# Terminal 2: Build and serve frontend with proxy
cd deal-agent-ui
npm run build:prod
npm run start:prod

# Visit: http://localhost:8080
```

## Troubleshooting

### Issue: "Proxy Error" in console

**Solution**: Check that `API_URL` environment variable is set correctly in Render:
```bash
API_URL=https://realestate-api.onrender.com
```

### Issue: SSE connection fails

**Solution**: 
1. Verify `/ui/events` is proxied correctly
2. Check backend CORS includes your domain
3. Ensure WebSocket support is enabled in proxy (already done in `server.js`)

### Issue: 502 Bad Gateway

**Solution**:
1. Backend might be sleeping (Render free tier)
2. Wait 30-60 seconds for backend to wake up
3. Check backend logs in Render dashboard

### Issue: Custom domain not working

**Solution**:
1. Verify DNS records are correct
2. Wait for DNS propagation (use `dig my-docs.ai` to check)
3. Clear browser cache
4. Try incognito mode

### Issue: CORS errors still appearing

**Solution**:
1. Check backend `CORS_ORIGINS` includes `https://my-docs.ai`
2. Restart backend service after changing env vars
3. Clear browser cache

## Monitoring

### Backend Health
```bash
curl https://realestate-api.onrender.com/healthz
```

### Frontend Health
```bash
curl https://my-docs.ai/healthz
# Should proxy to backend and return {"ok":true}
```

### Check Proxy Logs
- Render Dashboard → `realestate-frontend` → Logs
- Look for `[Proxy]` messages

## Cost

**Render Free Tier** (both services):
- 750 hours/month per service
- Services sleep after 15 min inactivity
- First request after sleep: 30-60 seconds

**Upgrade Options**:
- $7/month per service for always-on
- Better performance and no cold starts

## Updating Deployment

### Update Backend
```bash
git add orchestrator/
git commit -m "Update backend"
git push origin main
# Render auto-deploys
```

### Update Frontend
```bash
git add deal-agent-ui/
git commit -m "Update frontend"
git push origin main
# Render auto-deploys
```

### Manual Deploy
- Render Dashboard → Service → "Manual Deploy" → "Deploy latest commit"

## Security Notes

1. ✅ All traffic uses HTTPS (SSL by Render)
2. ✅ API keys stored in environment variables (not in code)
3. ✅ CORS restricted to your domain
4. ✅ Backend not directly exposed (proxied)

## Next Steps

1. Set up monitoring (UptimeRobot)
2. Configure alerts for downtime
3. Monitor API usage
4. Consider upgrading to paid tier for production use

---

**Deployment Complete!** 🎉

Your app is now accessible at: `https://my-docs.ai`

Both frontend and backend are served from the same domain with API requests transparently proxied to the backend service.
