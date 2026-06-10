// src/routes/savedProperties.ts
// API for managing user-saved properties — partitioned by visitor IP (no auth needed)

import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const savedPropertiesRouter = express.Router();

const SAVED_DIR = path.join(process.cwd(), ".saved-properties");
const GLOBAL_WATCHLISTS = path.join(process.cwd(), "watchlists.json");

// Ensure base directory exists
if (!fs.existsSync(SAVED_DIR)) {
  fs.mkdirSync(SAVED_DIR, { recursive: true });
}

// ── Visitor identification (IP-based, hashed for privacy) ──

function visitorId(req: express.Request): string {
  const ip = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

function visitorDir(req: express.Request): string {
  const vid = visitorId(req);
  const dir = path.join(SAVED_DIR, vid);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function visitorWatchlistsPath(req: express.Request): string {
  const wPath = path.join(visitorDir(req), "watchlists.json");
  // Seed from global watchlists on first visit
  if (!fs.existsSync(wPath) && fs.existsSync(GLOBAL_WATCHLISTS)) {
    try {
      fs.copyFileSync(GLOBAL_WATCHLISTS, wPath);
    } catch { /* ignore seed failures */ }
  }
  return wPath;
}

type SavedProperty = {
  id: string;
  url: string;
  title: string;
  score: number;
  risk: number;
  watchlistId: string;
  addedAt: number;
  lastChecked?: number;
  priceHistory?: Array<{ price: string; timestamp: number }>;
  notes?: string;
};

// GET /api/saved-properties - Get all saved properties for this visitor
savedPropertiesRouter.get("/", (req, res) => {
  try {
    const { watchlistId } = req.query;
    const dir = visitorDir(req);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "watchlists.json");

    let allProperties: SavedProperty[] = [];

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const properties = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SavedProperty[];
        allProperties = allProperties.concat(properties);
      } catch { /* skip malformed files */ }
    }

    if (watchlistId) {
      allProperties = allProperties.filter(p => p.watchlistId === watchlistId);
    }

    res.json(allProperties);
  } catch (err) {
    console.error("[saved-properties] Error loading:", err);
    res.status(500).json({ error: "Failed to load saved properties" });
  }
});

// POST /api/saved-properties - Save a property
savedPropertiesRouter.post("/", (req, res) => {
  try {
    const { url, title, score, risk, watchlistId, notes } = req.body;

    if (!url || !title || !watchlistId) {
      return res.status(400).json({ error: "url, title, and watchlistId are required" });
    }

    const dir = visitorDir(req);
    const filePath = path.join(dir, `${watchlistId}.json`);
    let properties: SavedProperty[] = [];

    if (fs.existsSync(filePath)) {
      properties = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }

    if (properties.some(p => p.url === url)) {
      return res.status(409).json({ error: "Property already saved to this watchlist" });
    }

    const newProperty: SavedProperty = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      title,
      score: score || 0,
      risk: risk || 0,
      watchlistId,
      addedAt: Date.now(),
      notes,
    };

    properties.push(newProperty);
    fs.writeFileSync(filePath, JSON.stringify(properties, null, 2));

    console.log(`[saved-properties] [${visitorId(req)}] Saved to ${watchlistId}: ${title}`);
    res.json(newProperty);
  } catch (err) {
    console.error("[saved-properties] Error saving:", err);
    res.status(500).json({ error: "Failed to save property" });
  }
});

// DELETE /api/saved-properties/:id - Remove a saved property
savedPropertiesRouter.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const dir = visitorDir(req);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "watchlists.json");

    let found = false;

    for (const file of files) {
      const filePath = path.join(dir, file);
      let properties: SavedProperty[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const originalLength = properties.length;

      properties = properties.filter(p => p.id !== id);

      if (properties.length < originalLength) {
        fs.writeFileSync(filePath, JSON.stringify(properties, null, 2));
        found = true;
        console.log(`[saved-properties] [${visitorId(req)}] Removed property ${id}`);
        break;
      }
    }

    if (found) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Property not found" });
    }
  } catch (err) {
    console.error("[saved-properties] Error deleting:", err);
    res.status(500).json({ error: "Failed to delete property" });
  }
});

// GET /api/saved-properties/watchlists - Get visitor's watchlists
savedPropertiesRouter.get("/watchlists", (req, res) => {
  try {
    const wPath = visitorWatchlistsPath(req);
    if (!fs.existsSync(wPath)) {
      return res.json([]);
    }

    const watchlists = JSON.parse(fs.readFileSync(wPath, "utf-8"));
    res.json(watchlists);
  } catch (err) {
    console.error("[saved-properties] Error loading watchlists:", err);
    res.status(500).json({ error: "Failed to load watchlists" });
  }
});

// POST /api/saved-properties/watchlists - Create a new watchlist
savedPropertiesRouter.post("/watchlists", (req, res) => {
  try {
    const { id, label, query } = req.body;

    if (!id || !label || !query) {
      return res.status(400).json({ error: "id, label, and query are required" });
    }

    // ── Save to visitor-specific watchlists ──
    const wPath = visitorWatchlistsPath(req);
    let watchlists: any[] = [];

    if (fs.existsSync(wPath)) {
      watchlists = JSON.parse(fs.readFileSync(wPath, "utf-8"));
    }

    if (watchlists.some((w: any) => w.id === id)) {
      return res.status(409).json({ error: "Watchlist with this ID already exists" });
    }

    const newWatchlist = {
      id,
      label,
      query,
      domains: ["crexi.com", "loopnet.com", "brevitas.com"],
      minScore: 40,
      riskMax: 70,
      schedule: "0 */12 * * *", // every 12 hours
      enabled: true,
    };

    watchlists.push(newWatchlist);
    fs.writeFileSync(wPath, JSON.stringify(watchlists, null, 2));

    // ── Also register globally for Comet monitoring ──
    try {
      let globalWatchlists: any[] = [];
      if (fs.existsSync(GLOBAL_WATCHLISTS)) {
        globalWatchlists = JSON.parse(fs.readFileSync(GLOBAL_WATCHLISTS, "utf-8"));
      }
      if (!globalWatchlists.some((w: any) => w.id === id)) {
        globalWatchlists.push(newWatchlist);
        fs.writeFileSync(GLOBAL_WATCHLISTS, JSON.stringify(globalWatchlists, null, 2));
        console.log(`[saved-properties] Registered watchlist "${label}" globally for Comet monitoring`);
      }
    } catch (err) {
      console.error("[saved-properties] Failed to register globally:", err);
    }

    console.log(`[saved-properties] [${visitorId(req)}] Created watchlist: ${label} (${id})`);
    res.json(newWatchlist);
  } catch (err) {
    console.error("[saved-properties] Error creating watchlist:", err);
    res.status(500).json({ error: "Failed to create watchlist" });
  }
});
