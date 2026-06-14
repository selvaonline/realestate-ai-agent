// src/routes/neurosan.ts — Proxy to the Neuro SAN multi-agent orchestration layer.
//
// The Angular UI keeps its existing /events/:runId SSE plumbing; this route
// translates neuro-san's streaming_chat messages into the same event
// vocabulary (thinking / tool_executing / agent_step / answer_chunk / ...)
// plus one new kind, `ns_hop`, that drives the live agent-network panel.
import { Router } from "express";
import crypto from "crypto";
import { pub } from "../lib/event-bus.js";
import { mdToHtml } from "../lib/mdToHtml.js";
import { buildSpecialistAppendix } from "../lib/specialistAppendix.js";

export const neurosanRouter = Router();

const NS_URL = (process.env.NEURO_SAN_URL || "http://localhost:8080").replace(/\/$/, "");
const NS_AGENT = process.env.NEURO_SAN_AGENT || "dealsense";

type NsNetwork = {
  nodes: Array<{ id: string; type: "front_man" | "specialist" | "tool"; parent?: string }>;
  edges: Array<{ from: string; to: string }>;
};

let networkCache: NsNetwork | null = null;

async function fetchNetwork(): Promise<NsNetwork> {
  if (networkCache) return networkCache;
  const r = await fetch(`${NS_URL}/api/v1/${NS_AGENT}/connectivity`);
  if (!r.ok) throw new Error(`neuro-san connectivity ${r.status}`);
  const body = (await r.json()) as {
    connectivity_info: Array<{ origin: string; tools: string[]; display_as: string }>;
  };
  const info = body.connectivity_info || [];
  const called = new Set(info.flatMap((n) => n.tools));
  const byName = new Map(info.map((n) => [n.origin, n]));

  const nodes: NsNetwork["nodes"] = [];
  const edges: NsNetwork["edges"] = [];
  for (const n of info) {
    const type =
      n.display_as === "coded_tool" ? "tool"
      : called.has(n.origin) ? "specialist"
      : "front_man";
    const parent = info.find((p) => p.tools.includes(n.origin))?.origin;
    nodes.push({ id: n.origin, type, ...(parent ? { parent } : {}) });
    for (const t of n.tools) edges.push({ from: n.origin, to: t });
  }
  // Tools referenced but without their own connectivity entry
  for (const t of called) {
    if (!byName.has(t)) {
      const parent = info.find((p) => p.tools.includes(t))?.origin;
      nodes.push({ id: t, type: "tool", ...(parent ? { parent } : {}) });
    }
  }
  networkCache = { nodes, edges };
  return networkCache;
}

/** GET /api/ns/network — agent graph topology for the UI panel */
neurosanRouter.get("/api/ns/network", async (_req, res) => {
  try {
    res.json(await fetchNetwork());
  } catch (e: any) {
    res.status(502).json({ error: `neuro-san unreachable at ${NS_URL}: ${e?.message || e}` });
  }
});

/** GET /api/ns/health — is the neuro-san server up and serving our agent? */
neurosanRouter.get("/api/ns/health", async (_req, res) => {
  try {
    const r = await fetch(`${NS_URL}/api/v1/${NS_AGENT}/function`);
    res.json({ ok: r.ok });
  } catch {
    res.json({ ok: false });
  }
});


const pretty = (id: string) =>
  id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * POST /api/ns/run — start a neuro-san run. Returns { runId } immediately;
 * progress streams over the existing /events/:runId SSE channel.
 */
