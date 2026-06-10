// src/routes/mcp.ts — Remote MCP server endpoint
// Exposes DealSense tools via Model Context Protocol over Streamable HTTP
// Usage: clients connect to https://reagent.selvaonline.com/mcp

import { Router, json } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { toolRegistry } from "../tools/registry.js";

const BACKEND_URL = process.env.DEALSENSE_URL || "https://reagent.selvaonline.com";

// ── Session management ──────────────────────────────────────────────────────

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: number;
}

const sessions = new Map<string, McpSession>();

// Cleanup stale sessions every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour TTL
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) {
      session.transport.close().catch(() => {});
      session.server.close().catch(() => {});
      sessions.delete(id);
      console.log(`[mcp] Cleaned up stale session ${id}`);
    }
  }
}, 30 * 60 * 1000);

// ── Tool registration helper ────────────────────────────────────────────────

function registerTools(server: McpServer) {
  // search_properties
  server.tool(
    "search_properties",
    "Search commercial real estate listings across CREXi, LoopNet, Brevitas. Returns PE-scored and ranked results.",
    {
      query: z.string().describe("Natural language search query — include property type, location, tenant, cap rate as needed"),
      maxResults: z.number().optional().default(20).describe("Max results (default 20, max 30)"),
    },
    async ({ query, maxResults }) => {
      const tool = toolRegistry.get("search_properties")!;
      const result = await tool.execute({ query, maxResults }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // assess_risk
  server.tool(
    "assess_risk",
    "Compute 0-100 market risk score using live FRED Treasury, CPI, yield curve, and BLS unemployment data.",
    {
      query: z.string().describe("Property search query or location context"),
      forceMetro: z.string().optional().describe("Specific metro name, e.g. 'Dallas' or 'Miami'"),
    },
    async ({ query, forceMetro }) => {
      const tool = toolRegistry.get("assess_risk")!;
      const result = await tool.execute({ query, forceMetro }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // get_macro_data
  server.tool(
    "get_macro_data",
    "Fetch raw macro data for a metro: 10Y Treasury, 2s10 curve, CPI YoY, unemployment.",
    {
      metro: z.string().optional().describe("Metro name, e.g. 'Dallas', 'Miami', 'Austin'"),
    },
    async ({ metro }) => {
      const tool = toolRegistry.get("get_macro_data")!;
      const result = await tool.execute({ metro }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // run_dcf
  server.tool(
    "run_dcf",
    "Run DCF analysis computing IRR, equity multiple, cash-on-cash returns for a CRE property.",
    {
      purchasePrice: z.number().describe("Purchase price in dollars"),
      noi: z.number().describe("Annual Net Operating Income in dollars"),
      ltv: z.number().optional().default(0.65).describe("Loan-to-value ratio (default 0.65)"),
      interestRate: z.number().optional().default(0.055).describe("Annual interest rate (default 0.055)"),
      holdYears: z.number().optional().default(5).describe("Hold period in years (default 5)"),
      noiGrowth: z.number().optional().default(0.02).describe("Annual NOI growth rate (default 0.02)"),
      exitCapSpread: z.number().optional().default(0.005).describe("Exit cap spread over entry (default 0.005)"),
    },
    async (args) => {
      const tool = toolRegistry.get("run_dcf")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // analyze_property_url
  server.tool(
    "analyze_property_url",
    "Extract property details from a CRE listing URL via headless browser — price, NOI, cap rate, tenant, screenshot.",
    {
      url: z.string().describe("Direct property listing URL (CREXi, LoopNet, etc.)"),
    },
    async ({ url }) => {
      const tool = toolRegistry.get("analyze_property_url")!;
      const result = await tool.execute({ url }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // score_deals
  server.tool(
    "score_deals",
    "Apply DealSense PE scoring model to search result rows. Returns scored and ranked deals.",
    {
      rows: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string().optional(),
      })).describe("Array of {title, url, snippet} objects"),
      query: z.string().optional().describe("Original query for scoring context"),
    },
    async ({ rows, query }) => {
      const tool = toolRegistry.get("score_deals")!;
      const result = await tool.execute({ rows, query }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // generate_memo
  server.tool(
    "generate_memo",
    "Generate a professional Investment Committee memorandum for a CRE property.",
    {
      title: z.string().describe("Property title"),
      url: z.string().describe("Listing URL"),
      peScore: z.number().optional().describe("PE score 0-100"),
      peTier: z.string().optional().describe("PE tier label"),
      riskScore: z.number().optional().describe("Risk score 0-100"),
      riskNote: z.string().optional().describe("Risk summary note"),
      snippet: z.string().optional().describe("Property description"),
    },
    async (args) => {
      const tool = toolRegistry.get("generate_memo")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // comp_analysis
  server.tool(
    "comp_analysis",
    "Find comparable properties in the same market and type. Returns PE-scored comps for benchmarking.",
    {
      market: z.string().describe("City/metro, e.g. 'Dallas, TX'"),
      propertyType: z.string().describe("E.g. 'industrial', 'NNN retail', 'medical office'"),
      subjectTitle: z.string().optional().describe("Title of subject property for context"),
    },
    async ({ market, propertyType, subjectTitle }) => {
      const tool = toolRegistry.get("comp_analysis")!;
      const result = await tool.execute({ market, propertyType, subjectTitle }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // filter_and_rank
  server.tool(
    "filter_and_rank",
    "Apply filters to a set of deals. Filter by PE score, risk, location, property type and sort.",
    {
      instruction: z.string().describe("Natural language filter/sort instruction"),
      minPeScore: z.number().optional().describe("Minimum PE score threshold"),
      maxRiskScore: z.number().optional().describe("Maximum risk score threshold"),
      location: z.string().optional().describe("Filter by location keyword"),
      propertyType: z.string().optional().describe("Filter by property type keyword"),
      sortBy: z.enum(["peScore", "riskScore", "capRate", "price"]).optional().describe("Sort field"),
    },
    async (args) => {
      const tool = toolRegistry.get("filter_and_rank")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // market_deep_dive
  server.tool(
    "market_deep_dive",
    "Comprehensive market intelligence for a US metro — macro data, unemployment, risk scoring, listing activity.",
    {
      metro: z.string().describe("Metro name, e.g. 'Austin TX' or 'South Florida'"),
      propertyType: z.string().optional().describe("Focus on specific asset class"),
    },
    async ({ metro, propertyType }) => {
      const tool = toolRegistry.get("market_deep_dive")!;
      const result = await tool.execute({ metro, propertyType }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // portfolio_review
  server.tool(
    "portfolio_review",
    "Analyze a portfolio of CRE properties for concentration, risk distribution, and diversification gaps.",
    {
      focus: z.string().optional().describe("Focus: 'concentration', 'risk', 'yield', or 'diversification'"),
    },
    async ({ focus }) => {
      const tool = toolRegistry.get("portfolio_review")!;
      const result = await tool.execute({ focus }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── BlackRock-style institutional tools ──

  // tenant_credit_analysis
  server.tool(
    "tenant_credit_analysis",
    "Analyze tenant credit quality with S&P-equivalent ratings, financial health, and lease covenant analysis.",
    {
      tenantName: z.string().describe("Tenant name, e.g. 'Walgreens', 'Dollar General'"),
      leaseTermYears: z.number().optional().describe("Remaining lease term in years"),
      annualRent: z.number().optional().describe("Annual rent in dollars"),
      propertyType: z.string().optional().describe("Property type"),
      propertySqft: z.number().optional().describe("Property square footage"),
    },
    async (args) => {
      const tool = toolRegistry.get("tenant_credit_analysis")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // generate_loi
  server.tool(
    "generate_loi",
    "Generate a professional Letter of Intent (LOI) for a CRE acquisition with purchase terms and financing.",
    {
      propertyTitle: z.string().describe("Property name"),
      propertyAddress: z.string().optional().describe("Property address"),
      purchasePrice: z.number().describe("Purchase price in dollars"),
      buyerName: z.string().optional().default("DealSense Fund I, LLC").describe("Buyer entity name"),
      earnestMoneyPct: z.number().optional().default(0.01).describe("Earnest money as % of price"),
      dueDiligenceDays: z.number().optional().default(45).describe("Due diligence period in days"),
      closingDays: z.number().optional().default(30).describe("Days to close after DD"),
      financingType: z.string().optional().default("conventional").describe("Financing type"),
      ltv: z.number().optional().default(0.65).describe("Loan-to-value ratio"),
      specialConditions: z.string().optional().describe("Special conditions"),
    },
    async (args) => {
      const tool = toolRegistry.get("generate_loi")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // compliance_check
  server.tool(
    "compliance_check",
    "Check portfolio compliance against fund mandates and compute LP/GP waterfall distribution.",
    {
      portfolio: z.array(z.object({
        title: z.string(),
        purchasePrice: z.number(),
        noi: z.number(),
        market: z.string(),
        propertyType: z.string(),
        peScore: z.number().optional(),
      })).describe("Portfolio of deals"),
      fundSize: z.number().describe("Total fund AUM"),
      totalReturn: z.number().optional().describe("Total fund return for waterfall"),
    },
    async (args) => {
      const tool = toolRegistry.get("compliance_check")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // portfolio_var
  server.tool(
    "portfolio_var",
    "Compute Value at Risk (VaR) and run stress tests: rate shock, NOI decline, vacancy spike, cap expansion.",
    {
      properties: z.array(z.object({
        purchasePrice: z.number(),
        noi: z.number(),
        ltv: z.number().optional(),
        interestRate: z.number().optional(),
        title: z.string().optional(),
      })).describe("Array of properties"),
      confidenceLevel: z.number().optional().default(0.95).describe("Confidence level (default 0.95)"),
      scenarios: z.array(z.string()).optional().describe("Subset of rate_shock, noi_decline, vacancy_spike, cap_expansion"),
    },
    async (args) => {
      const tool = toolRegistry.get("portfolio_var")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // risk_decomposition
  server.tool(
    "risk_decomposition",
    "Decompose deal risk into factors: rate sensitivity, credit risk, liquidity risk, inflation risk.",
    {
      purchasePrice: z.number().describe("Purchase price"),
      noi: z.number().describe("Annual NOI"),
      market: z.string().optional().describe("Metro name"),
      tenantName: z.string().optional().describe("Tenant name"),
      propertyType: z.string().optional().describe("Property type"),
      interestRate: z.number().optional().describe("Interest rate (default 0.055)"),
      ltv: z.number().optional().describe("LTV (default 0.65)"),
    },
    async (args) => {
      const tool = toolRegistry.get("risk_decomposition")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // multi_asset_compare
  server.tool(
    "multi_asset_compare",
    "Compare CRE returns against Treasury, S&P 500, REIT index with Sharpe ratio analysis.",
    {
      creIrr: z.number().describe("CRE deal's IRR as decimal"),
      creEquityMultiple: z.number().optional().describe("Equity multiple"),
      holdYears: z.number().optional().default(5).describe("Hold period"),
      riskScore: z.number().optional().describe("Risk score 0-100"),
      treasury10y: z.number().optional().describe("Current 10Y Treasury yield"),
    },
    async (args) => {
      const tool = toolRegistry.get("multi_asset_compare")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // institutional_pipeline
  server.tool(
    "institutional_pipeline",
    "Screen properties through institutional pipeline. Filters by deal size, PE score, tenant quality.",
    {
      query: z.string().describe("Search query"),
      minDealSize: z.number().optional().default(5000000).describe("Min deal size"),
      minPeScore: z.number().optional().default(70).describe("Min PE score"),
      tenantGrade: z.string().optional().default("investment_grade").describe("Tenant quality filter"),
    },
    async (args) => {
      const tool = toolRegistry.get("institutional_pipeline")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // market_intel
  server.tool(
    "market_intel",
    "Gather market intelligence: construction pipeline, vacancy, rent growth, demographics, cap rate trends.",
    {
      metro: z.string().describe("Metro name"),
      propertyType: z.string().optional().describe("Property type focus"),
    },
    async (args) => {
      const tool = toolRegistry.get("market_intel")!;
      const result = await tool.execute(args, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // analyze_traffic_patterns — Location Intelligence / Foot Traffic Agent
  server.tool(
    "analyze_traffic_patterns",
    "Estimate real-world property activity using parking, foot traffic, road traffic, nearby anchors, and visibility signals.",
    {
      address: z.string().describe("Property address"),
      propertyType: z.string().optional().describe("Property type such as retail, medical office, pharmacy, grocery, QSR"),
      tenant: z.string().optional().describe("Tenant name if available"),
      metro: z.string().optional().describe("Metro or city"),
    },
    async ({ address, propertyType, tenant, metro }) => {
      const tool = toolRegistry.get("analyze_traffic_patterns")!;
      const result = await tool.execute({ address, propertyType, tenant, metro }, { pub: () => {} });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Resource: capabilities
  server.resource(
    "capabilities",
    "dealsense://capabilities",
    async () => ({
      contents: [{
        uri: "dealsense://capabilities",
        mimeType: "text/markdown",
        text: `# DealSense AI Agent — MCP Server

## Tools Available (${toolRegistry.size} tools)
| Tool | Category | Description |
|------|----------|-------------|
| search_properties | search | Search CRE listings across CREXi, LoopNet, Brevitas with PE scoring |
| assess_risk | market | Market risk scoring using FRED Treasury, CPI, unemployment data |
| run_dcf | analysis | DCF analysis — IRR, equity multiple, cash-on-cash returns |
| analyze_property_url | search | Extract property details from a listing URL |
| score_deals | analysis | Apply PE scoring model to search results |
| get_macro_data | market | Raw macro data: Treasury, CPI, unemployment |
| generate_memo | document | Generate Investment Committee memorandum |
| comp_analysis | search | Find comparable properties in same market |
| filter_and_rank | analysis | Filter and sort deals by criteria |
| market_deep_dive | market | Comprehensive metro market intelligence |
| portfolio_review | portfolio | Analyze portfolio concentration and gaps |
| tenant_credit_analysis | analysis | S&P-equivalent tenant credit ratings and lease analysis |
| generate_loi | document | Generate Letter of Intent for acquisitions |
| compliance_check | portfolio | Fund mandate compliance and LP/GP waterfall |
| portfolio_var | portfolio | Value at Risk and stress testing |
| risk_decomposition | analysis | Risk factor decomposition with rate sensitivity |
| multi_asset_compare | analysis | Compare CRE vs S&P, REIT, bonds (Sharpe ratio) |
| institutional_pipeline | search | Institutional deal pipeline screening |
| market_intel | market | Market intelligence overlays via web search |
| analyze_traffic_patterns | location | Mobility Intelligence — foot traffic, parking, road traffic, anchors, visibility |

## Data Sources
- **CREXi, LoopNet, Brevitas** — Property listings
- **FRED** — 10Y Treasury, 2s10 spread, CPI, unemployment
- **BLS** — Metro-level unemployment data
- **PE Scoring Model** — 7-factor 100-point institutional scoring (incl. Mobility / Real-World Activity)
- **Mobility Intelligence (PoC)** — heuristic foot traffic / parking / road traffic model with hooks for Placer.ai, SafeGraph, Google Places, DOT counts

## Backend
${BACKEND_URL}

Built by [Selvakumar Murugesan](https://www.linkedin.com/in/selvaonline/)
`,
      }],
    })
  );
}

// ── Create a new MCP session ────────────────────────────────────────────────

function createMcpSession(): McpSession {
  const server = new McpServer(
    { name: "dealsense", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  registerTools(server);

  return { transport, server, createdAt: Date.now() };
}

// ── Landing page HTML ───────────────────────────────────────────────────────

const toolList = Array.from(toolRegistry.entries()).map(([name, t]) => {
  const desc = t.schema.description.slice(0, 90);
  return `<tr><td><code>${name}</code></td><td>${t.category}</td><td>${desc}</td></tr>`;
}).join("\n");

const mcpLandingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>DealSense MCP Server</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#e2e8f0;min-height:100vh;padding:40px 20px}
.container{max-width:900px;margin:0 auto}
.hero{text-align:center;margin-bottom:48px}
.hero h1{font-size:2.2rem;background:linear-gradient(135deg,#60a5fa,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
.hero .badge{display:inline-block;background:#1e293b;border:1px solid #334155;border-radius:20px;padding:4px 14px;font-size:.8rem;color:#94a3b8;margin-bottom:16px}
.hero p{color:#94a3b8;font-size:1.05rem;max-width:600px;margin:0 auto}
.card{background:#111827;border:1px solid #1e293b;border-radius:12px;padding:24px;margin-bottom:24px}
.card h2{font-size:1.15rem;color:#f1f5f9;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card h2 .icon{font-size:1.3rem}
.connect-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
.connect-item{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px}
.connect-item h3{font-size:.9rem;color:#60a5fa;margin-bottom:8px}
.connect-item code{display:block;background:#1e293b;padding:10px;border-radius:6px;font-size:.75rem;color:#a5f3fc;word-break:break-all;white-space:pre-wrap;line-height:1.5}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;padding:8px 12px;color:#94a3b8;border-bottom:1px solid #1e293b;font-weight:600}
td{padding:8px 12px;border-bottom:1px solid #1e293b10}
td code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:.8rem;color:#a5f3fc}
tr:hover{background:#1e293b40}
.stats{display:flex;gap:24px;margin-bottom:24px;flex-wrap:wrap}
.stat{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 24px;text-align:center;flex:1;min-width:120px}
.stat .num{font-size:1.8rem;font-weight:700;color:#60a5fa}
.stat .label{font-size:.75rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
.footer{text-align:center;margin-top:40px;color:#475569;font-size:.8rem}
.footer a{color:#60a5fa;text-decoration:none}
.pulse{display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:50%;margin-right:6px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    <h1>DealSense MCP Server</h1>
    <div class="badge"><span class="pulse"></span>Online — Model Context Protocol</div>
    <p>Connect your AI assistant to ${toolRegistry.size} institutional CRE tools — deal sourcing, PE scoring, DCF, risk analysis, mobility intelligence, and more.</p>
  </div>

  <div class="stats">
    <div class="stat"><div class="num">${toolRegistry.size}</div><div class="label">Tools</div></div>
    <div class="stat"><div class="num">5</div><div class="label">Data Sources</div></div>
    <div class="stat"><div class="num">6</div><div class="label">Categories</div></div>
    <div class="stat"><div class="num">v1.0</div><div class="label">Version</div></div>
  </div>

  <div class="card">
    <h2><span class="icon">🔌</span> Connect Your AI Client</h2>
    <div class="connect-grid">
      <div class="connect-item">
        <h3>Claude Desktop</h3>
        <code>{
  "mcpServers": {
    "dealsense": {
      "url": "${BACKEND_URL}/mcp"
    }
  }
}</code>
      </div>
      <div class="connect-item">
        <h3>Claude Code (CLI)</h3>
        <code>claude mcp add dealsense \\
  --transport http \\
  ${BACKEND_URL}/mcp</code>
      </div>
      <div class="connect-item">
        <h3>Cursor / Windsurf</h3>
        <code>{
  "mcpServers": {
    "dealsense": {
      "url": "${BACKEND_URL}/mcp"
    }
  }
}</code>
      </div>
    </div>
  </div>

  <div class="card">
    <h2><span class="icon">🛠️</span> Available Tools</h2>
    <table>
      <thead><tr><th>Tool</th><th>Category</th><th>Description</th></tr></thead>
      <tbody>
        ${toolList}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2><span class="icon">📡</span> Data Sources</h2>
    <table>
      <thead><tr><th>Source</th><th>Data</th></tr></thead>
      <tbody>
        <tr><td>CREXi, LoopNet, Brevitas</td><td>Commercial real estate listings</td></tr>
        <tr><td>FRED (Federal Reserve)</td><td>10Y Treasury, 2s10 spread, CPI YoY</td></tr>
        <tr><td>BLS (Bureau of Labor Statistics)</td><td>Metro-level unemployment</td></tr>
        <tr><td>PE Scoring Model</td><td>7-factor 100-point institutional scoring</td></tr>
        <tr><td>Mobility Intelligence (PoC)</td><td>Foot traffic, parking, road traffic heuristics + provider hooks</td></tr>
        <tr><td>Credit Database</td><td>S&P-equivalent tenant credit ratings</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    Built by <a href="https://www.linkedin.com/in/selvaonline/" target="_blank">Selvakumar Murugesan</a> &middot;
    <a href="${BACKEND_URL}">DealSense Agent</a>
  </div>
</div>
</body>
</html>`;

// ── Express Router ──────────────────────────────────────────────────────────

export const mcpRouter = Router();

// Parse JSON for MCP requests
mcpRouter.use(json());

// Handle all MCP methods on /
mcpRouter.post("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Existing session
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  // New session (initialization)
  const session = createMcpSession();

  // Connect server to transport
  await session.server.connect(session.transport);

  // Store session after transport assigns its ID
  const onSessionReady = () => {
    const sid = session.transport.sessionId;
    if (sid) {
      sessions.set(sid, session);
      console.log(`[mcp] New session: ${sid} (total: ${sessions.size})`);
    }
  };

  // Handle the initialize request
  await session.transport.handleRequest(req, res, req.body);

  // Store session by its generated ID
  onSessionReady();
});

mcpRouter.get("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Active MCP session — delegate to transport
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    return;
  }

  // Browser visit — serve a landing page
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(mcpLandingHtml);
    return;
  }

  // API/curl visit — return JSON capabilities
  res.json({
    name: "DealSense MCP Server",
    version: "1.0.0",
    protocol: "Model Context Protocol (Streamable HTTP)",
    endpoint: `${BACKEND_URL}/mcp`,
    activeSessions: sessions.size,
    tools: Array.from(toolRegistry.keys()),
    toolCount: toolRegistry.size,
    connect: {
      claude_desktop: {
        config: `Add to ~/Library/Application Support/Claude/claude_desktop_config.json`,
        example: { mcpServers: { dealsense: { url: `${BACKEND_URL}/mcp` } } },
      },
      cursor: {
        config: `Add to .cursor/mcp.json`,
        example: { mcpServers: { dealsense: { url: `${BACKEND_URL}/mcp` } } },
      },
      claude_code: `claude mcp add dealsense --transport http ${BACKEND_URL}/mcp`,
    },
  });
});

mcpRouter.delete("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
  await session.transport.close();
  await session.server.close();
  sessions.delete(sessionId);
  console.log(`[mcp] Session ended: ${sessionId} (remaining: ${sessions.size})`);
});

console.log("[mcp] DealSense MCP server route initialized");
