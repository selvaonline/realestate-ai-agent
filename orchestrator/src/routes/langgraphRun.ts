// src/routes/langgraphRun.ts — LangGraph.js multi-agent orchestration endpoint.
import { Router } from "express";
import crypto from "crypto";
import { pub } from "../lib/event-bus.js";
import { mdToHtml } from "../lib/mdToHtml.js";
import { lgNetworkTopology } from "../langgraph/specialists.js";
import { runLangGraphSupervisor } from "../langgraph/supervisor.js";
import { buildSpecialistAppendix } from "../lib/specialistAppendix.js";

export const langgraphRouter = Router();

/** GET /api/lg/network — agent graph topology (static, defined in-process) */
langgraphRouter.get("/api/lg/network", (_req, res) => {
  res.json(lgNetworkTopology());
});

/** GET /api/lg/health — in-process, healthy if an LLM key is configured */
langgraphRouter.get("/api/lg/health", (_req, res) => {
  const ok = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
  // Macro data status — "degraded" means risk scoring falls back to a neutral 50.
  const fred = Boolean(process.env.FRED_API_KEY);
  const bls = Boolean(process.env.BLS_API_KEY);
  const macro = fred ? (bls ? "live" : "live-national") : "degraded";
  res.json({ ok, macro, fred, bls });
});

/**
 * POST /api/lg/run — start a LangGraph supervisor run. Returns { runId };
 * progress streams over the existing /events/:runId SSE channel.
 */
langgraphRouter.post("/api/lg/run", async (req, res) => {
  const { query, threadId: clientThreadId } = req.body as { query?: string; threadId?: string };
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query required" });
  }

  const runId = crypto.randomBytes(8).toString("hex");
  const threadId = (typeof clientThreadId === "string" && /^[\w-]{4,64}$/.test(clientThreadId))
    ? clientThreadId
    : runId;
  res.json({ runId, threadId });
  console.log(`[lg/run] ${runId} thread=${threadId} query: ${query}`);

  (async () => {
    const emit = (kind: string, payload: Record<string, any> = {}) =>
      pub(runId, { kind, runId, t: Date.now(), ...payload });

    // Give the client a beat to open /events/:runId before we publish
    await new Promise((r) => setTimeout(r, 300));

    emit("run_started", { query });
    emit("thinking", { text: "Multi-agent supervisor is planning the work..." });

    // Capture each specialist's full finding so the final answer always
    // carries the detail, regardless of how tersely the supervisor synthesizes.
    const findings: Array<{ specialist: string; content: string }> = [];
    const emitAndCapture: typeof emit = (kind, payload = {}) => {
      if (kind === "agent_step" && payload["type"] === "finding" && payload["content"]) {
        findings.push({ specialist: payload["toolName"], content: String(payload["content"]) });
      }
      emit(kind, payload);
    };

    try {
      const { answer, hops } = await runLangGraphSupervisor(query, runId, emitAndCapture, threadId);
      if (answer) {
        emit("answer_chunk", { text: mdToHtml(answer) + buildSpecialistAppendix(findings) });
        emit("answer_complete", {});
      }
      emit("agent_done", { hops });
      emit("run_finished", { ok: true });
    } catch (e: any) {
      console.error("[lg/run] error:", e?.message || e);
      emit("thinking", { text: `LangGraph error: ${e?.message || e}` });
      emit("run_finished", { ok: false });
    }
  })();
});