neurosanRouter.post("/api/ns/run", async (req, res) => {
  const { query } = req.body as { query?: string };
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query required" });
  }

  let network: NsNetwork;
  try {
    network = await fetchNetwork();
  } catch (e: any) {
    return res.status(502).json({ error: `neuro-san unreachable: ${e?.message || e}` });
  }

  const runId = crypto.randomBytes(8).toString("hex");
  res.json({ runId });
  console.log(`[ns/run] ${runId} query: ${query}`);

  const edgeSet = new Set(network.edges.map((e) => `${e.from}->${e.to}`));
  const nodeType = new Map(network.nodes.map((n) => [n.id, n.type]));

  (async () => {
    const emit = (kind: string, payload: Record<string, any> = {}) =>
      pub(runId, { kind, runId, t: Date.now(), ...payload });

    // Give the client a beat to open /events/:runId before we publish
    await new Promise((r) => setTimeout(r, 300));

    emit("run_started", { query });
    emit("thinking", { text: "Neuro SAN supervisor (deal_advisor) is planning the work..." });

    let finalText = "";
    let hops = 0;
    const lastToolBySpecialist = new Map<string, string>();
    const findings: Array<{ specialist: string; content: string }> = [];

    const handle = (msg: any) => {
      const type: string = msg.type || "";
      const text: string = msg.text || "";
      const origin: string[] = (msg.origin || []).map((o: any) =>
        typeof o === "string" ? o : o.tool
      );
      const caller = origin[origin.length - 1];

      if (type === "AGENT" && text.startsWith("Invoking:")) {
        const m = text.match(/`([^`]+)`/);
        const target = m?.[1];
        // The same invocation is reported at multiple chain depths; only act
        // on the one where the caller actually owns this edge in the graph.
        if (!target || !caller || !edgeSet.has(`${caller}->${target}`)) return;
        hops++;
        emit("ns_hop", { chain: [...origin, target], target, targetType: nodeType.get(target) });
        if (nodeType.get(target) === "specialist") {
          emit("thinking", { text: `🤝 ${pretty(caller)} → delegating to ${pretty(target)}` });
        } else {
          lastToolBySpecialist.set(caller, target);
          emit("tool_executing", { toolName: target, agent: caller });
        }
        emit("agent_step", {
          hop: hops, type: nodeType.get(target) === "specialist" ? "delegate" : "tool_call",
          content: `${pretty(caller)} → ${pretty(target)}`, toolName: target,
        });
        return;
      }

      if (type === "AGENT_TOOL_RESULT" && caller && nodeType.get(caller) === "specialist") {
        const toolName = lastToolBySpecialist.get(caller);
        if (toolName) {
          emit("tool_complete", { toolName, agent: caller });
          emit("agent_step", {
            hop: hops, type: "tool_result", toolName,
            toolResult: text.slice(0, 400),
          });
        }
        return;
      }

      // A specialist's final synthesis back to the supervisor
      if (type === "AI" && origin.length === 2 && text) {
        findings.push({ specialist: caller, content: text });
        emit("thinking", { text: `✓ ${pretty(caller)}: ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}` });
        emit("agent_step", { hop: hops, type: "finding", toolName: caller, content: text });
        emit("ns_hop", { chain: origin.slice(0, 1), target: origin[0], targetType: "front_man" });
        return;
      }

      if (type === "AGENT_FRAMEWORK" && text) finalText = text;
    };

    try {
      const resp = await fetch(`${NS_URL}/api/v1/${NS_AGENT}/streaming_chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: { text: query },
          chat_filter: { chat_filter_type: "MAXIMAL" },
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`streaming_chat HTTP ${resp.status}`);

      let buf = "";
      for await (const chunk of resp.body as any) {
        buf += Buffer.from(chunk).toString("utf8");
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try { handle(JSON.parse(line).response || {}); } catch { /* partial line */ }
        }
      }
      if (buf.trim()) {
        try { handle(JSON.parse(buf.trim()).response || {}); } catch { /* ignore */ }
      }

      if (finalText) {
        emit("answer_chunk", { text: mdToHtml(finalText) + buildSpecialistAppendix(findings) });
        emit("answer_complete", {});
      }
      emit("agent_done", { hops });
      emit("run_finished", { ok: true });
    } catch (e: any) {
      console.error("[ns/run] error:", e?.message || e);
      emit("thinking", { text: `Neuro SAN error: ${e?.message || e}` });
      emit("run_finished", { ok: false });
    }
  })();
});
