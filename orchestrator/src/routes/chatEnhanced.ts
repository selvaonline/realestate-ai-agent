// src/routes/chatEnhanced.ts
// Enhanced chat route with multi-turn memory and UI drill-in actions

import express from "express";
import OpenAI from "openai";
import crypto from "crypto";
import { webSearch } from "../tools/search.js";
import { peScorePro } from "../tools/peScorePro.js";
import { riskBlender } from "../tools/riskBlender.js";
import { fred10Y, blsMetroUnemp, inferMetroSeriesIdFromText } from "../infra/market.js";
import { generateIcMemo } from "../utils/memoGenerator.js";
import { getSession, appendToSession, updateSessionContext } from "../chat/sessionStore.js";
import { getAllChatTools } from "../chat/tools.js";
import { emitUI } from "./uiEvents.js";

export const chatEnhancedRouter = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "" 
});

// Enhanced system prompt with memory and UI actions
const SYSTEM_PROMPT = `You are DealSense Chat, an analyst assistant for commercial real estate.

Capabilities:
- **Search & Analysis**: Call web_search to find properties, automatically scored with PE and risk analysis
- **Explainability**: Explain scores, factors, and recommendations using context data
- **IC Memos**: Generate professional investment committee memos
- **Portfolio Analytics**: Answer questions about current deals, statistics, and comparisons
- **Multi-turn Memory**: Reference previous searches and conversations to compare results
- **UI Actions**: Trigger UI interactions like opening cards, rendering charts, exporting memos

UI Action Tools:
- ui_open_card: Open a property detail card (by rank or URL)
- ui_render_charts: Show factor or portfolio charts
- ui_export_memo: Export IC memo for a deal
- ui_scroll_to_deal: Scroll to a specific deal
- ui_filter_deals: Apply filters to deal list
- ui_compare_deals: Open side-by-side comparison

Guidelines:
- Use memory to compare "current vs previous" search results when asked
- Be concise and institutional; never invent data
- Cite sources with [n] notation
- If data is missing, say "not stated" rather than guessing
- When user asks to "show me deal #2" or "open the top property", use ui_open_card
- When user asks to "visualize" or "show charts", use ui_render_charts
- Format responses in clear, professional markdown`;

/**
 * POST /chat/enhanced - Enhanced chat with memory and UI actions
 */
