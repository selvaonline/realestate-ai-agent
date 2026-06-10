// src/lib/agentTypes.ts — Shared types for the DealSense agentic system
import type { Deal } from "./types.js";

// ── Tool Registry Types ──────────────────────────────────────────────────────

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string; description?: string; properties?: Record<string, ToolParameter>; required?: string[] };
  properties?: Record<string, ToolParameter>;
  required?: string[];
  default?: any;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface RegisteredTool {
  schema: ToolSchema;
  execute: (args: Record<string, any>, ctx: AgentContext) => Promise<any>;
  category: "search" | "analysis" | "market" | "portfolio" | "ui" | "document" | "location";
  estimatedDurationMs?: number;
}

// ── Agent Loop Types ─────────────────────────────────────────────────────────

export interface OrgSettings {
  peWeights?: {
    tenantLease: number;
    yieldSpread: number;
    marketQuality: number;
    assetFit: number;
    dealEconomics: number;
    executionRisk: number;
    mobility?: number;
  };
  riskModel?: {
    treasuryBaseline: number;
    cpiNeutral: number;
    unemploymentSensitivity: number;
    curveInversionPenalty: number;
  };
  fundMandates?: Record<string, any>;
  dcfDefaults?: Record<string, any>;
  returnTargets?: Record<string, any>;
  marketPrefs?: Record<string, any>;
  tenantPolicy?: Record<string, any>;
  dataSources?: { enabledSources: string[]; apiKeys: Record<string, string> };
}

export interface AgentContext {
  runId?: string;
  sessionId?: string;
  pub?: (kind: string, payload?: Record<string, any>) => void;
  dataSources?: { enabledDomains: string[]; apiKeys: Record<string, string> };
  orgSettings?: OrgSettings;
  session?: SessionData;
  maxHops?: number;        // default 8
  abortSignal?: AbortSignal;
  _dealAccumulator?: Deal[];
}

export interface AgentStep {
  hop: number;
  type: "thinking" | "tool_call" | "tool_result" | "final_answer";
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  durationMs?: number;
  timestamp: number;
}

export interface AgentOutput {
  plan: string;
  deals: Deal[];
  analysis?: string;
  recommendation?: string;
  steps: AgentStep[];
  hops: number;
  toolResult: null;
}

// ── Session / Memory Types ───────────────────────────────────────────────────

export interface InvestmentCriteria {
  propertyTypes?: string[];
  targetMarkets?: string[];
  capRateMin?: number;
  capRateMax?: number;
  priceMin?: number;
  priceMax?: number;
  tenantPreferences?: string[];
  riskTolerance?: "low" | "medium" | "high";
  holdPeriodYears?: number;
  targetIrr?: number;
  lastUpdated?: number;
}

export interface SessionData {
  id: string;
  history: SessionMessage[];
  context: SessionContext;
  criteria: InvestmentCriteria;
  portfolio: PortfolioEntry[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface SessionMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
}

export interface SessionContext {
  lastSearch?: {
    query: string;
    results: any[];
    riskScore?: number;
    timestamp: number;
  };
  currentDeals?: any[];
  portfolioData?: any;
  scored?: any[];
  [key: string]: any;
}

export interface PortfolioEntry {
  url: string;
  title: string;
  addedAt: number;
  peScore?: number;
  riskScore?: number;
  assetType?: string;
  market?: string;
  capRate?: number;
  askingPrice?: number;
}

// ── SSE Event Types ─────────────────────────────────────────────────────────

export type AgentEventKind =
  // Existing (must not change)
  | "run_started" | "run_finished"
  | "thinking" | "status" | "nav"
  | "shot" | "extracted" | "source_found"
  | "deal_found" | "answer_chunk" | "answer_complete"
  | "property_progress" | "browser_preview"
  | "heartbeat"
  // New agentic events
  | "agent_step"
  | "tool_executing"
  | "tool_complete"
  | "agent_done"
  | "criteria_updated"
  | "mobility_result";
