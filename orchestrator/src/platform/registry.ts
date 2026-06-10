// src/platform/registry.ts — Domain-agnostic tool registry (platform core).
// Domain packs register their tools here at bootstrap via loadPack(); every
// consumer (agent loop, LangGraph supervisor, /api/tools, /mcp, Neuro SAN
// bridge) resolves tools from this single Map at request time.
import type { RegisteredTool } from "../lib/agentTypes.js";

export const toolRegistry: Map<string, RegisteredTool> = new Map();

export function registerTool(tool: RegisteredTool): void {
  const name = tool.schema?.name;
  if (!name) throw new Error("[platform] tool is missing schema.name");
  if (toolRegistry.has(name)) {
    console.warn(`[platform] tool "${name}" re-registered (overwriting)`);
  }
  toolRegistry.set(name, tool);
}

export function getTool(name: string): RegisteredTool | undefined {
  return toolRegistry.get(name);
}

/** Convert the registry to OpenAI function-calling format. */
export function getOpenAITools(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: any };
}> {
  return Array.from(toolRegistry.values()).map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.schema.name,
      description: tool.schema.description,
      parameters: tool.schema.parameters,
    },
  }));
}
