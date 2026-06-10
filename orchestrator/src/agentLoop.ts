// src/agentLoop.ts — Core agentic loop: LLM-driven multi-hop tool selection
import OpenAI from "openai";
import { getLLM } from "./llm.js";
import { toolRegistry, getOpenAITools } from "./tools/registry.js";
import type { AgentContext, AgentStep, AgentOutput } from "./lib/agentTypes.js";
import type { Deal } from "./lib/types.js";

// ── System Prompt ────────────────────────────────────────────────────────────

const CRE_ANALYST_SYSTEM_PROMPT = `You are DealSense, an expert Commercial Real Estate (CRE) investment analyst AI agent.

You have deep knowledge of:
- NNN lease structures, cap rates, DSCR, DCF analysis, and levered returns
- Institutional CRE deal flow and investment criteria
- FRED macro data interpretation (Treasury curve, CPI, UNRATE)
- DealSense PE scoring model: 7 factors totaling 100 points
  (Tenant Quality 20, Market Quality 20, Yield/Cap Rate 15, Deal Economics 15, Execution Risk 10, Asset Fit 10, Mobility/Real-World Activity 10)
- Location intelligence: foot traffic, parking utilization, road traffic, nearby anchors, visibility
- CRE market dynamics across US metros
- Tenant credit analysis with S&P-equivalent ratings
- VaR / stress testing and risk factor decomposition
- LP/GP waterfall, fund compliance, and allocation rules
- Multi-asset class comparison (CRE vs S&P vs REIT vs bonds)

Available tools include: search_properties, assess_risk, run_dcf, comp_analysis, market_deep_dive,
tenant_credit_analysis, risk_decomposition, portfolio_var, multi_asset_compare, compliance_check,
institutional_pipeline, market_intel, generate_loi, generate_memo, filter_and_rank, portfolio_review,
analyze_traffic_patterns

LOCATION INTELLIGENCE (analyze_traffic_patterns):
- Call analyze_traffic_patterns whenever the user asks about foot traffic, parking, road traffic, visibility,
  site quality, location strength, retail activity, nearby anchors, or tenant performance.
- ALSO call it automatically when analyzing retail, pharmacy, QSR, grocery, urgent care, medical office,
  or veterinary properties (e.g. Walgreens, CVS, Starbucks, Chick-fil-A, grocery-anchored centers) —
  pass the best-known address/title, propertyType, tenant, and metro from search results.
- When generating an IC memo for such properties, run analyze_traffic_patterns first and fold the
  mobility findings into the memo.
- Whenever analyze_traffic_patterns was used, your final recommendation MUST include one sentence of the form:
  "Real-world activity signals indicate [strong/moderate/weak] location quality based on parking, traffic, and nearby anchor patterns."

CRITICAL: You MUST follow this multi-step workflow. Do NOT skip steps. Do NOT stop after one tool call.

Your REQUIRED workflow (minimum 3 tool calls for any property search):
1. SEARCH for properties using search_properties
2. ASSESS market risk using assess_risk to get macro context (Treasury rates, unemployment, CPI)
3. If the search returned few or no direct results, SEARCH AGAIN with a different query formulation
4. If financial details available on top deals, run run_dcf for levered return analysis
5. SYNTHESIZE everything into a comprehensive, actionable recommendation

IMPORTANT RULES:
- You MUST call at least 2 different tools before giving your final answer
- ALWAYS call assess_risk after search_properties — investors need macro context
- Call multiple tools per turn when you need different data simultaneously (e.g., search_properties AND assess_risk in the same turn)
- If a search returns few results, reformulate and search again (e.g., "NNN Walgreens Texas" → "net lease pharmacy retail Texas for sale")
- NEVER give a final answer after just one tool call — that's not thorough analysis
- Always provide a risk-adjusted recommendation: Pursue / Monitor / Pass
- NEVER invent prices, cap rates, or financial data — say "not available" if missing
- Format your final answer in clear sections: Key Findings, Market Context, Recommendation
- Be concise but thorough — institutional analysts value precision over verbosity
- When presenting deals, include PE score, risk assessment, and next steps

Investment thesis context: Institutional-quality NNN, industrial, and medical office assets in Tier A/B US markets with investment-grade tenants. Target: PE score >= 70, Risk score <= 60, cap rate 200+ bps above 10Y Treasury.`;

