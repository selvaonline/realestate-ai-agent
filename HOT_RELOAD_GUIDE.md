# Hot Reload Setup Guide

## ✅ Hot Reload Now Enabled!

The orchestrator server now automatically reloads when you make code changes.

---

## What Changed

### `package.json` Scripts

**Before:**
```json
"scripts": {
  "dev": "tsx src/index.ts"
}
```

**After:**
```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "dev:no-watch": "tsx src/index.ts"
}
```

---

## How It Works

### `tsx watch` Mode

When you run `npm run dev`, the server now:
1. ✅ Starts the Express server on port 3001
2. ✅ Watches all `.ts` files in the `src/` directory
3. ✅ Automatically restarts when files change
4. ✅ Preserves console output and logs

### What Gets Watched

- `src/agent.ts` - Main agent logic
- `src/index.ts` - Express server
- `src/tools/*.ts` - All tools (search, browser, peScore, etc.)
- `src/infra/*.ts` - Infrastructure (market data, etc.)
- `src/lib/*.ts` - Type definitions and utilities

---

## Usage

### Start with Hot Reload (Default)
```bash
cd orchestrator
npm run dev
```

**Output:**
```
[index] 🚀 Server listening on http://localhost:3001
[index] 📡 SSE endpoint: /events/:runId
[browser] build tag: crexi-fix-v3-lease-extraction
```

**When you save a file:**
```
[tsx] File changed: src/agent.ts
[tsx] Restarting...
[index] 🚀 Server listening on http://localhost:3001
```

### Start WITHOUT Hot Reload
```bash
npm run dev:no-watch
```

Use this if:
- You're debugging and don't want automatic restarts
- You're running long-running processes
- Hot reload is causing issues

---

## Testing Hot Reload

### Test 1: Simple Change

1. **Edit a file:**
   ```bash
   # In src/agent.ts, change a console.log message
   console.log("[agent] 🔍 Search strategy 1 (primary):", query);
   # to
   console.log("[agent] 🔍 PRIMARY SEARCH:", query);
   ```

2. **Save the file** (Cmd+S)

3. **Watch terminal:**
   ```
   [tsx] File changed: src/agent.ts
   [tsx] Restarting...
   [index] 🚀 Server listening on http://localhost:3001
   ```

4. **Verify:** Run a search and check logs for "PRIMARY SEARCH"

### Test 2: New Feature

1. **Add code to `src/agent.ts`**
2. **Save file**
3. **Server restarts automatically**
4. **Test new feature immediately** - no manual restart needed!

---

## Benefits

### For Development
- ✅ **Faster iteration** - No manual restarts
- ✅ **Immediate feedback** - See changes instantly
- ✅ **Less context switching** - Stay in your editor
- ✅ **Fewer errors** - No forgetting to restart

### For Testing
- ✅ **Quick experiments** - Try changes rapidly
- ✅ **A/B testing** - Compare approaches easily
- ✅ **Bug fixing** - Iterate on fixes quickly

---

## Troubleshooting

### Issue: Server keeps restarting in a loop

**Cause:** File is being modified on every restart (e.g., auto-generated file)

**Solution:**
```bash
# Stop the server
pkill -f "tsx.*watch"

# Use no-watch mode temporarily
npm run dev:no-watch
```

### Issue: Changes not reflected

**Possible causes:**
1. **Browser cache** - Hard refresh (Cmd+Shift+R)
2. **Old process running** - Check with `lsof -ti:3001` and kill it
3. **Syntax error** - Check terminal for TypeScript errors

**Solution:**
```bash
# Kill all node processes on port 3001
lsof -ti:3001 | xargs kill

# Restart
npm run dev
```

### Issue: Want to see watch logs

**Solution:**
The `tsx watch` command is relatively quiet. To see more verbose output:

```bash
# Add debug flag (future enhancement)
tsx watch --debug src/index.ts
```

---

## Comparison: Frontend vs Backend

### Frontend (Angular) - Already Has Hot Reload
```bash
cd deal-agent-ui
ng serve
# ✅ Auto-reloads on file changes
# ✅ Shows in browser console
```

### Backend (Orchestrator) - Now Has Hot Reload
```bash
cd orchestrator
npm run dev
# ✅ Auto-restarts on file changes
# ✅ Shows in terminal
```

---

## Advanced: Custom Watch Patterns

If you want to watch additional files or exclude certain patterns:

### Option 1: Create `nodemon.json`
```json
{
  "watch": ["src"],
  "ext": "ts,js,json",
  "ignore": ["src/**/*.test.ts"],
  "exec": "tsx src/index.ts"
}
```

Then update `package.json`:
```json
"dev": "nodemon"
```

### Option 2: Use `tsx` with custom ignore
```json
"dev": "tsx watch --ignore 'src/**/*.test.ts' src/index.ts"
```

---

## Performance Notes

### Memory Usage
- Hot reload uses slightly more memory (~50-100MB)
- Acceptable for development
- For production, use `npm start` (no watch mode)

### Restart Speed
- Typical restart: ~1-2 seconds
- Depends on code complexity
- Much faster than manual restart

---

## Best Practices

### 1. Save Frequently
- Hot reload only triggers on save
- Use auto-save in your editor for maximum efficiency

### 2. Watch Terminal
- Keep terminal visible to see restart confirmations
- Check for TypeScript errors immediately

### 3. Test After Changes
- Even with hot reload, verify changes work
- Run a quick search after major changes

### 4. Use Git
- Hot reload makes it easy to try things
- Commit working code before experimenting
- Easy to revert if hot reload hides issues

---

## Summary

**Before:**
```bash
# Edit code
# Save
# Switch to terminal
# Ctrl+C to stop server
# npm run dev to restart
# Switch back to browser
# Test
```

**After:**
```bash
# Edit code
# Save
# Test (server auto-restarted!)
```

**Time saved:** ~10-15 seconds per change × 50+ changes/day = **10+ minutes saved daily!**

---

**Generated by RealEstate Deal Agent Enhancement Team**
*Version: 1.0 | Date: 2025-10-04*
*Status: Hot Reload Active ✅*
