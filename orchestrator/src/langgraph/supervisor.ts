// src/langgraph/supervisor.ts — LangGraph.js supervisor over the DealSense team.
//
// Runs IN-PROCESS: specialists call the tool registry directly (no HTTP hop,
// no second runtime). Emits the same event vocabulary as the Neuro SAN proxy
// so the UI's live network panel works identically for both orchestrators.
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { toolRegistry } from "../tools/registry.js";
import type { AgentContext } from "../lib/agentTypes.js";
import {
  SPECIALISTS, SUPERVISOR_NAME, SUPERVISOR_PROMPT, jsonSchemaToZod,
} from "./specialists.js";

export type Emit = (kind: string, payload?: Record<string, any>) => void;

function makeModel(modelOverride?: string): ChatOpenAI {
  if (process.env.OPENAI_API_KEY) {
    return new ChatOpenAI({ model: modelOverride || process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0 });
  }
  if (process.env.GEMINI_API_KEY) {
    return new ChatOpenAI({
      model: modelOverride || process.env.LG_MODEL || "gemini-2.5-flash",
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY,
      configuration: { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" },
    });
  }
  if (process.env.GROQ_API_KEY) {
    return new ChatOpenAI({
      model: modelOverride || process.env.LG_MODEL || "llama-3.3-70b-versatile",
      temperature: 0,
      apiKey: process.env.GROQ_API_KEY,
      configuration: { baseURL: "https://api.groq.com/openai/v1" },
    });
  }
  throw new Error("No LLM key found (OPENAI_API_KEY / GEMINI_API_KEY / GROQ_API_KEY)");
}

/** Model tiering: the supervisor needs planning discipline (don't stop until
 * every checklist part is done), so it gets a stronger model; specialists are
 * latency-sensitive tool-callers and stay on the fast tier. */
function makeSupervisorModel(): ChatOpenAI {
  if (process.env.LG_SUPERVISOR_MODEL) return makeModel(process.env.LG_SUPERVISOR_MODEL);
  if (!process.env.OPENAI_API_KEY && process.env.GEMINI_API_KEY) return makeModel("gemini-2.5-pro");
  return makeModel();
}

const pretty = (id: string) =>
  id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const text = (content: any): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((c: any) => c?.text || "").join("")
      : JSON.stringify(content);

/** Wrap one registry tool for a given specialist, with live event emission. */
function makeRegistryTool(toolName: string, specialist: string, runId: string, emit: Emit, hops: { n: number }) {
  const reg = toolRegistry.get(toolName);
  if (!reg) throw new Error(`tool ${toolName} not in registry`);

  return tool(
    async (args: Record<string, any>) => {
      // strip nulls so registry destructuring defaults apply
      const clean = Object.fromEntries(
        Object.entries(args || {}).filter(([, v]) => v !== null && v !== undefined)
      );
      hops.n++;
      emit("ns_hop", { chain: [SUPERVISOR_NAME, specialist, toolName], target: toolName, targetType: "tool" });
      emit("tool_executing", { toolName, agent: specialist });
      emit("agent_step", { hop: hops.n, type: "tool_call", toolName, content: `${pretty(specialist)} → ${pretty(toolName)}` });
      const t0 = Date.now();
      const ctx: AgentContext = {
        runId,
        // forward registry-internal progress (search status, sources found...)
        pub: (kind: string, payload: Record<string, any> = {}) => emit(kind, payload),
      };
      try {
        const result = await reg.execute(clean, ctx);
        const out = JSON.stringify(result ?? null);
        emit("tool_complete", { toolName, agent: specialist, durationMs: Date.now() - t0 });
        emit("agent_step", { hop: hops.n, type: "tool_result", toolName, toolResult: out.slice(0, 400), durationMs: Date.now() - t0 });
        return out.length > 24000 ? out.slice(0, 24000) + "…(truncated)" : out;
      } catch (e: any) {
        emit("tool_complete", { toolName, agent: specialist, durationMs: Date.now() - t0, error: true });
        return `ERROR from ${toolName}: ${e?.message || e}`;
      }
    },
    {
      name: toolName,
      description: reg.schema.description,
      schema: jsonSchemaToZod(reg.schema.parameters),
    }
  );
}

/** Expose one specialist sub-agent as a supervisor tool. */
function makeSpecialistTool(spec: (typeof SPECIALISTS)[number], model: ChatOpenAI, runId: string, emit: Emit, hops: { n: number }) {
  const agent = createReactAgent({
    llm: model,
    tools: spec.tools.map((t) => makeRegistryTool(t, spec.name, runId, emit, hops)),
    prompt: spec.prompt,
  });

  return tool(
    async ({ inquiry, context }: { inquiry: string; context?: string | null }) => {
      hops.n++;
      emit("ns_hop", { chain: [SUPERVISOR_NAME, spec.name], target: spec.name, targetType: "specialist" });
      emit("thinking", { text: `🤝 Deal Advisor → delegating to ${pretty(spec.name)}` });
      emit("agent_step", { hop: hops.n, type: "delegate", toolName: spec.name, content: `Deal Advisor → ${pretty(spec.name)}: ${inquiry.slice(0, 160)}` });

      const input = context ? `${inquiry}\n\nContext from other specialists:\n${context}` : inquiry;
      const res = await agent.invoke(
        { messages: [new HumanMessage(input)] },
        { recursionLimit: 24 }
      );
      const finding = text(res.messages[res.messages.length - 1]?.content ?? "");

      emit("thinking", { text: `✓ ${pretty(spec.name)}: ${finding.slice(0, 160)}${finding.length > 160 ? "…" : ""}` });
      emit("agent_step", { hop: hops.n, type: "finding", toolName: spec.name, content: finding });
      emit("ns_hop", { chain: [SUPERVISOR_NAME], target: SUPERVISOR_NAME, targetType: "front_man" });
      return finding;
    },
    {
      name: spec.name,
      description: spec.description,
      schema: z.object({
        inquiry: z.string().describe("The specific question or task for this specialist."),
        context: z.string().nullable().optional()
          .describe("Relevant findings from other specialists (deal details, prior scores, etc.)."),
      }),
    }
  );
}

// Conversation memory: checkpoints supervisor message history per thread_id,
// so follow-up queries ("now run a DCF on the best one") carry full context.
// In-process only — restarting the orchestrator clears threads.
const checkpointer = new MemorySaver();

/** Run one query through the supervisor. Returns the final markdown answer. */
export async function runLangGraphSupervisor(
  query: string,
  runId: string,
  emit: Emit,
  threadId?: string
): Promise<{ answer: string; hops: number }> {
  const specialistModel = makeModel();
  const hops = { n: 0 };

  const supervisor = createReactAgent({
    llm: makeSupervisorModel(),
    tools: SPECIALISTS.map((s) => makeSpecialistTool(s, specialistModel, runId, emit, hops)),
    prompt: SUPERVISOR_PROMPT,
    checkpointer,
  });

  const res = await supervisor.invoke(
    { messages: [new HumanMessage(query)] },
    { recursionLimit: 40, configurable: { thread_id: threadId || runId } }
  );
  return { answer: text(res.messages[res.messages.length - 1]?.content ?? ""), hops: hops.n };
}