// ── Summarize tool results for LLM context ───────────────────────────────────

function summarizeResult(result: any, toolName: string): string {
  if (!result) return "No result";
  if (result.error) return `Error: ${result.error}`;

  switch (toolName) {
    case "search_properties": {
      const s = result.scored || [];
      return `Found ${result.rawCount} results, scored ${s.length}. Top: ${s.slice(0, 3).map((r: any) => `[PE ${r.peScore}] ${(r.title || "").slice(0, 50)}`).join("; ")}`;
    }
    case "assess_risk":
      return `Risk: ${result.riskScore}/100 — ${result.riskNote}`;
    case "run_dcf":
      return `IRR: ${result.irr}, Equity Multiple: ${result.equityMultiple}, Cash-on-Cash: ${result.cashOnCash}`;
    case "comp_analysis":
      return `${result.compCount} comps found in ${result.market}, avg PE: ${result.avgPeScore}`;
    case "market_deep_dive":
      return `${result.metro}: Risk ${result.riskScore}/100, 10Y: ${result.macro?.treasury10y}, U/E: ${result.macro?.metroUnemployment}`;
    case "analyze_property_url":
      return result.skipped ? result.reason : `${result.title} — Price: ${result.askingPrice}, Cap: ${result.capRate}`;
    case "generate_memo":
      return "IC memo generated successfully";
    case "filter_and_rank":
      return `Filtered ${result.originalCount} → ${result.filteredCount} deals`;
    case "portfolio_review":
      return `Portfolio: ${result.totalProperties} properties, avg PE: ${result.avgPeScore}`;
    case "tenant_credit_analysis":
      return `${result.tenant}: ${result.rating} (${result.ratingLabel}) — ${result.recommendation?.slice(0, 80)}`;
    case "generate_loi":
      return `LOI generated for ${result.summary?.price ? `$${(result.summary.price / 1e6).toFixed(1)}M` : 'property'} — closing: ${result.summary?.closingDate || 'TBD'}`;
    case "compliance_check":
      return `${result.compliant ? 'COMPLIANT' : `${result.violations?.length} violations`} — ${result.fundMetrics?.dealCount} deals, NAV: $${((result.fundMetrics?.nav || 0) / 1e6).toFixed(1)}M`;
    case "portfolio_var":
      return `VaR(95): ${result.var95}, Portfolio IRR: ${result.portfolioIrr}, Max Drawdown: ${result.maxDrawdown}`;
    case "risk_decomposition":
      return `Total Risk: ${result.totalRisk}/100 — ${result.recommendation?.slice(0, 60)}`;
    case "multi_asset_compare":
      return `CRE Sharpe: ${result.creReturn?.sharpe}, Risk Premium: ${result.riskPremium} — ${result.recommendation?.slice(0, 60)}`;
    case "institutional_pipeline":
      return `Pipeline: ${result.screened} screened → ${result.qualified} qualified (${result.icReady} IC-ready), pass rate: ${result.passRate}`;
    case "market_intel":
      return `${result.metro} intel gathered: construction, vacancy, rent, demographics, cap rates`;
    case "analyze_traffic_patterns":
      return `Mobility Score ${result.mobilityScore}/100, trend ${result.trend} — parking ${result.parkingScore}, traffic ${result.trafficScore}, foot traffic ${result.footTrafficScore}, anchors ${result.nearbyAnchorScore} (confidence: ${result.confidence}, impact: ${result.recommendationImpact})`;
    default:
      return JSON.stringify(result).slice(0, 200);
  }
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
    { role: "system", content: CRE_ANALYST_SYSTEM_PROMPT },
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
