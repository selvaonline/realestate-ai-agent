// src/routes/uiEvents.ts
// Server-Sent Events for UI drill-in actions triggered by chat

import express, { Response } from "express";

export const uiEventsRouter = express.Router();

// Active SSE connections
const SUBSCRIBERS = new Set<Response>();

/**
 * SSE endpoint for UI events
 * Client listens to this stream for chat-triggered UI actions
 */
uiEventsRouter.get("/ui/events", (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*", // Configure based on CORS_ORIGINS in production
    "X-Accel-Buffering": "no" // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

  // Add to subscribers
  SUBSCRIBERS.add(res);
  console.log(`[ui-events] Client connected. Active connections: ${SUBSCRIBERS.size}`);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat ${Date.now()}\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
      SUBSCRIBERS.delete(res);
    }
  }, 30000); // Every 30 seconds

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    SUBSCRIBERS.delete(res);
    console.log(`[ui-events] Client disconnected. Active connections: ${SUBSCRIBERS.size}`);
  });
});

/**
 * Emit a UI event to all connected clients
 * @param event Event name (e.g., "open-card", "render-charts")
 * @param payload Event data
 */
export function emitUI(event: string, payload: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  
  console.log(`[ui-events] Emitting ${event} to ${SUBSCRIBERS.size} clients:`, payload);
  
  for (const subscriber of SUBSCRIBERS) {
    try {
      subscriber.write(message);
    } catch (error) {
      // Remove dead connections
      SUBSCRIBERS.delete(subscriber);
      console.error(`[ui-events] Failed to send to subscriber:`, error);
    }
  }
}

/**
 * Get number of active subscribers
 */
export function getSubscriberCount(): number {
  return SUBSCRIBERS.size;
}

/**
 * Close all connections (for graceful shutdown)
 */
export function closeAllConnections() {
  for (const subscriber of SUBSCRIBERS) {
    try {
      subscriber.end();
    } catch (error) {
      // Ignore errors during shutdown
    }
  }
  SUBSCRIBERS.clear();
}

// Test endpoint to manually trigger a Comet alert
uiEventsRouter.post("/ui/test-alert", (req, res) => {
  const testAlert = {
    watchId: "test",
    watchLabel: "Test Watchlist",
    newCount: 2,
    changedCount: 1,
    items: [
      {
        url: "https://www.crexi.com/properties/test-1",
        title: "Test Property 1",
        score: 75,
        risk: 55
      },
      {
        url: "https://www.loopnet.com/test-2",
        title: "Test Property 2",
        score: 72,
        risk: 58
      }
    ],
    timestamp: Date.now()
  };
  
  emitUI("comet-alert", testAlert);
  res.json({ success: true, message: "Test alert sent", subscribers: SUBSCRIBERS.size });
});
