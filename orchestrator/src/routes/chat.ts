// src/routes/chat.ts
import express from "express";
import OpenAI from "openai";
import { webSearch } from "../tools/search.js";
import { peScorePro } from "../tools/peScorePro.js";
import { riskBlender } from "../tools/riskBlender.js";
import { fred10Y, blsMetroUnemp, inferMetroSeriesIdFromText } from "../infra/market.js";
import { generateIcMemo } from "../utils/memoGenerator.js";

export const chatRouter = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "" 
});

// System prompt for DealSense Chat
const SYSTEM_PROMPT = `You are DealSense Chat, an analyst assistant for commercial real estate.

Capabilities:
- When the user asks to "find" or "search", call web_search with a multi-domain query and then call pe_score_pro and risk_blender.
- When the user asks "why" a score or recommendation, use provided factors (peFactors, peSignals, riskNote).
- When the user asks for an IC memo, format with the standard template the app uses.
- Keep answers concise and institutional; never invent prices or cap rates—if missing, say "not stated".
- Use the current run's context if provided (portfolioData, scored rows); otherwise, perform a new search.

Output policy:
- Cite source titles/links when making claims about a specific property.
- If a site is blocked, say "site blocked; providing scored summary only".
- Always be precise with numbers and scores.
- Format responses in clear, professional markdown.`;

// Tool definitions for OpenAI function calling
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search CRE listings across CREXi, LoopNet, Brevitas, CommercialExchange, Biproxi. Returns scored and ranked results.",
      parameters: {
        type: "object",
        properties: {
          query: { 
            type: "string",
            description: "The search query for commercial real estate listings"
          },
          maxResults: { 
            type: "number",
            description: "Maximum number of results to return (default 20)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pe_score_pro",
      description: "Score SERP rows with DealSense PE model. Returns scored rows with PE factors.",
      parameters: {
        type: "object",
        properties: {
          rows: { 
            type: "array",
            description: "Array of search result rows to score",
            items: { type: "object" }
          },
          query: { 
            type: "string",
            description: "Original search query for context"
          }
        },
        required: ["rows"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "risk_blender",
      description: "Compute Market Risk Score + note from macro/labor inputs.",
      parameters: {
        type: "object",
        properties: {
          query: { 
            type: "string",
            description: "Search query for context"
          },
          data: {
            type: "object",
            description: "Market data including treasury rates and BLS unemployment data",
            properties: {
              treasury10yBps: { type: "number" },
              bls: { type: "object" }
            }
          }
        },
        required: ["data"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_ic_memo",
      description: "Create IC-ready memo for a specific scored row (by index or URL).",
      parameters: {
        type: "object",
        properties: {
          title: { 
            type: "string",
            description: "Property title"
          },
          url: { 
            type: "string",
            description: "Property listing URL"
          },
          pe: { 
            type: "object",
            description: "PE score data with factors"
          },
          risk: { 
            type: "object",
            description: "Risk score data"
          },
          snippet: {
            type: "string",
            description: "Property description snippet"
          }
        },
        required: ["title", "url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_context",
      description: "Analyze the current portfolio context (scored rows, portfolio data) to answer questions about deals, scores, and statistics.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to answer about the current context"
          }
        },
        required: ["question"]
      }
    }
  }
];

/**
 * POST /chat - Main chat endpoint with streaming support
 */
chatRouter.post("/chat", async (req, res) => {
  try {
    const { messages, context, stream = false } = req.body as { 
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
      context?: any;
      stream?: boolean;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    // Build system messages with context if provided
    const systemMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT }
    ];

    if (context?.scored) {
      systemMessages.push({
        role: "system",
        content: `Context: Current run has ${context.scored.length} scored rows. Portfolio data available: ${JSON.stringify(context.portfolioData || {})}. Use this context when answering questions about current deals.`
      });
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: "OPENAI_API_KEY not configured",
        message: "Please add OPENAI_API_KEY to your .env file"
      });
    }

    // Make initial request to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [...systemMessages, ...messages],
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      stream: false
    });

    const responseMessage = completion.choices[0].message;

    // Handle tool calls
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log(`[chat] Processing ${responseMessage.tool_calls.length} tool calls`);
      
      // Execute ALL tool calls
      const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || "{}");

        console.log(`[chat] Tool call: ${functionName}`, functionArgs);

        let toolResult: any;

        try {
          switch (functionName) {
            case "web_search": {
              // Execute search
              const searchResults = JSON.parse(
                await webSearch.invoke(JSON.stringify({ 
                  query: functionArgs.query, 
                  maxResults: functionArgs.maxResults || 20 
                }))
              );

              // Score with PE
              const scored = JSON.parse(
                await peScorePro.invoke(JSON.stringify({ 
                  rows: searchResults, 
                  query: functionArgs.query 
                }))
              );

              // Get macro data
              const tenY = await fred10Y(process.env.FRED_API_KEY);
              const metroSeries = inferMetroSeriesIdFromText(functionArgs.query);
              const bls = metroSeries 
                ? await blsMetroUnemp(metroSeries, process.env.BLS_API_KEY) 
                : { seriesId: null, latestRate: null, yoyDelta: null, period: null };

              // Calculate risk
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
                scored: scored.slice(0, 10), // Top 10 results
                risk,
                totalResults: scored.length,
                query: functionArgs.query
              };
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
              // Return context for analysis
              toolResult = {
                context: context || {},
                question: functionArgs.question
              };
              break;
            }

            default:
              toolResult = { error: `Unknown function: ${functionName}` };
          }
        } catch (error: any) {
          console.error(`[chat] Tool execution error:`, error);
          toolResult = { error: error.message || "Tool execution failed" };
        }

        // Add tool response message
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }

      // Send ALL tool results back to OpenAI for final response
      const finalCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          ...systemMessages,
          ...messages,
          responseMessage,
          ...toolMessages
        ],
        temperature: 0.2,
        stream: false
      });

      const finalMessage = finalCompletion.choices[0].message;
      
      return res.json({
        role: "assistant",
        content: finalMessage.content,
        toolUsed: responseMessage.tool_calls[0].function.name,
        toolResult: toolMessages.length > 0 ? JSON.parse(toolMessages[0].content as string) : null
      });
    }

    // No tool call - return direct response
    return res.json({
      role: "assistant",
      content: responseMessage.content
    });

  } catch (error: any) {
    console.error("[/chat] error:", error.message);
    res.status(500).json({ 
      error: error.message || "Chat request failed",
      details: error.response?.data || null
    });
  }
});

/**
 * POST /chat/stream - Streaming chat endpoint (for future enhancement)
 */
chatRouter.post("/chat/stream", async (req, res) => {
  res.status(501).json({ 
    error: "Streaming not yet implemented",
    message: "Use /chat endpoint for now"
  });
});
