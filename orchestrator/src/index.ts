// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { runAgent } from "./agent.js";
import { chatRouter } from "./routes/chat.js";
import { chatEnhancedRouter } from "./routes/chatEnhanced.js";
import { uiEventsRouter } from "./routes/uiEvents.js";

// ───────────────────────────────────────────────────────────────────────────────
// In-process SSE bus + result cache
// ───────────────────────────────────────────────────────────────────────────────
type Subscriber = (ev: any) => void;

const channel = new Map<string, Set<Subscriber>>(); // runId -> subs
const results = new Map<string, any>();             // runId -> final JSON

function pub(runId: string, ev: any) {
  channel.get(runId)?.forEach((fn) => {
    try { fn(ev); } catch { /* ignore */ }
  });
}
function sub(runId: string, fn: Subscriber) {
  if (!channel.has(runId)) channel.set(runId, new Set<Subscriber>());
  channel.get(runId)!.add(fn);
  return () => channel.get(runId)!.delete(fn);
}

// ───────────────────────────────────────────────────────────────────────────────
// HTTP surface
// ───────────────────────────────────────────────────────────────────────────────
const app = express();

// Configurable CORS (comma-separated origins in CORS_ORIGINS, default "*")
const rawOrigins = process.env.CORS_ORIGINS || "*";
const allowedOrigins = rawOrigins.split(",").map((s) => s.trim()).filter(Boolean);

const corsOptions: any = {
  origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
    if (!origin) return cb(null, true); // same-origin or curl
    if (rawOrigins === "*" || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "4mb" }));

// Mount chat routes
app.use(chatRouter);
app.use(chatEnhancedRouter);
app.use(uiEventsRouter);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

/**
 * Start a run (async). Returns { runId } immediately; UI listens on /events/:runId
 */
app.post("/run", async (req, res) => {
  const { query } = req.body as { query?: string };
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query required" });
  }

  const runId = crypto.randomBytes(8).toString("hex");
  console.log(`[orchestrator] /run query: ${query}`);

  // Fire-and-forget worker; client consumes SSE
  (async () => {
    try {
      pub(runId, { kind: "run_started", runId, query, t: Date.now() });

      const out = await runAgent(query, {
        runId,
        pub: (kind: string, payload: Record<string, any> = {}) =>
          pub(runId, { kind, runId, t: Date.now(), ...payload }),
      });

      results.set(runId, out); // cache final result
      pub(runId, { kind: "run_finished", runId, ok: true, t: Date.now() });
    } catch (e: any) {
      console.error("[/run worker] error:", e?.stack || e?.message || e);
      pub(runId, { kind: "run_finished", runId, ok: false, t: Date.now() });
    }
  })();

  res.json({ runId });
});

/**
 * Server-Sent Events stream (live timeline)
 */
app.get("/events/:runId", (req, res) => {
  const { runId } = req.params;

  const reqOrigin = (req.headers.origin as string | undefined) || "";
  const allowOrigin = rawOrigins === "*" && reqOrigin ? reqOrigin
                    : (reqOrigin && allowedOrigins.includes(reqOrigin) ? reqOrigin : "*");

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  });

  // Heartbeat to keep intermediaries from closing the stream
  const heartbeat = setInterval(() => {
    res.write(`data:${JSON.stringify({ kind: "heartbeat", runId, t: Date.now() })}\n\n`);
  }, 15000);

  const send = (ev: any) => res.write(`data:${JSON.stringify(ev)}\n\n`);
  const unsub = sub(runId, send);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsub();
  });
});

/**
 * Retrieve the final result for a finished run
 */
app.get("/result/:runId", (req, res) => {
  const out = results.get(req.params.runId);
  if (!out) return res.status(404).json({ error: "result not found (run not finished?)" });
  res.json(out);
});

/**
 * Synchronous run (blocks until completion and returns JSON). Useful for CLI tests.
 */
app.post("/run_sync", async (req, res) => {
  try {
    const { query } = req.body as { query?: string };
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "query required" });
    }
    console.log(`[orchestrator] /run_sync query: ${query}`);

    const out = await runAgent(query, { runId: "sync", pub: () => {} });
    res.json(out);
  } catch (e: any) {
    console.error("[/run_sync] error:", e?.stack || e?.message || e);
    res.status(500).json({ error: e?.message || "agent error" });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[orchestrator] listening on :${port}`);
});
