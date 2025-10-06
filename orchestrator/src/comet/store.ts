// src/comet/store.ts
// File-based snapshot storage for MVP (upgrade to Postgres in Phase 2)

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.COMET_DATA_DIR || ".comet";

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[comet-store] Created data directory: ${DATA_DIR}`);
}

export type SnapshotItem = {
  url: string;
  score: number;
  risk: number;
  title?: string;
  address?: string;
  price?: string;
  capRate?: string;
  data?: any;
};

export type Snapshot = {
  items: SnapshotItem[];
  ts: number;
  watchId: string;
};

export async function loadSnapshot(watchId: string): Promise<Snapshot | null> {
  const filePath = path.join(DATA_DIR, `${watchId}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`[comet-store] No previous snapshot for ${watchId}`);
    return null;
  }

  try {
    const data = fs.readFileSync(filePath, "utf-8");
    const snapshot = JSON.parse(data) as Snapshot;
    console.log(`[comet-store] Loaded snapshot for ${watchId}: ${snapshot.items.length} items from ${new Date(snapshot.ts).toISOString()}`);
    return snapshot;
  } catch (err) {
    console.error(`[comet-store] Failed to load snapshot for ${watchId}:`, err);
    return null;
  }
}

export async function saveSnapshot(watchId: string, items: SnapshotItem[]): Promise<void> {
  const filePath = path.join(DATA_DIR, `${watchId}.json`);
  
  const snapshot: Snapshot = {
    watchId,
    items,
    ts: Date.now()
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
    console.log(`[comet-store] Saved snapshot for ${watchId}: ${items.length} items`);
  } catch (err) {
    console.error(`[comet-store] Failed to save snapshot for ${watchId}:`, err);
  }
}

export type DiffResult = {
  newItems: SnapshotItem[];
  changedItems: SnapshotItem[];
  removedUrls: string[];
};

export function diffListings(prev: Snapshot | null, nextItems: SnapshotItem[]): DiffResult {
  const newItems: SnapshotItem[] = [];
  const changedItems: SnapshotItem[] = [];
  const removedUrls: string[] = [];

  // Build map of previous items
  const prevMap = new Map<string, SnapshotItem>();
  if (prev) {
    for (const item of prev.items) {
      prevMap.set(item.url, item);
    }
  }

  // Check for new and changed items
  for (const nextItem of nextItems) {
    const prevItem = prevMap.get(nextItem.url);
    
    if (!prevItem) {
      // New item
      newItems.push(nextItem);
    } else {
      // Check if changed (score, risk, price, or cap rate)
      const scoreChanged = prevItem.score !== nextItem.score;
      const riskChanged = prevItem.risk !== nextItem.risk;
      const priceChanged = prevItem.price !== nextItem.price;
      const capChanged = prevItem.capRate !== nextItem.capRate;
      
      if (scoreChanged || riskChanged || priceChanged || capChanged) {
        changedItems.push(nextItem);
      }
      
      // Remove from map (to find removed items later)
      prevMap.delete(nextItem.url);
    }
  }

  // Remaining items in prevMap are removed
  const removedUrlsList = Array.from(prevMap.keys());
  removedUrls.push(...removedUrlsList);

  console.log(`[comet-store] Diff: ${newItems.length} new, ${changedItems.length} changed, ${removedUrls.length} removed`);

  return { newItems, changedItems, removedUrls };
}
