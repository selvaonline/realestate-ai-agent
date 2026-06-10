#!/usr/bin/env node
/**
 * DealSense MCP Server
 *
 * Exposes the DealSense AI Agent's CRE analysis tools via the
 * Model Context Protocol (MCP), so any MCP client (Claude Desktop,
 * Cursor, Windsurf, etc.) can search properties, run DCF analysis,
 * assess market risk, and more — all powered by the same backend
 * that runs reagent.selvaonline.com.
 *
 * Transport: stdio (default) or SSE via --sse flag
 * Backend:   Proxies to a running DealSense orchestrator instance
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Configuration ────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.DEALSENSE_URL || "https://reagent.selvaonline.com";
const TIMEOUT_MS = 120_000;

// ── HTTP helper ──────────────────────────────────────────────────────────────

async function callBackend(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Backend error ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "dealsense",
  version: "1.0.0",
});

// ── Tool: search_properties ──────────────────────────────────────────────────

server.tool(
  "search_properties",
  "Search commercial real estate listings across CREXi, LoopNet, Brevitas, and other CRE marketplaces. Returns PE-scored and ranked results with investment analysis.",
  {
    query: z.string().describe("Natural language search query — include property type, location, tenant, cap rate range as needed"),
    maxResults: z.number().optional().default(10).describe("Max results to return (default 10, max 30)"),
  },
  async ({ query, maxResults }) => {
    const result = await callBackend("/chat/enhanced", {
      user: `Search for: ${query}. Return top ${maxResults} results.`,
      sessionId: `mcp-${Date.now()}`,
    });
    return { content: [{ type: "text" as const, text: result.content || JSON.stringify(result) }] };
  }
);

// ── Tool: assess_risk ────────────────────────────────────────────────────────

server.tool(
  "assess_risk",
  "Compute a 0-100 market risk score using live FRED Treasury data, CPI, yield curve, and BLS unemployment data. Returns risk score with macro context.",
  {
    market: z.string().describe("Metro or market to assess (e.g., 'Dallas TX', 'US commercial real estate')"),
  },
  async ({ market }) => {
    const result = await callBackend("/chat/enhanced", {
      user: `Assess the current market risk for ${market}. Use the assess_risk tool and provide the macro data.`,
      sessionId: `mcp-risk-${Date.now()}`,
    });
    return { content: [{ type: "text" as const, text: result.content || JSON.stringify(result) }] };
  }
);

// ── Tool: run_dcf ────────────────────────────────────────────────────────────

server.tool(
  "run_dcf",
  "Run a Discounted Cash Flow analysis computing IRR, equity multiple, and cash-on-cash returns for a CRE property.",
  {
    noi: z.number().describe("Annual Net Operating Income ($)"),
    askingPrice: z.number().describe("Asking price ($)"),
    holdYears: z.number().optional().default(10).describe("Investment hold period in years (default 10)"),
    exitCapRate: z.number().optional().default(0.065).describe("Exit cap rate assumption (default 6.5%)"),
    noiGrowth: z.number().optional().default(0.02).describe("Annual NOI growth rate (default 2%)"),
    loanLtv: z.number().optional().default(0.65).describe("Loan-to-value ratio (default 65%)"),
    loanRate: z.number().optional().default(0.065).describe("Loan interest rate (default 6.5%)"),
    loanAmortYears: z.number().optional().default(30).describe("Loan amortization period (default 30 years)"),
  },
  async (args) => {
    const result = await callBackend("/chat/enhanced", {
      user: `Run a DCF analysis with these inputs: NOI=$${args.noi.toLocaleString()}, Price=$${args.askingPrice.toLocaleString()}, Hold=${args.holdYears}yr, Exit Cap=${(args.exitCapRate * 100).toFixed(1)}%, NOI Growth=${(args.noiGrowth * 100).toFixed(1)}%, LTV=${(args.loanLtv * 100).toFixed(0)}%, Rate=${(args.loanRate * 100).toFixed(2)}%. Use the run_dcf tool.`,
      sessionId: `mcp-dcf-${Date.now()}`,
    });
    return { content: [{ type: "text" as const, text: result.content || JSON.stringify(result) }] };
  }
);

// ── Tool: analyze_property ───────────────────────────────────────────────────

server.tool(
  "analyze_property",
  "Analyze a specific CRE property listing URL — extracts price, NOI, cap rate, tenant, lease terms, and runs underwriting.",
  {
    url: z.string().url().describe("Full URL of the property listing (e.g., from CREXi, LoopNet, Brevitas)"),
  },
  async ({ url }) => {
    const result = await callBackend("/chat/enhanced", {
      user: `Analyze this property listing: ${url}. Extract all financial details and provide an investment recommendation.`,
      sessionId: `mcp-prop-${Date.now()}`,
    });
    return { content: [{ type: "text" as const, text: result.content || JSON.stringify(result) }] };
  }
);

// ── Tool: market_deep_dive ───────────────────────────────────────────────────

server.tool(
  "market_deep_dive",
  "Comprehensive market intelligence for a US metro — combines FRED macro data, unemployment, CRE listing activity, and risk scoring.",
  {
    metro: z.string().describe("Metro area name (e.g., 'Dallas TX', 'Miami FL', 'Phoenix AZ')"),
    propertyType: z.string().optional().describe("Property type filter (e.g., 'NNN retail', 'industrial', 'medical office')"),
  },
  async ({ metro, propertyType }) => {
    const extra = propertyType ? ` Focus on ${propertyType} properties.` : "";
    const result = await callBackend("/chat/enhanced", {
      user: `Do a deep market analysis for ${metro}.${extra} Include macro data, risk assessment, and current listing activity.`,
      sessionId: `mcp-market-${Date.now()}`,
    });
    return { content: [{ type: "text" as const, text: result.content || JSON.stringify(result) }] };
  }
);

// ── Tool: compare_deals ──────────────────────────────────────────────────────

server.tool(
  "compare_deals",
  "Find and compare comparable CRE properties in a given market. Returns PE scores, cap rates, and relative rankings.",
  {
    market: z.string().describe("Market/location to search (e.g., 'Dallas TX')"),
    propertyType: z.string().describe("Property type (e.g., 'NNN retail', 'industrial warehouse', 'medical office')"),
    priceRange: z.string().optional().describe("Price range filter (e.g., '$1M-$5M')"),
  },
  async ({ market, propertyType, priceRange }) => {
    const price = priceRange ? ` in the ${priceRange} range` : "";
    const result = await callBackend("/chat/enhanced", {
      user: `Find comparable ${propertyType} properties in ${market}${price}. Compare them side by side with PE scores and cap rates.`,
      sessionId: `mcp-comp-${Date.now()}`,
    });
    return { content: [{ type: "text" as const, text: result.content || JSON.stringify(result) }] };
  }
);

// ── Tool: generate_memo ──────────────────────────────────────────────────────

server.tool(
  "generate_memo",
  "Generate a professional Investment Committee memorandum for a CRE property, including financial analysis, market context, and recommendation.",
  {
    propertyDescription: z.string().describe("Property details — address, type, tenant, price, NOI, cap rate, etc."),
  },
  async ({ propertyDescription }) => {
    const result = await callBackend("/chat/enhanced", {
      user: `Generate a professional IC memorandum for this property: ${propertyDescription}. Include executive summary, financial analysis, market context, risk factors, and recommendation.`,
      sessionId: `mcp-memo-${Date.now()}`,
    });
    return { content: [{ type: "text" as const, text: result.content || JSON.stringify(result) }] };
  }
);

// ── Tool: ask_dealsense ──────────────────────────────────────────────────────

server.tool(
  "ask_dealsense",
  "Ask DealSense any CRE investment question. The AI agent will use its full toolkit (search, risk, DCF, comps) to answer with multi-hop reasoning.",
  {
    question: z.string().describe("Any CRE investment question"),
    sessionId: z.string().optional().describe("Session ID for conversation continuity (optional)"),
  },
  async ({ question, sessionId }) => {
    const result = await callBackend("/chat/enhanced", {
      user: question,
      sessionId: sessionId || `mcp-ask-${Date.now()}`,
    });
    return {
      content: [{
        type: "text" as const,
        text: [
          result.content,
          "",
          result.hops ? `[Agent: ${result.hops} hops, ${result.steps?.length || 0} steps]` : "",
          result.toolsUsed?.length ? `[Tools: ${result.toolsUsed.join(", ")}]` : "",
        ].filter(Boolean).join("\n"),
      }],
    };
  }
);

// ── Resource: agent capabilities ─────────────────────────────────────────────

server.resource(
  "dealsense://capabilities",
  "dealsense://capabilities",
  async () => ({
    contents: [{
      uri: "dealsense://capabilities",
      mimeType: "text/markdown",
      text: `# DealSense AI Agent — Capabilities

## Tools Available
| Tool | Description |
|------|-------------|
| search_properties | Search CRE listings across CREXi, LoopNet, Brevitas with PE scoring |
| assess_risk | Market risk scoring using FRED Treasury, CPI, unemployment data |
| run_dcf | Discounted Cash Flow analysis — IRR, equity multiple, cash-on-cash |
| analyze_property | Extract and analyze a specific property listing URL |
| market_deep_dive | Comprehensive metro market intelligence |
| compare_deals | Find and compare comparable properties |
| generate_memo | Generate IC memorandum for a property |
| ask_dealsense | Free-form CRE question with multi-hop agent reasoning |

## Data Sources
- **CREXi, LoopNet, Brevitas** — Property listings with live search
- **FRED** — 10Y Treasury, 2s10 spread, CPI, unemployment
- **BLS** — Metro-level unemployment data
- **PE Scoring Model** — 6-factor 100-point institutional scoring

## Backend
Running at: ${BACKEND_URL}

Built by [Selvakumar Murugesan](https://www.linkedin.com/in/selvaonline/)
`,
    }],
  })
);

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[dealsense-mcp] Server running on stdio");
}

main().catch((err) => {
  console.error("[dealsense-mcp] Fatal:", err);
  process.exit(1);
});
