# Troubleshooting Deployment on my-docs.ai

## Issue: Application works locally but not on my-docs.ai server

This guide will help you diagnose and fix deployment issues.

---

## Quick Diagnostic Checklist

Run these tests to identify the problem:

### 1. Test Backend API (realestate-api.onrender.com)

```bash
# Test health endpoint
curl https://realestate-api.onrender.com/healthz

# Expected: {"ok":true}
# If timeout: Backend is sleeping (free tier) - wait 60 seconds and retry
# If 404/500: Backend deployment failed - check Render logs
```

### 2. Test Frontend (my-docs.ai)

```bash
# Test if site loads
curl -I https://my-docs.ai

# Expected: HTTP/2 200
# If timeout/connection refused: DNS not configured or frontend down
# If 502: Backend proxy issue
```

### 3. Test Proxy Connection

```bash
# Test if frontend can proxy to backend
curl https://my-docs.ai/healthz

# Expected: {"ok":true} (proxied from backend)
# If fails: Proxy configuration issue
```

### 4. Test SSE Connection

```bash
# Test Server-Sent Events endpoint
curl -N https://my-docs.ai/ui/events

# Expected: 
# event: connected
# data: {"type":"connected"}
#
# If fails: SSE proxy not working
```

---

## Common Issues & Solutions

### Issue 1: Backend Sleeping (502 Bad Gateway)

**Symptom**: First request fails or takes 30-60 seconds

**Cause**: Render free tier spins down after 15 minutes of inactivity

**Solution**:
```bash
# Wake up the backend first
curl https://realestate-api.onrender.com/healthz
# Wait 60 seconds
sleep 60
# Try again
curl https://my-docs.ai/healthz
```

**Permanent Fix**: Upgrade to Render paid tier ($7/month) for always-on service

---

### Issue 2: CORS Errors in Browser Console

**Symptom**: Browser shows "blocked by CORS policy"

**Cause**: Backend CORS not configured for my-docs.ai domain

**Solution**:
1. Go to Render Dashboard → `realestate-api` → Environment
2. Update `CORS_ORIGINS` to include your domain:
   ```
   CORS_ORIGINS=https://my-docs.ai,http://localhost:4200
   ```
3. Click "Save Changes"
4. Wait for service to restart (2-3 minutes)

---

### Issue 3: Proxy Not Working (404 on API calls)

**Symptom**: API calls return 404 or don't reach backend

**Cause**: Frontend proxy not configured correctly

**Solution**:
1. Check Render Dashboard → `realestate-frontend` → Environment
2. Verify `API_URL` is set:
   ```
   API_URL=https://realestate-api.onrender.com
   ```
3. Check `server.js` is being used:
   - Build Command: `npm install && npm run build:prod`
   - Start Command: `npm run start:prod`
4. Redeploy if needed

---

### Issue 4: Environment Variables Missing

**Symptom**: Backend errors about missing API keys

**Cause**: Environment variables not set in Render

**Solution**:
1. Go to Render Dashboard → `realestate-api` → Environment
2. Add required variables:
   ```
   OPENAI_API_KEY=sk-...
   SERPER_API_KEY=...
   OPENAI_MODEL=gpt-4o-mini
   CORS_ORIGINS=https://my-docs.ai,http://localhost:4200
   PORT=3001
   NODE_ENV=production
   BROWSER_HEADED=false
   BROWSER_ENGINE=chromium
   COMET_ENABLED=true
   SKIP_EXTRACTION=true
   MIN_BROWSE_SCORE=70
   ```
3. Save and wait for restart

---

### Issue 5: DNS Not Configured

**Symptom**: my-docs.ai doesn't load at all

**Cause**: Custom domain not properly configured

**Solution**:
1. Go to Render Dashboard → `realestate-frontend` → Settings → Custom Domains
2. Verify `my-docs.ai` is added
3. Check DNS records at your domain registrar:
   ```
   Type: CNAME
   Name: @ (or my-docs)
   Value: realestate-frontend.onrender.com
   TTL: 3600
   ```
4. Wait for DNS propagation (5-60 minutes)
5. Test with: `dig my-docs.ai` or `nslookup my-docs.ai`

---

### Issue 6: Build Failures

**Symptom**: Deployment fails during build

**Cause**: Missing dependencies or build errors

**Solution for Backend**:
1. Check Render logs for error messages
2. Common fixes:
   ```bash
   # Ensure package.json has correct scripts
   "scripts": {
     "build": "tsc",
     "start": "node dist/index.js"
   }
   ```
3. Verify Dockerfile is correct (already exists)

**Solution for Frontend**:
1. Check Render logs for error messages
2. Verify build command:
   ```
   npm install && npm run build:prod
   ```
3. Ensure `dist/deal-agent-ui/browser` directory is created

---

### Issue 7: SSE Connection Fails

**Symptom**: Real-time updates don't work, no thinking steps appear

**Cause**: SSE proxy not configured or blocked

**Solution**:
1. Verify `server.js` has SSE proxy:
   ```javascript
   app.get('/ui/events', createProxyMiddleware({
     target: API_URL,
     changeOrigin: true,
     ws: true // Enable WebSocket/SSE
   }));
   ```
2. Check browser Network tab for `/ui/events` request
3. Should show "EventStream" type, not cancelled

---

### Issue 8: Static Files Not Loading

**Symptom**: Blank page or 404 for JS/CSS files

**Cause**: Incorrect build path in server.js

