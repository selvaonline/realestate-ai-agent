// src/platform/domainPack.ts — The seam between the generic multi-agent
// platform and a vertical domain. A domain pack is data + tools, not core
// code changes: it supplies the tool implementations, the specialist team
// topology (consumed by both the LangGraph supervisor and the Neuro SAN
// HOCON generator), and the prompts.
import type { RegisteredTool } from "../lib/agentTypes.js";
import { registerTool } from "./registry.js";

/** One specialist agent: a named member of the team owning a tool subset. */
export interface SpecialistSpec {
  name: string;
  /** What the supervisor sees when deciding to delegate. */
  description: string;
  /** The specialist's system prompt. */
  prompt: string;
  /** Tool names from the registry this specialist may call. */
  tools: string[];
}

export interface DomainPack {
  id: string;
  name: string;
  description: string;
  /** System prompt for the flat (single-LLM) agent loop. */
  systemPrompt: string;
  /** Supervisor (front man) of the multi-agent team. */
  supervisorName: string;
  supervisorPrompt: string;
  specialists: SpecialistSpec[];
  /** Tool implementations; registered into the platform registry on load. */
  tools: RegisteredTool[];
  /** Shown on the MCP landing page / capabilities resource. */
  dataSources?: Array<{ source: string; data: string }>;
  /** Optional compact tool-result summaries for LLM context windows.
   *  Return null/undefined to fall back to the generic JSON truncation. */
  summarizeToolResult?: (toolName: string, result: any) => string | null | undefined;
}

let activePack: DomainPack | null = null;

export function loadPack(pack: DomainPack): void {
  for (const tool of pack.tools) registerTool(tool);
  activePack = pack;
  console.log(
    `[platform] loaded domain pack "${pack.id}" — ${pack.tools.length} tools, ` +
    `${pack.specialists.length} specialists, supervisor: ${pack.supervisorName}`
  );
}

export function getActivePack(): DomainPack {
  if (!activePack) {
    throw new Error("[platform] no domain pack loaded — import ./bootstrap.js at startup");
  }
  return activePack;
}
