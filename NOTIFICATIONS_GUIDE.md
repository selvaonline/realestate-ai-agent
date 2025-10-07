# Notifications Guide

## How Notifications Work

The DealSense Agent has a built-in **Comet Background Agent** that monitors your watchlists automatically and sends notifications when new or changed properties are found.

## Notification Channels

### ✅ UI Notifications (Always Active)
- **Location**: Bell icon (🔔) in the top-right corner of the app
- **How it works**: 
  - Server-Sent Events (SSE) push notifications to your browser in real-time
  - Notifications are stored in browser localStorage
  - Shows unread count badge
  - Click to view notification history
- **No configuration needed** - works out of the box!

### 📧 Slack Integration (Optional - Disabled by Default)
- **Status**: Optional, not required
- **How to enable**: Add `SLACK_WEBHOOK_URL` to your `.env` file
- **If not configured**: Silently skipped, no warnings or errors

## Configuration

### Required (Already Set Up)
```bash
COMET_ENABLED=true
COMET_DATA_DIR=.comet
```

### Optional (Only if you want Slack)
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Note**: If you don't want Slack notifications, simply leave `SLACK_WEBHOOK_URL` empty or don't include it in your `.env` file.

## How the Background Agent Works

1. **Scheduler**: Reads `watchlists.json` and sets up cron jobs for each enabled watchlist
2. **Worker**: Runs searches on schedule (e.g., every 30 minutes, hourly)
3. **Comparison**: Compares new results with previous snapshot
4. **Notification**: If changes detected, sends notification to UI (and Slack if configured)

## Watchlist Schedules

From your `watchlists.json`:
- **MOB w/ hospital affiliation**: Every 30 minutes (`*/30 * * * *`)
- **Walgreens NNN**: Every hour (`0 * * * *`)
- **High-Cap Retail**: Every hour (`0 * * * *`)
- **test**: Every hour (`0 * * * *`)

## Viewing Notifications

### In the UI
1. Click the **bell icon** (🔔) in the top-right corner
2. See all notifications with:
   - Watchlist name
   - Number of new/changed properties
   - Property details (title, PE score, risk score)
   - Time ago
3. Click a notification to mark it as read
4. Click "Mark all read" to clear unread count
5. Click "Clear all" to delete all notifications

### Notification Details
Each notification shows:
- 🔔 Watchlist name
- "X new, Y changed" summary
- Top 3 properties with:
  - Property title (clickable link)
  - PE Score and Risk Score
- "+N more" if there are additional properties

## Testing Notifications

### Immediate Test
Restart the backend server - it will trigger all watchlists immediately on startup:
```bash
cd orchestrator
npm run dev
```

Look for these logs:
```
[comet-scheduler] Triggering initial run for all watchlists...
[comet-worker] Processing job for watchlist: mob-florida
[comet-worker] ✅ Completed mob-florida in 5432ms
```

### Check UI Connection
Open browser console (F12) and look for:
```
[notifications-panel] Connecting to: http://localhost:3001/ui/events
[notifications-panel] SSE connection established
```

## Troubleshooting

### No notifications appearing?

1. **Check backend is running**: The Comet agent only runs when the backend is running
2. **Check browser console**: Should see SSE connection established
3. **Wait for schedule**: First notification comes after cron schedule (30-60 min)
4. **Check snapshots**: Look in `.comet/` folder for snapshot files
5. **Restart backend**: Triggers immediate run of all watchlists

### How to disable notifications?

Set in `.env`:
```bash
COMET_ENABLED=false
```

## Data Storage

### Snapshots
- **Location**: `.comet/` folder
- **Files**: `{watchlist-id}.json` (e.g., `mob-florida.json`)
- **Purpose**: Stores previous search results to detect changes
- **Format**: JSON array of property listings with scores

### Notification History
- **Location**: Browser localStorage
- **Key**: `comet-alerts`
- **Persistence**: Survives browser refresh, cleared on cache clear

## Summary

✅ **UI notifications are always active** - no configuration needed
❌ **Slack/Teams integration is optional** - only works if you configure it
🔄 **Background agent runs automatically** - monitors watchlists on schedule
📱 **Real-time updates** - notifications appear instantly via SSE
💾 **Persistent history** - notifications saved in browser localStorage

You're all set! Notifications will appear in the bell icon automatically. 🎉
