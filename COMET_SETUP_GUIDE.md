# 🚀 Comet Browser Agent - Setup Guide

## ✅ Phase 1 MVP Implementation Complete!

The Comet Browser Agent is now installed and ready to run. This guide will help you get it up and running.

---

## 📦 What Was Installed

### New Files Created:
1. **`watchlists.json`** - Configuration for monitored searches
2. **`src/comet/queue.ts`** - In-memory job queue
3. **`src/comet/scheduler.ts`** - Cron-based scheduler
4. **`src/comet/worker.ts`** - Main processing logic
5. **`src/comet/store.ts`** - File-based snapshot storage
6. **`src/integrations/slack.ts`** - Slack webhook integration

### Dependencies Added:
- `node-cron` - Cron scheduler
- `@types/node-cron` - TypeScript types

---

## 🔧 Configuration

### 1. Environment Variables

Add to your `.env` file:

```bash
# Comet Browser Agent
COMET_ENABLED=true
COMET_DATA_DIR=.comet

# Required (you should already have these)
FRED_API_KEY=your_fred_key
BLS_API_KEY=your_bls_key
SERPER_API_KEY=your_serper_key

# Optional: Slack notifications (can be added later)
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 2. Configure Watchlists

Edit `watchlists.json` to customize your monitored searches:

```json
[
  {
    "id": "mob-florida",
    "label": "MOB w/ hospital affiliation (FL, 6-8% cap)",
    "query": "(\"medical office\" OR MOB) (hospital OR \"health system\") Florida \"for sale\" cap rate 6..8%",
    "domains": ["crexi.com", "loopnet.com", "brevitas.com"],
    "minScore": 70,
    "riskMax": 65,
    "schedule": "*/30 * * * *",
    "enabled": true
  }
]
```

**Schedule Format** (cron):
- `*/30 * * * *` - Every 30 minutes
- `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours
- `0 9 * * *` - Daily at 9 AM UTC

---

## 🚀 Running the Comet Agent

### Start the Server:

```bash
cd orchestrator
npm run dev
```

You should see:

```
[orchestrator] Starting Comet Browser Agent...
[comet-worker] Starting worker...
[comet-worker] ✅ Worker ready
[comet-scheduler] Starting scheduler for 2 watchlists
[comet-scheduler] ✅ Scheduled mob-florida: "*/30 * * * *" (MOB w/ hospital affiliation)
[comet-scheduler] ✅ Scheduled nnn-walgreens: "0 * * * *" (Walgreens NNN Investment Grade)
[comet-scheduler] Triggering initial run for all watchlists...
[orchestrator] listening on :3001
[orchestrator] Comet Agent: monitoring ENABLED
```

---

## 📊 How It Works

### Workflow:

1. **Scheduler** triggers jobs based on cron schedule
2. **Queue** receives job for watchlist
3. **Worker** processes job:
   - Searches multiple domains (SERPER)
   - Scores results (PE Model)
   - Calculates risk (Multi-factor model)
   - Filters by thresholds
   - Compares with previous snapshot
   - Detects new/changed listings
4. **Store** saves current snapshot to `.comet/` directory
5. **Slack** sends alert if changes detected

### First Run:
- All watchlists run immediately on startup
- No previous snapshot exists, so all results are "new"
- You'll get initial Slack alerts with current listings

### Subsequent Runs:
- Runs on schedule (e.g., every 30 min)
- Compares with previous snapshot
- Only alerts on NEW or CHANGED listings

---

## 🔔 Console Alert Format

When changes are detected, you'll see in the console:

```
[comet-worker] 🔔 ALERT: MOB w/ hospital affiliation (FL, 6-8% cap)
[comet-worker] 📊 Summary: 2 new, 1 changed
[comet-worker] ─────────────────────────────────────────────────────
[comet-worker] 🆕 NEW LISTINGS:
[comet-worker]   1. Medical Office Building - Tampa
[comet-worker]      PE: 75 | Risk: 58
[comet-worker]      https://www.crexi.com/properties/...
[comet-worker]   2. MOB with Hospital Affiliation
[comet-worker]      PE: 72 | Risk: 60
[comet-worker]      https://www.loopnet.com/...
[comet-worker] 📝 CHANGED LISTINGS:
[comet-worker]   1. Medical Plaza - Orlando
[comet-worker]      PE: 73 | Risk: 59
[comet-worker]      https://www.brevitas.com/...
[comet-worker] ─────────────────────────────────────────────────────
[comet-worker] ✅ Completed mob-florida in 4231ms
```

### Optional: Slack Notifications

If you want Slack alerts in addition to console logs, add to `.env`:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

The Comet Agent will automatically send formatted Slack messages when this is configured.

---

## 📁 Data Storage

### Snapshot Files:
- Location: `.comet/` directory (configurable via `COMET_DATA_DIR`)
- Format: JSON files named `{watchlist-id}.json`
- Content: Array of listings with scores, URLs, metadata

### Example Snapshot:
```json
{
  "watchId": "mob-florida",
  "ts": 1696531200000,
  "items": [
    {
      "url": "https://www.crexi.com/...",
      "score": 75,
      "risk": 58,
      "title": "Medical Office Building - Tampa",
      "price": "$2.5M",
      "capRate": "7.2%"
    }
  ]
}
```

---

## 🧪 Testing

### Test a Single Watchlist:

```bash
# Trigger manually (for testing)
curl -X POST http://localhost:3001/comet/trigger \
  -H "Content-Type: application/json" \
  -d '{"watchId": "mob-florida"}'
```

