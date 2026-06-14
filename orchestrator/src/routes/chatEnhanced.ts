// src/routes/chatEnhanced.ts
// Enhanced chat route with agentic multi-hop reasoning, memory, and UI actions

import express from "express";
import crypto from "crypto";
import { agentLoop } from "../agentLoop.js";
import {
  getSession,
  appendToSession,
  updateSessionContext,
  getSessionData,
  updateSessionCriteria,
} from "../chat/sessionStore.js";
import { uiActionTools } from "../chat/tools.js";
import { emitUI } from "./uiEvents.js";
import { getLLM, hasLLM } from "../llm.js";
import { validate, chatEnhancedSchema } from "../middleware/validate.js";
import { extractCriteriaFromMessage, mergeCriteria } from "../chat/criteriaExtractor.js";
import type { AgentStep } from "../lib/agentTypes.js";

export const chatEnhancedRouter = express.Router();

// ── UI Action Dispatcher ────────────────────────────────────────────────────

/**
 * Quick LLM pass to detect and dispatch UI actions from the user's message.
 * Only called when the message contains UI-related keywords.
 */
async function dispatchUIActions(
  userMessage: string,
  agentAnalysis: string,
  context: any
): Promise<any[]> {
  try {
    const { client: llm, model } = getLLM();

    const contextSummary = context?.scored
      ? `${context.scored.length} deals in current results`
      : "No current results";

    const completion = await llm.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You dispatch UI actions based on explicit user requests. Only call a tool if the user clearly asks for a UI action (open, show, scroll, compare, filter, chart, export, memo). If the user is just asking a question, do NOT call any tools.

Current context: ${contextSummary}`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      tools: uiActionTools,
      tool_choice: "auto",
      temperature: 0,
      max_tokens: 200,
    });

    const msg = completion.choices[0]?.message;
    if (!msg?.tool_calls?.length) return [];

    const actions: any[] = [];
    for (const tc of msg.tool_calls) {
      const fnName = tc.function.name;
      const args = JSON.parse(tc.function.arguments || "{}");

      console.log(`[chat-enhanced] UI action: ${fnName}`, args);

      switch (fnName) {
        case "ui_open_card":
          emitUI("open-card", { id: args.id, url: args.url });
          actions.push({ type: "open-card", ...args });
          break;
        case "ui_render_charts":
          emitUI("render-charts", { scope: args.scope, id: args.id });
          actions.push({ type: "render-charts", ...args });
          break;
        case "ui_export_memo":
          emitUI("export-memo", { id: args.id, url: args.url, format: args.format || "txt" });
          actions.push({ type: "export-memo", ...args });
          break;
        case "ui_scroll_to_deal":
          emitUI("scroll-to-deal", { id: args.id });
          actions.push({ type: "scroll-to-deal", ...args });
          break;
        case "ui_filter_deals":
          emitUI("filter-deals", args);
          actions.push({ type: "filter-deals", ...args });
          break;
        case "ui_compare_deals":
          emitUI("compare-deals", { ids: args.ids });
          actions.push({ type: "compare-deals", ...args });
          break;
      }
    }
    return actions;
  } catch (e: any) {
    console.error("[chat-enhanced] UI action dispatch error:", e.message);
    return [];
  }
}

// ── POST /chat/enhanced ─────────────────────────────────────────────────────

chatEnhancedRouter.post("/chat/enhanced", validate(chatEnhancedSchema), async (req, res) => {
  try {
    const {
      sessionId = crypto.randomBytes(8).toString("hex"),
      user,
      context,
      orgSettings,
    } = req.body as {
      sessionId?: string;
      user: string;
      context?: any;
      orgSettings?: any;
    };

    if (!hasLLM()) {
      return res.status(500).json({
        error: "No LLM API key configured",
        message: "Please add one of OPENAI_API_KEY, GEMINI_API_KEY, XAI_API_KEY, or GROQ_API_KEY to your .env file",
      });
    }

    // Get session and update context if provided
    const session = getSession(sessionId);
    if (context) {
      updateSessionContext(sessionId, context);
    }

    const sessionData = getSessionData(sessionId);
    console.log(`[chat-enhanced] Session ${sessionId}: ${session.history.length} messages, criteria: ${Object.keys(sessionData.criteria).length > 0 ? "yes" : "no"}`);

    // ── Run the agentic loop ──────────────────────────────────────────────
    const agentResult = await agentLoop(user, {
      sessionId,
      session: sessionData,
      orgSettings,
      maxHops: 5,
    });

    const assistantContent = agentResult.analysis || "I wasn't able to generate a response. Please try rephrasing your question.";
    const toolsUsed = agentResult.steps
      .filter((s: AgentStep) => s.type === "tool_call" && s.toolName)
      .map((s: AgentStep) => s.toolName!);

    // ── UI action dispatch (if user requests UI interaction) ─────────────
    let uiActions: any[] = [];
    const hasUISignal = /open|show\s+(me\s+)?deal|scroll|chart|visual|compare|filter|export|memo|deal\s*#/i.test(user);
    if (hasUISignal) {
      uiActions = await dispatchUIActions(user, assistantContent, session.context);
    }

    // ── Extract investment criteria (fire-and-forget) ────────────────────
    extractCriteriaFromMessage(user, sessionData.criteria)
      .then((update) => {
        if (update) {
          const merged = mergeCriteria(sessionData.criteria, update);
          updateSessionCriteria(sessionId, merged);
          console.log(`[chat-enhanced] Criteria updated for session ${sessionId}`);
        }
      })
      .catch(() => {});

    // ── Persist to session history ───────────────────────────────────────
    appendToSession(sessionId, { role: "user", content: user });
    appendToSession(sessionId, { role: "assistant", content: assistantContent });

    // Update context with any deals found by the agent
    if (agentResult.deals.length > 0) {
      updateSessionContext(sessionId, {
        scored: agentResult.deals,
        lastSearch: {
          query: user,
          results: agentResult.deals.slice(0, 5),
          timestamp: Date.now(),
        },
      });
    }

    return res.json({
      sessionId,
      role: "assistant",
      content: assistantContent,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      uiActions: uiActions.length > 0 ? uiActions : undefined,
      steps: agentResult.steps,
      hops: agentResult.hops,
      historyLength: session.history.length + 2,
    });
  } catch (error: any) {
    console.error("[/chat/enhanced] error:", error.message);
    res.status(500).json({
      error: error.message || "Chat request failed",
      details: error.response?.data || null,
    });
  }
});

// ── DELETE /chat/session/:sessionId ─────────────────────────────────────────

chatEnhancedRouter.delete("/chat/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const { clearSessionHistory } = await import("../chat/sessionStore.js");
  clearSessionHistory(sessionId);
  res.json({ ok: true, message: "Session history cleared" });
});
