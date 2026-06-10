// src/agentLoop.ts — Core agentic loop: LLM-driven multi-hop tool selection.
// Domain-agnostic: the system prompt and result summarizers come from the
// active domain pack (see src/platform/domainPack.ts and src/packs/).
import OpenAI from "openai";
import { getLLM } from "./llm.js";
import { toolRegistry, getOpenAITools } from "./platform/registry.js";
import { getActivePack } from "./platform/domainPack.js";
import type { AgentContext, AgentStep, AgentOutput } from "./lib/agentTypes.js";
import type { Deal } from "./lib/types.js";

// ── Summarize tool results for LLM context ───────────────────────────────────

function summarizeResult(result: any, toolName: string): string {
  if (!result) return "No result";
  if (result.error) return `Error: ${result.error}`;
  const packSummary = getActivePack().summarizeToolResult?.(toolName, result);
  return packSummary ?? JSON.stringify(result).slice(0, 200);
}

// ── Core Agentic Loop ────────────────────────────────────────────────────────

export async function agentLoop(
  goal: string,
  ctx: AgentContext = {}
): Promise<AgentOutput> {
  const { maxHops = 8 } = ctx;
  const pub = ctx.pub || (() => {});
  const emit = (kind: string, payload: Record<string, any> = {}) =>
    pub(kind, { ...payload, runId: ctx.runId, t: Date.now() });

  let llmProvider;
  try {
    llmProvider = getLLM();
  } catch (e: any) {
    console.error("[agentLoop] No LLM available:", e.message);
    emit("answer_chunk", { text: "No LLM API key configured. Please set OPENAI_API_KEY, GEMINI_API_KEY, XAI_API_KEY, or GROQ_API_KEY." });
    emit("answer_complete", {});
    return { plan: goal, deals: [], analysis: "No LLM configured", steps: [], hops: 0, toolResult: null };
  }

  const { client: llm, model } = llmProvider;
  const tools = getOpenAITools();

  console.log(`[agentLoop] Starting agentic loop for: "${goal.slice(0, 80)}..." (model: ${model}, maxHops: ${maxHops})`);

  // Build messages
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: getActivePack().systemPrompt },
  ];

  // If session context available, add it
  if (ctx.session) {
    const contextParts: string[] = [];
    if (ctx.session.criteria && Object.keys(ctx.session.criteria).length > 0) {
      contextParts.push(`User investment criteria: ${JSON.stringify(ctx.session.criteria)}`);
    }
    if (ctx.session.context?.scored?.length) {
      contextParts.push(`Previous search results available (${ctx.session.context.scored.length} deals in context)`);
    }
    if (ctx.session.portfolio?.length) {
      contextParts.push(`User portfolio: ${ctx.session.portfolio.length} saved properties`);
    }
    if (contextParts.length > 0) {
      messages.push({ role: "system", content: contextParts.join("\n") });
    }

    // Add last 8 turns of history
    const recentHistory = ctx.session.history.slice(-16);
    for (const msg of recentHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  messages.push({ role: "user", content: goal });

  const steps: AgentStep[] = [];
  const deals: Deal[] = ctx._dealAccumulator || [];
  let hops = 0;
  let finalAnswer = "";

  emit("thinking", { text: "Analyzing your request..." });

  while (hops < maxHops) {
    hops++;
    const hopStart = Date.now();

    console.log(`[agentLoop] === Hop ${hops}/${maxHops} ===`);

    let completion;
    try {
      completion = await llm.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.15,
      });
    } catch (e: any) {
      console.error(`[agentLoop] LLM call failed at hop ${hops}:`, e.message);
      emit("thinking", { text: "Encountered an issue with the AI model. Wrapping up with available data..." });
      break;
    }

    const msg = completion.choices[0]?.message;
    if (!msg) {
      console.error("[agentLoop] No message in completion response");
      break;
    }

    messages.push(msg as any);

    // No tool calls = final answer
    if (!msg.tool_calls?.length) {
      finalAnswer = msg.content || "";
      console.log(`[agentLoop] Final answer at hop ${hops} (${finalAnswer.length} chars)`);

      steps.push({
        hop: hops,
        type: "final_answer",
        content: finalAnswer.slice(0, 500),
        timestamp: Date.now(),
      });

      // Emit as answer_chunk for legacy UI compat
      emit("answer_chunk", { text: finalAnswer });
      break;
    }

    // Emit reasoning if content present alongside tool calls
    if (msg.content) {
      console.log(`[agentLoop] Thinking: ${msg.content.slice(0, 100)}...`);
      emit("thinking", { text: msg.content });
      emit("agent_step", {
        type: "thinking",
        content: msg.content,
        hop: hops,
        timestamp: Date.now(),
      });
      steps.push({
        hop: hops,
        type: "thinking",
        content: msg.content,
        timestamp: Date.now(),
      });
    }

    // Execute tool calls
    const browserTools = new Set(["analyze_property_url"]);

    const executeCall = async (
      toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
    ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam> => {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, any> = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        toolArgs = {};
      }

      const start = Date.now();

      emit("agent_step", { type: "tool_call", toolName, toolArgs, hop: hops, timestamp: start });
      emit("tool_executing", { toolName, hop: hops });
      emit("status", { label: `Running ${toolName}...` });

      console.log(`[agentLoop]   Tool: ${toolName}(${JSON.stringify(toolArgs).slice(0, 100)})`);

      steps.push({
        hop: hops,
        type: "tool_call",
        toolName,
        toolArgs,
        timestamp: start,
      });

      let result: any;
      try {
        const tool = toolRegistry.get(toolName);
        if (!tool) throw new Error(`Unknown tool: ${toolName}`);

        result = await tool.execute(toolArgs, { ...ctx, _dealAccumulator: deals });
      } catch (err: any) {
        console.error(`[agentLoop]   Tool ${toolName} error:`, err.message);
        result = { error: err.message };
      }

      const durationMs = Date.now() - start;
      const summary = summarizeResult(result, toolName);

      console.log(`[agentLoop]   ${toolName} completed in ${durationMs}ms: ${summary.slice(0, 100)}`);

      emit("tool_complete", { toolName, hop: hops, durationMs, resultSummary: summary });
      emit("agent_step", {
        type: "tool_result",
        toolName,
        toolResult: summary,
        hop: hops,
        durationMs,
        timestamp: Date.now(),
      });

      steps.push({
        hop: hops,
        type: "tool_result",
        toolName,
        toolResult: summary,
        durationMs,
        timestamp: Date.now(),
      });

      return {
        role: "tool" as const,
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      };
    };

    // Separate parallel vs sequential execution
    const parallelCalls = msg.tool_calls.filter(tc => !browserTools.has(tc.function.name));
    const serialCalls = msg.tool_calls.filter(tc => browserTools.has(tc.function.name));

    const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Non-browser tools: parallel
    if (parallelCalls.length > 0) {
      const parallelResults = await Promise.all(parallelCalls.map(executeCall));
      toolMessages.push(...parallelResults);
    }

    // Browser tools: sequential
    for (const call of serialCalls) {
      toolMessages.push(await executeCall(call));
    }

    messages.push(...toolMessages);

    console.log(`[agentLoop] Hop ${hops} completed in ${Date.now() - hopStart}ms (${msg.tool_calls.length} tools)`);
  }

  // If we hit maxHops without a final answer, force one
  if (!finalAnswer && hops >= maxHops) {
    console.log("[agentLoop] Max hops reached — forcing final synthesis");
    emit("thinking", { text: "Maximum reasoning depth reached. Synthesizing final answer..." });

    try {
      const finalCompletion = await llm.chat.completions.create({
        model,
        messages: [
          ...messages,
          { role: "user", content: "Please provide your final analysis and recommendation based on all the data gathered so far. Be concise and actionable." },
        ],
        temperature: 0.2,
      });

      finalAnswer = finalCompletion.choices[0]?.message?.content || "Analysis complete — see tool results above.";
      emit("answer_chunk", { text: finalAnswer });
    } catch (e: any) {
      console.error("[agentLoop] Final synthesis failed:", e.message);
      finalAnswer = "Analysis complete. Review the tool results for details.";
      emit("answer_chunk", { text: finalAnswer });
    }
  }

  emit("answer_complete", {});
  emit("agent_done", { hops, stepCount: steps.length });

  console.log(`[agentLoop] Done: ${hops} hops, ${steps.length} steps, ${deals.length} deals`);

  return {
    plan: goal,
    deals,
    analysis: finalAnswer,
    steps,
    hops,
    toolResult: null,
  };
}