**Solution**:
1. Verify `server.js` has correct path:
   ```javascript
   const distPath = path.join(__dirname, 'dist/deal-agent-ui/browser');
   app.use(express.static(distPath));
   ```
2. Check build output directory matches
3. Redeploy frontend

---

## Step-by-Step Debugging

### Step 1: Check Backend Status

```bash
# Check if backend is running
curl https://realestate-api.onrender.com/healthz

# If it fails, check Render logs:
# Dashboard → realestate-api → Logs
```

**Look for**:
- ✅ "Server running on port 3001"
- ✅ "Agent initialized"
- ❌ "Error: Missing API key"
- ❌ "Port already in use"

### Step 2: Check Frontend Status

```bash
# Check if frontend is running
curl -I https://my-docs.ai

# Check Render logs:
# Dashboard → realestate-frontend → Logs
```

**Look for**:
- ✅ "Server running on port 8080"
- ✅ "Proxying API requests to: https://realestate-api.onrender.com"
- ❌ "Cannot find module"
- ❌ "ENOENT: no such file or directory"

### Step 3: Test in Browser

1. Open https://my-docs.ai
2. Open Browser DevTools (F12)
3. Go to Console tab
4. Try a search: "CVS pharmacy Dallas"

**Check for errors**:
- ❌ CORS error → Fix CORS_ORIGINS in backend
- ❌ 404 on /run → Fix proxy configuration
- ❌ 502 Bad Gateway → Backend is sleeping or down
- ❌ Connection timeout → Backend not responding

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Try a search
3. Look for these requests:
   - `/run` → Should be 200 OK
   - `/ui/events` → Should be EventStream (pending)
   - `/events/{id}` → Should be 200 OK

**If requests fail**:
- Check Status Code
- Check Response body for error message
- Check Request Headers (Origin, Content-Type)

---

## Environment Configuration Reference

### Backend Environment Variables (Render)

Required:
```
OPENAI_API_KEY=sk-...
SERPER_API_KEY=...
```

Recommended:
```
OPENAI_MODEL=gpt-4o-mini
CORS_ORIGINS=https://my-docs.ai,http://localhost:4200
PORT=3001
NODE_ENV=production
BROWSER_HEADED=false
BROWSER_ENGINE=chromium
COMET_ENABLED=true
SKIP_EXTRACTION=true
MIN_BROWSE_SCORE=70
```

### Frontend Environment Variables (Render)

Required:
```
NODE_ENV=production
PORT=8080
API_URL=https://realestate-api.onrender.com
```

---

## Manual Deployment Steps

If auto-deploy isn't working:

### Redeploy Backend
```bash
# Render Dashboard → realestate-api
# Click "Manual Deploy" → "Deploy latest commit"
# Or trigger with:
git commit --allow-empty -m "Trigger backend deploy"
git push origin main
```

### Redeploy Frontend
```bash
# Render Dashboard → realestate-frontend
# Click "Manual Deploy" → "Deploy latest commit"
# Or trigger with:
git commit --allow-empty -m "Trigger frontend deploy"
git push origin main
```

---

## Logs to Check

### Backend Logs (Render Dashboard → realestate-api → Logs)

**Successful startup**:
```
==> Building...
==> Installing dependencies...
==> Running build...
==> Starting service...
🚀 Server running on port 3001
✅ Agent initialized
```

**Common errors**:
```
❌ Error: Missing OPENAI_API_KEY
❌ Error: Cannot find module 'express'
❌ Error: Port 3001 is already in use
```

### Frontend Logs (Render Dashboard → realestate-frontend → Logs)

**Successful startup**:
```
==> Building...
==> npm run build:prod
==> Starting service...
🚀 Server running on port 8080
📡 Proxying API requests to: https://realestate-api.onrender.com
```

**Common errors**:
```
❌ ENOENT: no such file or directory, stat 'dist/deal-agent-ui/browser'
❌ Error: Cannot find module 'http-proxy-middleware'
```

---

## Testing Locally with Production Config

To test the production setup locally:

```bash
# Terminal 1: Start backend
cd orchestrator
npm run dev

# Terminal 2: Build and run frontend with proxy
cd deal-agent-ui
npm run build:prod
npm run start:prod

# Visit: http://localhost:8080
# This simulates the production setup
```

---

## Contact Support

If none of these solutions work:

1. **Check Render Status**: https://status.render.com
2. **Render Support**: https://render.com/support
3. **Check GitHub Issues**: Look for similar deployment issues

---

## Quick Fix Commands

```bash
# Wake up sleeping backend
curl https://realestate-api.onrender.com/healthz && sleep 60

# Test full flow
curl https://my-docs.ai/healthz

# Check DNS
dig my-docs.ai

# Test SSE
curl -N https://my-docs.ai/ui/events

# Force redeploy both services
git commit --allow-empty -m "Force redeploy"
git push origin main
```

---

## Success Indicators

When everything is working correctly:

✅ Backend health check returns `{"ok":true}`
✅ Frontend loads at https://my-docs.ai
✅ No CORS errors in browser console
✅ Search queries return results
✅ Thinking steps appear in real-time
✅ Deal cards display properly
✅ No 502/504 errors

---

**Need more help?** Check the detailed guides:
- [PROXY_DEPLOYMENT_GUIDE.md](./PROXY_DEPLOYMENT_GUIDE.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [RENDER_DEPLOYMENT_FIX.md](./RENDER_DEPLOYMENT_FIX.md)
