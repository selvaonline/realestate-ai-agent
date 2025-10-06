// src/comet/worker.ts
// Comet worker: search → score → diff → notify

import fs from "node:fs";
import path from "node:path";
import { cometQueue } from "./queue.js";
import { loadSnapshot, saveSnapshot, diffListings, type SnapshotItem } from "./store.js";
import { postSlack, formatCometAlert } from "../integrations/slack.js";
import { emitUI } from "../routes/uiEvents.js";
import { webSearch } from "../tools/search.js";
import { peScorePro } from "../tools/peScorePro.js";
import { riskBlender } from "../tools/riskBlender.js";
import { fred10YMoM, fred2s10, fredCpiYoY, fredUnrate, blsMetroUnemp, inferMetroSeriesIdFromText } from "../infra/market.js";

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

export function startCometWorker() {
  console.log("[comet-worker] Starting worker...");

  cometQueue.onJob(async (job) => {
    const startTime = Date.now();
    console.log(`[comet-worker] Processing job for watchlist: ${job.watchId}`);

    try {
      // Load watchlist config
      const watchlistsPath = path.join(process.cwd(), "watchlists.json");
      const watchlists = JSON.parse(fs.readFileSync(watchlistsPath, "utf-8")) as Watchlist[];
      const watchlist = watchlists.find(w => w.id === job.watchId);

      if (!watchlist) {
        console.error(`[comet-worker] Watchlist not found: ${job.watchId}`);
        return;
      }

      console.log(`[comet-worker] Running: ${watchlist.label}`);

      // 1) Build search query with domain filters
      const domains = watchlist.domains || ["crexi.com", "loopnet.com", "brevitas.com"];
      const domainFilter = domains.map(d => ` site:${d}`).join(" OR ");
      const fullQuery = `${watchlist.query} (${domainFilter}) "for sale" -filetype:pdf -site:images.loopnet.com`;

      console.log(`[comet-worker] Search query: ${fullQuery}`);

      // 2) Search
      const searchResult = await webSearch.invoke(JSON.stringify({
        query: fullQuery,
        maxResults: 20,
        preferCrexi: false,
        timeoutMs: 15000
      }));

      const rows = JSON.parse(String(searchResult));
      console.log(`[comet-worker] Found ${rows.length} search results`);

      if (rows.length === 0) {
        console.log(`[comet-worker] No results for ${watchlist.id}, skipping`);
        return;
      }

      // 3) Score with PE model
      const scoredResult = await peScorePro.invoke(JSON.stringify({
        rows,
        query: watchlist.query
      }));

      const scored = JSON.parse(String(scoredResult));
      console.log(`[comet-worker] Scored ${scored.length} results`);

      // 4) Get macro data for risk scoring
      const fredKey = process.env.FRED_API_KEY;
      const blsKey = process.env.BLS_API_KEY;

      const tenYData = await fred10YMoM(fredKey);
      const curve2s10 = await fred2s10(fredKey);
      const cpiYoY = await fredCpiYoY(fredKey);
      const nationalUnemp = await fredUnrate(fredKey);

      const metroSeries = inferMetroSeriesIdFromText(watchlist.query);
      const bls = metroSeries ? await blsMetroUnemp(metroSeries, blsKey) : { latestRate: null, yoyDelta: null, period: null };

      // 5) Calculate risk score
      const riskResult = await riskBlender.invoke(JSON.stringify({
        query: watchlist.query,
        data: {
          treasury10yBps: tenYData.value != null ? Math.round(tenYData.value * 10000) : null,
          treasury10yDeltaBps: tenYData.deltaBps,
          curve2s10,
          cpiYoY,
          bls,
          nationalUnemp
        }
      }));

      const risk = JSON.parse(String(riskResult));
      console.log(`[comet-worker] Risk Score: ${risk.riskScore}/100`);

      // 6) Filter by thresholds
      const minScore = watchlist.minScore ?? 70;
      const riskMax = watchlist.riskMax ?? 70;

      const filtered = scored.filter((r: any) => 
        r.peScore >= minScore && risk.riskScore <= riskMax
      );

      console.log(`[comet-worker] ${filtered.length} items pass thresholds (PE ≥ ${minScore}, Risk ≤ ${riskMax})`);

      // 7) Build snapshot items
      const items: SnapshotItem[] = filtered.map((r: any) => ({
        url: r.url,
        score: r.peScore,
        risk: risk.riskScore,
        title: r.title,
        address: r.snippet?.substring(0, 100),
        price: undefined, // Would extract from detail page
        capRate: undefined
      }));

      // 8) Load previous snapshot and diff
      const prevSnapshot = await loadSnapshot(watchlist.id);
      const { newItems, changedItems } = diffListings(prevSnapshot, items);

      // 9) Save current snapshot
      await saveSnapshot(watchlist.id, items);

      // 10) Notify if there are changes
      const totalChanges = newItems.length + changedItems.length;

      if (totalChanges > 0) {
        console.log(`[comet-worker] 🔔 ALERT: ${watchlist.label}`);
        console.log(`[comet-worker] 📊 Summary: ${newItems.length} new, ${changedItems.length} changed`);
        console.log(`[comet-worker] ─────────────────────────────────────────────────────`);

        // Log details of new items
        if (newItems.length > 0) {
          console.log(`[comet-worker] 🆕 NEW LISTINGS:`);
          newItems.slice(0, 5).forEach((item, idx) => {
            console.log(`[comet-worker]   ${idx + 1}. ${item.title || 'Property Listing'}`);
            console.log(`[comet-worker]      PE: ${item.score} | Risk: ${item.risk}`);
            console.log(`[comet-worker]      ${item.url}`);
          });
          if (newItems.length > 5) {
            console.log(`[comet-worker]   ... and ${newItems.length - 5} more`);
          }
        }

        // Log details of changed items
        if (changedItems.length > 0) {
          console.log(`[comet-worker] 📝 CHANGED LISTINGS:`);
          changedItems.slice(0, 3).forEach((item, idx) => {
            console.log(`[comet-worker]   ${idx + 1}. ${item.title || 'Property Listing'}`);
            console.log(`[comet-worker]      PE: ${item.score} | Risk: ${item.risk}`);
            console.log(`[comet-worker]      ${item.url}`);
          });
          if (changedItems.length > 3) {
            console.log(`[comet-worker]   ... and ${changedItems.length - 3} more`);
          }
        }

        console.log(`[comet-worker] ─────────────────────────────────────────────────────`);

        // Optional: Send to Slack if configured
        const slackWebhook = process.env.SLACK_WEBHOOK_URL;
        if (slackWebhook) {
          const allChanges = [...newItems, ...changedItems];
          const alert = formatCometAlert(watchlist.label, newItems.length, changedItems.length, allChanges);
          await postSlack(slackWebhook, alert);
          console.log(`[comet-worker] ✅ Slack notification sent`);
        }

        // Emit SSE event for UI updates
        emitUI("comet-alert", {
          watchId: watchlist.id,
          watchLabel: watchlist.label,
          newCount: newItems.length,
          changedCount: changedItems.length,
          items: [...newItems, ...changedItems].slice(0, 5), // Top 5
          timestamp: Date.now()
        });
      } else {
        console.log(`[comet-worker] ✅ No changes detected for ${watchlist.id}`);
      }

      const duration = Date.now() - startTime;
      console.log(`[comet-worker] ✅ Completed ${watchlist.id} in ${duration}ms`);

    } catch (err) {
      console.error(`[comet-worker] Error processing ${job.watchId}:`, err);
    }
  });

  console.log("[comet-worker] ✅ Worker ready");
}