chatEnhancedRouter.post("/chat/enhanced", async (req, res) => {
  try {
    const { 
      sessionId = crypto.randomBytes(8).toString("hex"),
      user,
      context 
    } = req.body as { 
      sessionId?: string;
      user: string;
      context?: any;
    };

    if (!user || typeof user !== "string") {
      return res.status(400).json({ error: "user message required" });
    }

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: "OPENAI_API_KEY not configured",
        message: "Please add OPENAI_API_KEY to your .env file"
      });
    }

    // Get session with history
    const session = getSession(sessionId);

    // Update session context if provided
    if (context) {
      updateSessionContext(sessionId, context);
    }

    // Build messages: system + context + history + new user message
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT }
    ];

    // Add context as system message if available
    if (session.context && Object.keys(session.context).length > 0) {
      const contextStr = JSON.stringify(session.context).slice(0, 4000); // Limit context size
      messages.push({
        role: "system",
        content: `Current Context: ${contextStr}`
      });
    }

    // Add conversation history
    messages.push(...session.history.map(h => ({
      role: h.role,
      content: h.content
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]);

    // Add new user message
    messages.push({ role: "user", content: user });

    console.log(`[chat-enhanced] Session ${sessionId}: ${session.history.length} messages in history`);

    // Get all tools (search + UI actions)
    const tools = getAllChatTools(true);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      stream: false
    });

    const responseMessage = completion.choices[0].message;

    // Handle tool calls
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log(`[chat-enhanced] Processing ${responseMessage.tool_calls.length} tool calls`);
      
      const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      const uiActions: any[] = [];
      
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || "{}");

        console.log(`[chat-enhanced] Tool call: ${functionName}`, functionArgs);

        let toolResult: any;

        // Handle UI action tools
        if (functionName.startsWith("ui_")) {
          switch (functionName) {
            case "ui_open_card":
              emitUI("open-card", { id: functionArgs.id, url: functionArgs.url });
              toolResult = { ok: true, action: "opened card" };
              uiActions.push({ type: "open-card", ...functionArgs });
              break;

            case "ui_render_charts":
              emitUI("render-charts", { scope: functionArgs.scope, id: functionArgs.id });
              toolResult = { ok: true, action: "rendered charts" };
              uiActions.push({ type: "render-charts", ...functionArgs });
              break;

            case "ui_export_memo":
              emitUI("export-memo", { 
                id: functionArgs.id, 
                url: functionArgs.url, 
                format: functionArgs.format || "txt" 
              });
              toolResult = { ok: true, action: "exported memo" };
              uiActions.push({ type: "export-memo", ...functionArgs });
              break;

            case "ui_scroll_to_deal":
              emitUI("scroll-to-deal", { id: functionArgs.id });
              toolResult = { ok: true, action: "scrolled to deal" };
              uiActions.push({ type: "scroll-to-deal", ...functionArgs });
              break;

            case "ui_filter_deals":
              emitUI("filter-deals", functionArgs);
              toolResult = { ok: true, action: "applied filters" };
              uiActions.push({ type: "filter-deals", ...functionArgs });
              break;

            case "ui_compare_deals":
              emitUI("compare-deals", { ids: functionArgs.ids });
              toolResult = { ok: true, action: "opened comparison" };
              uiActions.push({ type: "compare-deals", ...functionArgs });
              break;

            default:
              toolResult = { error: `Unknown UI action: ${functionName}` };
          }
        }
        // Handle search/analysis tools
        else {
          try {
            switch (functionName) {
              case "web_search": {
                const searchResults = JSON.parse(
                  await webSearch.invoke(JSON.stringify({ 
                    query: functionArgs.query, 
                    maxResults: functionArgs.maxResults || 20 
                  }))
                );

                const scored = JSON.parse(
                  await peScorePro.invoke(JSON.stringify({ 
                    rows: searchResults, 
                    query: functionArgs.query 
                  }))
                );

                const tenY = await fred10Y(process.env.FRED_API_KEY);
                const metroSeries = inferMetroSeriesIdFromText(functionArgs.query);
                const bls = metroSeries 
                  ? await blsMetroUnemp(metroSeries, process.env.BLS_API_KEY) 
                  : { seriesId: null, latestRate: null, yoyDelta: null, period: null };

                const risk = JSON.parse(
                  await riskBlender.invoke(JSON.stringify({
                    query: functionArgs.query,
                    data: { 
                      treasury10yBps: tenY.value != null ? Math.round(tenY.value * 10000) : null, 
                      bls 
                    }
                  }))
                );

                toolResult = {
                  scored: scored.slice(0, 10),
                  risk,
                  totalResults: scored.length,
                  query: functionArgs.query
                };

                // Update session context with search results
                updateSessionContext(sessionId, {
                  lastSearch: {
                    query: functionArgs.query,
                    results: scored.slice(0, 5), // Store top 5
                    timestamp: Date.now()
                  }
                });
                break;
              }

              case "generate_ic_memo": {
                const memo = generateIcMemo({
                  title: functionArgs.title,
                  url: functionArgs.url,
                  pe: functionArgs.pe || {},
                  risk: functionArgs.risk || {},
                  snippet: functionArgs.snippet || ""
                });
                toolResult = { memo };
                break;
              }

              case "analyze_context": {
                toolResult = {
                  context: session.context || {},
                  question: functionArgs.question
                };
                break;
              }

              default:
                toolResult = { error: `Unknown function: ${functionName}` };
            }
          } catch (error: any) {
            console.error(`[chat-enhanced] Tool execution error:`, error);
            toolResult = { error: error.message || "Tool execution failed" };
          }
        }

        // Add tool response
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }

      // Get final response from OpenAI
      const finalCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          ...messages,
          responseMessage,
          ...toolMessages
        ],
        temperature: 0.2,
        stream: false
      });

      const finalMessage = finalCompletion.choices[0].message;
      const assistantContent = finalMessage.content || "Done.";

      // Save to session history
      appendToSession(sessionId, { role: "user", content: user });
      appendToSession(sessionId, { role: "assistant", content: assistantContent });

      return res.json({
        sessionId,
        role: "assistant",
        content: assistantContent,
        toolsUsed: responseMessage.tool_calls.map(tc => tc.function.name),
        uiActions: uiActions.length > 0 ? uiActions : undefined,
        historyLength: session.history.length + 2
      });
    }

    // No tool calls - direct response
    const assistantContent = responseMessage.content || "";
    
    appendToSession(sessionId, { role: "user", content: user });
    appendToSession(sessionId, { role: "assistant", content: assistantContent });

    return res.json({
      sessionId,
      role: "assistant",
      content: assistantContent,
      historyLength: session.history.length + 2
    });

  } catch (error: any) {
    console.error("[/chat/enhanced] error:", error.message);
    res.status(500).json({ 
      error: error.message || "Chat request failed",
      details: error.response?.data || null
    });
  }
});

/**
 * DELETE /chat/session/:sessionId - Clear session history
 */
chatEnhancedRouter.delete("/chat/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const { clearSessionHistory } = await import("../chat/sessionStore.js");
  clearSessionHistory(sessionId);
  res.json({ ok: true, message: "Session history cleared" });
});
