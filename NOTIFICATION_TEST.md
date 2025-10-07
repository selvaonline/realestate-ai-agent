# Notification Service - Testing Guide

## ✅ Status: WORKING

The notification service is **correctly implemented** and should now be working!

## What Was Fixed

The notification service code was already correct. The issue was that **both servers need to be running**:
- ✅ Backend server (port 3001) - **NOW RUNNING**
- ✅ Frontend app (port 4200) - **NOW RUNNING**

## How to Test Notifications

### Method 1: Send Test Alert (Immediate)

1. **Open the app** in your browser: http://localhost:4200

2. **Send a test notification** from terminal:
   ```bash
   curl -X POST http://localhost:3001/ui/test-alert
   ```

3. **Check the UI**: You should see:
   - Bell icon (🔔) in top-right corner with a red badge showing "1"
   - Click the bell to see the test notification

### Method 2: Wait for Comet Agent (Automatic)

The Comet agent runs automatically based on your watchlist schedules:

**Your current schedules:**
- **MOB w/ hospital affiliation**: Every 30 minutes (`*/30 * * * *`)
- **Walgreens NNN**: Every hour (`0 * * * *`)
- **High-Cap Retail**: Every hour (`0 * * * *`)
- **test**: Every hour (`0 * * * *`)

**Note**: The Comet agent also triggers **immediately on server startup**, so you should see notifications within a few minutes if there are any changes.

### Method 3: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for these messages:
   ```
   [notifications-panel] Connecting to: http://localhost:3001/ui/events
   [notifications-panel] SSE connection established
   [notifications-panel] Received alert: {...}
   ```

## How Notifications Work

1. **Comet Worker** runs on schedule (or immediately on startup)
2. **Searches** for properties based on watchlist criteria
3. **Compares** with previous snapshot to detect changes
4. **Emits SSE event** to `/ui/events` endpoint
5. **Frontend receives** the event via EventSource
6. **Displays** notification in the bell icon panel

## Troubleshooting

### No notifications appearing?

**Check 1: Are both servers running?**
```bash
# Backend (should show port 3001)
lsof -i :3001

# Frontend (should show port 4200)
lsof -i :4200
```

**Check 2: Is SSE connected?**
- Open browser console (F12)
- Should see: `[notifications-panel] SSE connection established`

**Check 3: Send test alert**
```bash
curl -X POST http://localhost:3001/ui/test-alert
```
- Should return: `{"success":true,"message":"Test alert sent","subscribers":1}`
- If `subscribers: 0`, the frontend isn't connected

**Check 4: Check backend logs**
- Look for Comet worker activity:
  ```
  [comet-scheduler] Triggering initial run for all watchlists...
  [comet-worker] Processing job for watchlist: mob-florida
  [comet-worker] 🔔 ALERT: MOB w/ hospital affiliation
  ```

### Still not working?

1. **Restart both servers:**
   ```bash
   # Terminal 1: Backend
   cd orchestrator
   npm run dev
   
   # Terminal 2: Frontend
   cd deal-agent-ui
   npm start
   ```

2. **Clear browser cache** and reload

3. **Check `.env` file** has:
   ```
   COMET_ENABLED=true
   COMET_DATA_DIR=.comet
   ```

## What You Should See

### In the UI:
- 🔔 Bell icon in top-right corner
- Red badge with unread count
- Click to open notification panel
- Each notification shows:
  - Watchlist name
  - "X new, Y changed" summary
  - Property listings with PE and Risk scores
  - Clickable links to properties
  - Time ago (e.g., "5m ago")

### In Backend Logs:
```
[comet-scheduler] Starting scheduler for 4 watchlists
[comet-scheduler] ✅ Scheduled mob-florida: "*/30 * * * *"
[comet-scheduler] Triggering initial run for all watchlists...
[comet-worker] Processing job for watchlist: mob-florida
[comet-worker] Found 15 search results
[comet-worker] Scored 15 results
[comet-worker] 8 items pass thresholds (PE ≥ 70, Risk ≤ 70)
[comet-worker] 🔔 ALERT: MOB w/ hospital affiliation
[comet-worker] 📊 Summary: 3 new, 2 changed
[ui-events] Emitting comet-alert to 1 clients
```

## Next Steps

1. **Open the app**: http://localhost:4200
2. **Wait a few minutes** for Comet to run (or send test alert)
3. **Click the bell icon** to see notifications
4. **Enjoy real-time property alerts!** 🎉
