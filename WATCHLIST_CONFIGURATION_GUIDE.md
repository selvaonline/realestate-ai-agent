# Watchlist Configuration Guide

## Overview
The watchlist configuration system allows you to manage your watchlists, set custom monitoring schedules, and control which watchlists are active - all without restarting the server!

## Features Implemented

### ✅ 1. **Automatic Scheduler Management**
- When a watchlist is created, it's **automatically scheduled** in the background agent
- When a watchlist is deleted, it's **automatically unscheduled** from the background agent
- No server restart required!

### ✅ 2. **Configuration Screen**
Access the configuration screen by clicking the ⚙️ (settings) button in the Watchlists panel.

Features include:
- **View all watchlists** with their current schedules and status
- **Add new watchlists** with custom schedules
- **Modify schedules** for existing watchlists
- **Enable/disable** watchlists without deleting them
- **Delete watchlists** with confirmation

### ✅ 3. **Schedule Interval Options**
Choose from pre-configured intervals:
- Every 1 minute (high frequency monitoring)
- Every 5 minutes (recommended for active monitoring)
- Every 15 minutes (moderate monitoring)
- Every 30 minutes (light monitoring)
- Every hour (standard monitoring)
- Every 2 hours (low frequency)
- Every 6 hours (very low frequency)
- Daily (once per day)

### ✅ 4. **Real-time Updates**
- Schedule changes take effect immediately
- Toggle enable/disable instantly
- Background agent automatically adapts to changes

## How to Use

### Creating a New Watchlist

1. Click the watchlist button (bookmark icon) in the main interface
2. Click the ⚙️ (settings) button
3. Fill in the form:
   - **ID**: Unique identifier (e.g., `my-watchlist`)
   - **Label**: Display name (e.g., `My Watchlist`)
   - **Search Query**: Your search criteria
   - **Schedule**: Select monitoring frequency
   - **Enabled**: Check to activate immediately
4. Click "Add Watchlist"

### Modifying a Watchlist Schedule

1. Open the configuration screen (⚙️ button)
2. Find the watchlist you want to modify
3. Select a new schedule from the dropdown
4. Changes apply immediately - no save button needed!

### Enabling/Disabling a Watchlist

1. Open the configuration screen
2. Click the "Enabled/Disabled" button on the watchlist
3. The watchlist will be paused/resumed immediately

### Deleting a Watchlist

1. Open the configuration screen
2. Click the 🗑️ (delete) button
3. Confirm the deletion
4. The watchlist and its scheduled jobs are removed immediately

## Technical Details

### Backend API Endpoints

```
GET    /api/saved-properties/watchlists          # List all watchlists
POST   /api/saved-properties/watchlists          # Create new watchlist
PUT    /api/saved-properties/watchlists/:id      # Update watchlist
DELETE /api/saved-properties/watchlists/:id      # Delete watchlist
```

### Scheduler Management

The scheduler automatically manages cron jobs for each watchlist:
- **Creation**: New watchlists are immediately scheduled
- **Update**: Schedule changes trigger rescheduling
- **Deletion**: Cron jobs are destroyed when watchlists are deleted
- **Enable/Disable**: Jobs are started/stopped without deletion

### Cron Schedule Format

Schedules use standard cron syntax:
```
*/5 * * * *  = Every 5 minutes
0 * * * *    = Every hour
0 0 * * *    = Daily at midnight
```

## Files Created

1. **Frontend**:
   - `deal-agent-ui/src/app/watchlist-config.component.ts` - Main configuration component
   - `deal-agent-ui/src/app/config.ts` - Standalone config app
   - `deal-agent-ui/src/config.html` - Config page HTML
   - `deal-agent-ui/src/config.ts` - Config page entry point

2. **Backend**:
   - `orchestrator/src/comet/scheduler.ts` - Enhanced with management functions
   - `orchestrator/src/routes/savedProperties.ts` - Added PUT endpoint for updates

## Example Workflow

### Scenario: Monitor Phoenix Properties Every 5 Minutes

1. **Create Watchlist**:
   ```
   ID: phoenix-deals
   Label: Phoenix High-Value Deals
   Query: Phoenix AZ commercial real estate cap rate > 7%
   Schedule: Every 5 minutes
   Enabled: ✓
   ```

2. **Monitor**: The background agent automatically:
   - Searches every 5 minutes
   - Scores properties with the PE model
   - Calculates risk scores
   - Stores results in `.comet/phoenix-deals.json`

3. **Adjust**: Change schedule to hourly if needed:
   - Open configuration
   - Select "Every hour" from dropdown
   - Agent immediately reschedules

4. **Pause**: Temporarily disable during weekends:
   - Click "Enabled" button to disable
   - Agent stops scheduling jobs
   - Click again to resume

## Benefits

✅ **No Server Restarts**: All changes apply immediately  
✅ **Fine-Grained Control**: Set different schedules for different watchlists  
✅ **Easy Management**: Visual interface for all settings  
✅ **Safe Deletion**: Properly cleans up all resources  
✅ **Flexible Scheduling**: From every minute to daily monitoring  

## Next Steps

Consider adding:
- **Custom cron expressions** for advanced users
- **Notification settings** per watchlist
- **Performance metrics** (API usage, processing time)
- **Batch operations** (enable/disable multiple watchlists)
- **Watchlist templates** for common use cases

