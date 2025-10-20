// src/routes/savedProperties.ts
// API for managing user-saved properties for Comet monitoring

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { unscheduleWatchlist, scheduleWatchlist, rescheduleAllWatchlists } from "../comet/scheduler.js";

export const savedPropertiesRouter = express.Router();

const SAVED_DIR = path.join(process.cwd(), ".saved-properties");

// Ensure directory exists
if (!fs.existsSync(SAVED_DIR)) {
  fs.mkdirSync(SAVED_DIR, { recursive: true });
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

// GET /api/saved-properties - Get all saved properties
savedPropertiesRouter.get("/", (req, res) => {
  try {
    const { watchlistId } = req.query;
    const files = fs.readdirSync(SAVED_DIR).filter(f => f.endsWith('.json'));
    
    let allProperties: SavedProperty[] = [];
    
    for (const file of files) {
      const filePath = path.join(SAVED_DIR, file);
      const properties = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SavedProperty[];
      allProperties = allProperties.concat(properties);
    }
    
    // Filter by watchlist if specified
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
    
    const filePath = path.join(SAVED_DIR, `${watchlistId}.json`);
    let properties: SavedProperty[] = [];
    
    if (fs.existsSync(filePath)) {
      properties = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    
    // Check if already saved
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
      notes
    };
    
    properties.push(newProperty);
    fs.writeFileSync(filePath, JSON.stringify(properties, null, 2));
    
    console.log(`[saved-properties] Saved to ${watchlistId}: ${title}`);
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
    const files = fs.readdirSync(SAVED_DIR).filter(f => f.endsWith('.json'));
    
    let found = false;
    
    for (const file of files) {
      const filePath = path.join(SAVED_DIR, file);
      let properties: SavedProperty[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const originalLength = properties.length;
      
      properties = properties.filter(p => p.id !== id);
      
      if (properties.length < originalLength) {
        fs.writeFileSync(filePath, JSON.stringify(properties, null, 2));
        found = true;
        console.log(`[saved-properties] Removed property ${id}`);
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

// GET /api/saved-properties/watchlists - Get available watchlists
savedPropertiesRouter.get("/watchlists", (req, res) => {
  try {
    const watchlistsPath = path.join(process.cwd(), "watchlists.json");
    if (!fs.existsSync(watchlistsPath)) {
      return res.json([]);
    }
    
    const watchlists = JSON.parse(fs.readFileSync(watchlistsPath, "utf-8"));
    res.json(watchlists);
  } catch (err) {
    console.error("[saved-properties] Error loading watchlists:", err);
    res.status(500).json({ error: "Failed to load watchlists" });
  }
});

// POST /api/saved-properties/watchlists - Create a new watchlist
savedPropertiesRouter.post("/watchlists", (req, res) => {
  try {
    const { id, label, query, schedule } = req.body;
    
    if (!id || !label || !query) {
      return res.status(400).json({ error: "id, label, and query are required" });
    }
    
    const watchlistsPath = path.join(process.cwd(), "watchlists.json");
    let watchlists: any[] = [];
    
    if (fs.existsSync(watchlistsPath)) {
      watchlists = JSON.parse(fs.readFileSync(watchlistsPath, "utf-8"));
    }
    
    // Check if ID already exists
    if (watchlists.some(w => w.id === id)) {
      return res.status(409).json({ error: "Watchlist with this ID already exists" });
    }
    
    const newWatchlist = {
      id,
      label,
      query,
      domains: ["crexi.com", "loopnet.com", "brevitas.com"],
      minScore: 40,
      riskMax: 70,
      schedule: schedule || "0 * * * *",
      enabled: true
    };
    
    watchlists.push(newWatchlist);
    fs.writeFileSync(watchlistsPath, JSON.stringify(watchlists, null, 2));
    
    // Schedule the new watchlist in the background agent
    scheduleWatchlist(newWatchlist);
    
    console.log(`[saved-properties] Created new watchlist: ${label} (${id})`);
    res.json(newWatchlist);
  } catch (err) {
    console.error("[saved-properties] Error creating watchlist:", err);
    res.status(500).json({ error: "Failed to create watchlist" });
  }
});

// PUT /api/saved-properties/watchlists/:id - Update a watchlist
savedPropertiesRouter.put("/watchlists/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { label, query, schedule, enabled } = req.body;
    
    const watchlistsPath = path.join(process.cwd(), "watchlists.json");
    
    if (!fs.existsSync(watchlistsPath)) {
      return res.status(404).json({ error: "Watchlists file not found" });
    }
    
    let watchlists: any[] = JSON.parse(fs.readFileSync(watchlistsPath, "utf-8"));
    const watchlistIndex = watchlists.findIndex(w => w.id === id);
    
    if (watchlistIndex === -1) {
      return res.status(404).json({ error: "Watchlist not found" });
    }
    
    // Update watchlist properties
    if (label !== undefined) watchlists[watchlistIndex].label = label;
    if (query !== undefined) watchlists[watchlistIndex].query = query;
    if (schedule !== undefined) watchlists[watchlistIndex].schedule = schedule;
    if (enabled !== undefined) watchlists[watchlistIndex].enabled = enabled;
    
    // Save updated watchlists
    fs.writeFileSync(watchlistsPath, JSON.stringify(watchlists, null, 2));
    
    // Reschedule the watchlist in the background agent
    scheduleWatchlist(watchlists[watchlistIndex]);
    
    console.log(`[saved-properties] Updated watchlist: ${id}`);
    res.json(watchlists[watchlistIndex]);
  } catch (err) {
    console.error("[saved-properties] Error updating watchlist:", err);
    res.status(500).json({ error: "Failed to update watchlist" });
  }
});

// DELETE /api/saved-properties/watchlists/:id - Delete a watchlist
savedPropertiesRouter.delete("/watchlists/:id", (req, res) => {
  try {
    const { id } = req.params;
    const watchlistsPath = path.join(process.cwd(), "watchlists.json");
    
    if (!fs.existsSync(watchlistsPath)) {
      return res.status(404).json({ error: "Watchlists file not found" });
    }
    
    let watchlists: any[] = JSON.parse(fs.readFileSync(watchlistsPath, "utf-8"));
    const originalLength = watchlists.length;
    
    // Filter out the watchlist with the given ID
    watchlists = watchlists.filter(w => w.id !== id);
    
    if (watchlists.length === originalLength) {
      return res.status(404).json({ error: "Watchlist not found" });
    }
    
    // Save updated watchlists
    fs.writeFileSync(watchlistsPath, JSON.stringify(watchlists, null, 2));
    
    // Unschedule the watchlist from the background agent
    unscheduleWatchlist(id);
    
    // Also delete the associated saved properties file if it exists
    const savedPropertiesFile = path.join(SAVED_DIR, `${id}.json`);
    if (fs.existsSync(savedPropertiesFile)) {
      fs.unlinkSync(savedPropertiesFile);
      console.log(`[saved-properties] Deleted associated properties file for ${id}`);
    }
    
    console.log(`[saved-properties] Deleted watchlist: ${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error("[saved-properties] Error deleting watchlist:", err);
    res.status(500).json({ error: "Failed to delete watchlist" });
  }
});
