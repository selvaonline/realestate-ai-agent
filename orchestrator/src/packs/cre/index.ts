// src/packs/cre/index.ts — The DealSense CRE domain pack.
// Everything domain-specific lives behind this interface: tool
// implementations, the specialist team, and the prompts. The platform core
// (agent loop, LangGraph supervisor, tool/MCP routes, Neuro SAN bridge)
// consumes only the DomainPack contract.
import type { DomainPack } from "../../platform/domainPack.js";
import { creTools } from "../../tools/registry.js";
import { CRE_ANALYST_SYSTEM_PROMPT } from "./prompt.js";
import { summarizeToolResult } from "./summarize.js";
import { SUPERVISOR_NAME, SUPERVISOR_PROMPT, SPECIALISTS } from "./specialists.js";

export const crePack: DomainPack = {
  id: "cre",
  name: "DealSense CRE",
  description:
    "Commercial real estate private equity analysis: deal sourcing, PE scoring, market risk, DCF, tenant credit, portfolio and IC documents.",
  systemPrompt: CRE_ANALYST_SYSTEM_PROMPT,
  supervisorName: SUPERVISOR_NAME,
  supervisorPrompt: SUPERVISOR_PROMPT,
  specialists: SPECIALISTS,
  tools: creTools,
  summarizeToolResult,
  dataSources: [
    { source: "CREXi, LoopNet, Brevitas", data: "Commercial real estate listings" },
    { source: "FRED (Federal Reserve)", data: "10Y Treasury, 2s10 spread, CPI YoY" },
    { source: "BLS (Bureau of Labor Statistics)", data: "Metro-level unemployment" },
    { source: "PE Scoring Model", data: "7-factor 100-point institutional scoring" },
    { source: "Mobility Intelligence (PoC)", data: "Foot traffic, parking, road traffic heuristics + provider hooks" },
    { source: "Credit Database", data: "S&P-equivalent tenant credit ratings" },
  ],
};
