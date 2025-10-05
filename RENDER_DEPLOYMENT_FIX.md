# 🚀 Render Deployment - CORS Fix

## 🔴 The Problem

Your frontend (`https://deal-agent-ui.onrender.com`) cannot access your backend (`https://realestate-ai-agent.onrender.com`) due to CORS policy blocking cross-origin requests.

**Error Message**:
```
Access to fetch at 'https://realestate-ai-agent.onrender.com/...'
from origin 'https://deal-agent-ui.onrender.com' has been blocked by CORS policy:
No Access-Control-Allow-Origin header is present on the requested resource.
```

## ✅ The Solution

Your backend already has configurable CORS support. You just need to set the `CORS_ORIGINS` environment variable in your Render backend deployment.

---

## 📝 Step-by-Step Fix

### Step 1: Update Backend Environment Variables on Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Click on your **backend service** (`realestate-ai-agent`)
3. Go to **Environment** tab
4. Add or update the `CORS_ORIGINS` environment variable:

```
CORS_ORIGINS=https://deal-agent-ui.onrender.com,http://localhost:4200
```

**Important**: 
- Include both your production domain AND localhost for local development
- Separate multiple origins with commas (no spaces)
- Use the exact URL (including `https://`)

### Step 2: Save and Redeploy

1. Click **Save Changes**
2. Render will automatically redeploy your backend
3. Wait for the deployment to complete (~2-3 minutes)

### Step 3: Verify the Fix

1. Open your frontend: https://deal-agent-ui.onrender.com
2. Open browser DevTools (F12) → Console
3. Run a search
4. The CORS error should be **gone**
5. Data should stream normally

---

## 🔧 Alternative: Quick Test (Development Only)

If you want to test quickly, you can temporarily allow all origins:

**⚠️ NOT RECOMMENDED FOR PRODUCTION**

```
CORS_ORIGINS=*
```

This allows requests from any domain. Only use this for testing, then switch back to explicit domains.

---

## 📋 Complete Environment Variables Checklist

Make sure these are set in your Render backend:

### Required
- ✅ `OPENAI_API_KEY` - Your OpenAI API key
- ✅ `SERPER_API_KEY` - For web search
- ✅ `CORS_ORIGINS` - Frontend domain(s)

### Optional (but recommended)
- `FRED_API_KEY` - For treasury rate data
- `BLS_API_KEY` - For unemployment data
- `PORT` - Usually auto-set by Render (3001)
- `PE_MODE` - "private" or "institutional"

---

## 🧪 How to Test CORS is Working

### Test 1: Browser Console
```javascript
// Open console on https://deal-agent-ui.onrender.com
fetch('https://realestate-ai-agent.onrender.com/healthz')
  .then(r => r.json())
  .then(d => console.log('CORS works!', d))
  .catch(e => console.error('CORS failed:', e))
```

**Expected**: `CORS works! {ok: true}`

### Test 2: Network Tab
1. Open DevTools → Network tab
2. Run a search
3. Look for requests to your backend
4. Check Response Headers for:
   ```
   Access-Control-Allow-Origin: https://deal-agent-ui.onrender.com
   ```

### Test 3: Chat Feature
1. Run a search to get results
2. Open chat (💬 button)
3. Ask: "Show me the premium opportunities"
4. Should get a response (not CORS error)

---

## 🐛 Troubleshooting

### Issue: Still getting CORS error after setting CORS_ORIGINS

**Solution**:
1. Check the environment variable is saved correctly (no typos)
2. Make sure backend redeployed (check Render logs)
3. Hard refresh frontend (Ctrl+Shift+R or Cmd+Shift+R)
4. Clear browser cache

### Issue: CORS works but chat doesn't respond

**Solution**:
1. Check `OPENAI_API_KEY` is set in backend
2. Check backend logs for errors
3. Verify chat endpoint is working: `https://realestate-ai-agent.onrender.com/healthz`

### Issue: Local development stopped working

**Solution**:
Make sure `CORS_ORIGINS` includes localhost:
```
CORS_ORIGINS=https://deal-agent-ui.onrender.com,http://localhost:4200
```

---

## 📦 Current CORS Configuration

Your backend (`orchestrator/src/index.ts`) already has this code:

```typescript
// Configurable CORS (comma-separated origins in CORS_ORIGINS, default "*")
const rawOrigins = process.env.CORS_ORIGINS || "*";
const allowedOrigins = rawOrigins.split(",").map((s) => s.trim()).filter(Boolean);

const corsOptions: any = {
  origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
    if (!origin) return cb(null, true); // same-origin or curl
    if (rawOrigins === "*" || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
```

This means:
- ✅ CORS is already implemented
- ✅ Supports multiple origins
- ✅ Configurable via environment variable
- ✅ Includes credentials support
- ✅ Handles preflight requests

**You just need to set the environment variable!**

---

## 🎯 Expected Behavior After Fix

### Before Fix (Current State)
```
❌ Frontend → Backend: BLOCKED by CORS
❌ Charts don't load data
❌ Chat doesn't work
❌ Search results don't stream
```

### After Fix
```
✅ Frontend → Backend: ALLOWED
✅ Charts load and display data
✅ Chat works with AI responses
✅ Search results stream in real-time
✅ All features functional
```

---

## 🚀 Deployment Checklist

- [ ] Set `CORS_ORIGINS` in Render backend environment
- [ ] Include production domain: `https://deal-agent-ui.onrender.com`
- [ ] Include localhost for dev: `http://localhost:4200`
- [ ] Save changes in Render
- [ ] Wait for automatic redeploy
- [ ] Test frontend loads without CORS errors
- [ ] Test search functionality
- [ ] Test chat functionality
- [ ] Verify in browser console (no CORS errors)

---

## 📞 Quick Reference

### Render Backend URL
```
https://realestate-ai-agent.onrender.com
```

### Render Frontend URL
```
https://deal-agent-ui.onrender.com
```

### CORS_ORIGINS Value
```
CORS_ORIGINS=https://deal-agent-ui.onrender.com,http://localhost:4200
```

---

## 💡 Pro Tips

1. **Always use HTTPS** in production URLs (Render provides this automatically)
2. **Don't use wildcards** (`*`) in production - security risk
3. **Include localhost** for local development testing
4. **Check Render logs** if issues persist after deployment
5. **Hard refresh** browser after backend changes

---

**Status**: Ready to deploy
**Estimated Fix Time**: 5 minutes
**Impact**: Fixes all CORS-related issues

Once you set the `CORS_ORIGINS` environment variable in Render, everything should work! 🎉
