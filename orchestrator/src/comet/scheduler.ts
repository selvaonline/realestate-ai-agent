// src/comet/scheduler.ts
// Cron-based scheduler for watchlists

import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import { enqueueCometJob } from "./queue.js";

type Watchlist = {
  id: string;
  label: string;
  query: string;
  domains?: string[];
  minScore?: number;
  riskMax?: number;
  schedule?: string;
  enabled?: boolean;
};

// Store active cron jobs for management
const activeCronJobs = new Map<string, cron.ScheduledTask>();

export function startCometScheduler() {
  const watchlistsPath = path.join(process.cwd(), "watchlists.json");
  
  if (!fs.existsSync(watchlistsPath)) {
    console.log("[comet-scheduler] No watchlists.json found, skipping scheduler");
    return;
  }

  const watchlists = JSON.parse(fs.readFileSync(watchlistsPath, "utf-8")) as Watchlist[];
  
  console.log(`[comet-scheduler] Starting scheduler for ${watchlists.length} watchlists`);

  for (const w of watchlists) {
    if (w.enabled === false) {
      console.log(`[comet-scheduler] Skipping disabled watchlist: ${w.id}`);
      continue;
    }

    scheduleWatchlist(w);
  }

  // Also trigger all enabled watchlists immediately on startup
  console.log("[comet-scheduler] Triggering initial run for all watchlists...");
  for (const w of watchlists) {
    if (w.enabled !== false) {
      enqueueCometJob(w.id);
    }
  }

  // Test cron job to verify cron is working
  console.log("[comet-scheduler] Setting up test cron job (every 10 seconds)...");
  cron.schedule("*/10 * * * * *", () => {
    console.log(`[comet-scheduler] 🧪 TEST CRON: ${new Date().toISOString()}`);
  }, {
    timezone: "UTC"
  });
}

export function scheduleWatchlist(watchlist: Watchlist) {
  // Remove existing job if it exists
  if (activeCronJobs.has(watchlist.id)) {
    console.log(`[comet-scheduler] Removing existing job for ${watchlist.id}`);
    activeCronJobs.get(watchlist.id)?.destroy();
    activeCronJobs.delete(watchlist.id);
  }

  if (watchlist.enabled === false) {
    console.log(`[comet-scheduler] Skipping disabled watchlist: ${watchlist.id}`);
    return;
  }

  const schedule = watchlist.schedule || "0 * * * *"; // default: hourly
  
  const cronJob = cron.schedule(schedule, () => {
    console.log(`[comet-scheduler] ⏰ CRON TRIGGERED: ${watchlist.id} (${watchlist.label}) at ${new Date().toISOString()}`);
    enqueueCometJob(watchlist.id);
  }, {
    timezone: "UTC"
  });

  activeCronJobs.set(watchlist.id, cronJob);
  console.log(`[comet-scheduler] ✅ Scheduled ${watchlist.id}: "${schedule}" (${watchlist.label})`);
}

export function unscheduleWatchlist(watchlistId: string) {
  if (activeCronJobs.has(watchlistId)) {
    console.log(`[comet-scheduler] Removing scheduled job for ${watchlistId}`);
    activeCronJobs.get(watchlistId)?.destroy();
    activeCronJobs.delete(watchlistId);
    console.log(`[comet-scheduler] ✅ Unscheduled ${watchlistId}`);
  } else {
    console.log(`[comet-scheduler] No active job found for ${watchlistId}`);
  }
}

export function rescheduleAllWatchlists() {
  console.log("[comet-scheduler] Rescheduling all watchlists...");
  
  // Clear all existing jobs
  for (const [id, job] of activeCronJobs) {
    console.log(`[comet-scheduler] Removing job for ${id}`);
    job.destroy();
  }
  activeCronJobs.clear();

  // Reload and reschedule
  const watchlistsPath = path.join(process.cwd(), "watchlists.json");
  if (!fs.existsSync(watchlistsPath)) {
    console.log("[comet-scheduler] No watchlists.json found, skipping reschedule");
    return;
  }

  const watchlists = JSON.parse(fs.readFileSync(watchlistsPath, "utf-8")) as Watchlist[];
  
  for (const w of watchlists) {
    scheduleWatchlist(w);
  }
  
  console.log(`[comet-scheduler] Rescheduled ${activeCronJobs.size} watchlists`);
}