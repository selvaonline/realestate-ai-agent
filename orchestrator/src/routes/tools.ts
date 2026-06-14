// src/routes/tools.ts — Direct tool execution API (no LLM overhead)
import { Router } from "express";
import { toolRegistry } from "../tools/registry.js";
import { validate, toolExecuteSchema } from "../middleware/validate.js";
import type { AgentContext } from "../lib/agentTypes.js";

export const toolsRouter = Router();

/**
 * GET /api/tools/registry — List all available tools with schemas
 */
toolsRouter.get("/api/tools/registry", (_req, res) => {
  const tools = Array.from(toolRegistry.entries()).map(([name, tool]) => ({
    name,
    description: tool.schema.description,
    category: tool.category,
    parameters: tool.schema.parameters,
    estimatedDurationMs: tool.estimatedDurationMs,
  }));
  res.json({ tools });
});

/**
 * POST /api/tools/execute — Run a single tool directly
 * Body: { tool: string, args: Record<string,any>, orgSettings?: any }
 */
toolsRouter.post("/api/tools/execute", validate(toolExecuteSchema), async (req, res) => {
  const { tool: toolName, args, orgSettings } = req.body as {
    tool: string;
    args: Record<string, any>;
    orgSettings?: any;
  };

  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return res.status(404).json({ ok: false, error: `Tool "${toolName}" not found` });
  }

  const ctx: AgentContext = {
    runId: `tool-${Date.now()}`,
    orgSettings,
    pub: () => {},
  };

  try {
    console.log(`[tools/execute] ${toolName}`, JSON.stringify(args).slice(0, 200));
    const result = await tool.execute(args, ctx);
    res.json({ ok: true, tool: toolName, result });
  } catch (e: any) {
    console.error(`[tools/execute] ${toolName} error:`, e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || "Tool execution failed" });
  }
});
