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
  schedule: string;
  enabled?: boolean;
};

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

    const schedule = w.schedule || "0 * * * *"; // default: hourly
    
    cron.schedule(schedule, () => {
      console.log(`[comet-scheduler] Triggering watchlist: ${w.id} (${w.label})`);
      enqueueCometJob(w.id);
    }, {
      timezone: "UTC"
    });

    console.log(`[comet-scheduler] ✅ Scheduled ${w.id}: "${schedule}" (${w.label})`);
  }

  // Also trigger all enabled watchlists immediately on startup
  console.log("[comet-scheduler] Triggering initial run for all watchlists...");
  for (const w of watchlists) {
    if (w.enabled !== false) {
      enqueueCometJob(w.id);
    }
  }
}
