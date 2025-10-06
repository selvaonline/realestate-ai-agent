# 🚀 Comet Agent - Quick Start (No Slack Required)

## Get Started in 3 Steps

### 1. Verify Configuration

Your `.env` should have:
```bash
FRED_API_KEY=your_key_here
BLS_API_KEY=your_key_here
SERPER_API_KEY=your_key_here
```

### 2. Start the Server

```bash
cd orchestrator
npm run dev
```

### 3. Watch the Console

You'll see:
```
[comet-scheduler] Starting scheduler for 2 watchlists
[comet-scheduler] ✅ Scheduled mob-florida: "*/30 * * * *"
[comet-scheduler] ✅ Scheduled nnn-walgreens: "0 * * * *"
[comet-scheduler] Triggering initial run for all watchlists...
[comet-worker] Processing job for watchlist: mob-florida
[comet-worker] Found 15 search results
[comet-worker] 🔔 ALERT: MOB w/ hospital affiliation (FL, 6-8% cap)
[comet-worker] 📊 Summary: 8 new, 0 changed
[comet-worker] 🆕 NEW LISTINGS:
[comet-worker]   1. Medical Office Building - Tampa
[comet-worker]      PE: 75 | Risk: 58
[comet-worker]      https://www.crexi.com/properties/...
```

---

## What Happens Next?

### First Run (Immediate):
- All watchlists run on startup
- Everything is "new" (no previous snapshot)
- You'll see all current listings in console

### Scheduled Runs:
- **MOB Florida**: Every 30 minutes
- **Walgreens NNN**: Every hour
- Only NEW or CHANGED listings are shown

---

## Customize Watchlists

Edit `orchestrator/watchlists.json`:

```json
{
  "id": "your-watchlist",
  "label": "Your Description",
  "query": "your search terms",
  "minScore": 70,
  "riskMax": 65,
  "schedule": "*/30 * * * *",
  "enabled": true
}
```

**Schedule Examples**:
- `*/30 * * * *` - Every 30 minutes
- `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours
- `0 9,17 * * *` - 9 AM and 5 PM daily

---

## View Snapshots

```bash
ls -la .comet/
cat .comet/mob-florida.json
```

Each snapshot shows:
- All listings that passed thresholds
- PE and Risk scores
- Timestamp of capture

---

## Adjust Thresholds

**Too many alerts?**
- Increase `minScore` (70 → 75)
- Decrease `riskMax` (65 → 60)

**Too few alerts?**
- Decrease `minScore` (70 → 65)
- Increase `riskMax` (65 → 70)

**Change frequency:**
- Edit `schedule` field
- Restart server

---

## Troubleshooting

### No alerts?
1. Check if results pass thresholds:
   ```
   [comet-worker] 0 items pass thresholds (PE ≥ 70, Risk ≤ 65)
   ```
2. Lower thresholds temporarily
3. Check search results count

### Errors?
1. Verify API keys in `.env`
2. Check console for error messages
3. Ensure `watchlists.json` is valid JSON

---

## Add Slack Later (Optional)

When ready, just add to `.env`:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

No code changes needed - it will automatically start sending Slack alerts!

---

## That's It! 🎉

Your Comet Agent is now:
- ✅ Monitoring markets 24/7
- ✅ Running searches automatically
- ✅ Detecting new/changed listings
- ✅ Logging alerts to console
- ✅ Saving historical snapshots

**Watch your console for alerts!**