(Note: You'll need to add this endpoint if you want manual triggering)

### Check Logs:

```bash
# Watch for Comet activity
tail -f orchestrator/logs/comet.log

# Or just watch console output
npm run dev
```

### Verify Snapshots:

```bash
ls -la .comet/
cat .comet/mob-florida.json
```

---

## 🎯 Customization

### Add a New Watchlist:

1. Edit `watchlists.json`
2. Add new object with unique `id`
3. Set `enabled: true`
4. Restart server

### Adjust Thresholds:

- `minScore`: Minimum PE score (default: 70)
- `riskMax`: Maximum risk score (default: 70)
- Higher minScore = fewer but better quality alerts
- Lower riskMax = only safer deals

### Change Schedule:

- Edit `schedule` field in watchlist
- Use https://crontab.guru/ to build cron expressions
- Restart server to apply changes

---

## 🐛 Troubleshooting

### No Alerts Received:

1. **Check Slack webhook**:
   ```bash
   curl -X POST $SLACK_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"text": "Test from Comet Agent"}'
   ```

2. **Check logs** for errors:
   ```
   [comet-worker] Error processing mob-florida: ...
   ```

3. **Verify watchlist is enabled**:
   ```json
   "enabled": true
   ```

4. **Check if results pass thresholds**:
   ```
   [comet-worker] 0 items pass thresholds (PE ≥ 70, Risk ≤ 65)
   ```

### Scheduler Not Running:

1. **Check `watchlists.json` exists** in orchestrator root
2. **Verify cron syntax** is valid
3. **Check console** for scheduler startup messages

### Too Many Alerts:

1. **Increase minScore** threshold (e.g., 70 → 75)
2. **Decrease riskMax** threshold (e.g., 70 → 60)
3. **Reduce search frequency** (e.g., every 2 hours instead of 30 min)

---

## 📈 Monitoring

### Key Metrics to Watch:

- **Alert frequency**: How often you get notifications
- **False positives**: Irrelevant listings passing filters
- **Missed deals**: Good deals not captured
- **Processing time**: How long each job takes

### Logs to Monitor:

```
[comet-worker] ✅ Completed mob-florida in 3542ms
[comet-store] Diff: 2 new, 1 changed, 0 removed
[slack] ✅ Notification sent successfully
```

---

## 🚀 Next Steps (Phase 2)

Once Phase 1 is working well, consider:

1. **Redis + BullMQ** - Replace in-memory queue
2. **Postgres** - Replace file-based storage
3. **UI Dashboard** - View watchlists, history, analytics
4. **Email Alerts** - In addition to Slack
5. **Historical Charts** - Trend analysis over time

---

## 💡 Pro Tips

### Optimize for Your Use Case:

**High-Volume Markets** (e.g., multifamily):
- Run every 2-4 hours
- Higher minScore (75+)
- Stricter filters

**Niche Markets** (e.g., specialty medical):
- Run every 30-60 min
- Lower minScore (65+)
- Broader filters

**Investment Grade NNN**:
- Run hourly
- Very high minScore (80+)
- Low riskMax (50)

### Reduce Noise:

1. Start with **high thresholds** (minScore: 75, riskMax: 60)
2. Monitor for 1 week
3. Adjust based on alert quality
4. Iterate until you get 2-5 relevant alerts per day

---

## ✅ Success Criteria

You'll know it's working when:

- ✅ Server starts without errors
- ✅ Scheduler logs show watchlists registered
- ✅ Initial Slack alerts received on startup
- ✅ Subsequent alerts only for NEW/CHANGED listings
- ✅ `.comet/` directory contains snapshot files
- ✅ Processing completes in < 10 seconds per watchlist

---

## 🎓 Understanding the Output

### Slack Alert Breakdown:

```
🔔 MOB w/ hospital affiliation (FL, 6-8% cap)
   ↑ Watchlist label

2 new, 1 changed
↑ Summary of changes

Property Listing
PE: 75 | Risk: 58 | Price: $2.5M | Cap: 7.2%
↑ PE Score | Risk Score | Asking Price | Cap Rate

https://www.crexi.com/properties/...
↑ Direct link to listing
```

### Console Logs:

```
[comet-scheduler] Triggering watchlist: mob-florida
  ↑ Cron triggered the job

[comet-worker] Processing job for watchlist: mob-florida
  ↑ Worker picked up the job

[comet-worker] Found 15 search results
  ↑ SERPER returned 15 URLs

[comet-worker] Scored 15 results
  ↑ PE Model scored all results

[comet-worker] Risk Score: 58/100
  ↑ Market risk calculated

[comet-worker] 8 items pass thresholds (PE ≥ 70, Risk ≤ 65)
  ↑ 8 listings meet your criteria

[comet-store] Diff: 2 new, 1 changed, 0 removed
  ↑ Comparison with previous snapshot

[slack] ✅ Notification sent successfully
  ↑ Alert delivered to Slack

[comet-worker] ✅ Completed mob-florida in 4231ms
  ↑ Job finished in 4.2 seconds
```

---

## 📞 Support

If you encounter issues:

1. Check this guide first
2. Review console logs for errors
3. Verify all environment variables are set
4. Test Slack webhook manually
5. Check `.comet/` directory permissions

---

**Status**: ✅ Phase 1 MVP Ready
**Version**: 1.0.0
**Date**: October 5, 2025

🎉 **Your Comet Browser Agent is now monitoring markets 24/7!**
