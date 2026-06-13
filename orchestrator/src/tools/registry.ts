// src/tools/registry.ts — Unified tool registry for the DealSense agentic system
// Wraps existing DynamicTools into RegisteredTool format with OpenAI function-calling schemas

import type { RegisteredTool, AgentContext } from "../lib/agentTypes.js";
import { webSearch } from "./search.js";
import { peScorePro } from "./peScorePro.js";
import { riskBlender } from "./riskBlender.js";
import { quickUnderwrite } from "./finance.js";
import { browseAndExtract } from "./browser.js";
import { generateIcMemo } from "../utils/memoGenerator.js";
import { computeDcf, sensitivityGrid } from "./dcfServer.js";
import {
  fred10YMoM, fred2s10, fredCpiYoY, fredUnrate,
  blsMetroUnemp, inferMetroSeriesIdFromText
} from "../infra/market.js";

// BlackRock-style tools
import { tenantCreditTool } from "./tenantCredit.js";
import { generateLoiTool } from "./generateLoi.js";
import { complianceCheckTool } from "./complianceAllocation.js";
import { portfolioVarTool } from "./portfolioVar.js";
import { riskDecompositionTool } from "./riskDecomposition.js";
import { multiAssetCompare as multiAssetCompareTool } from "./multiAssetCompare.js";
import { institutionalPipelineTool } from "./institutionalPipeline.js";
import { marketIntelTool } from "./marketIntel.js";

// Location Intelligence / Foot Traffic Agent
import { analyzeTrafficPatternsTool } from "./trafficAnalysis.js";

// ── Helper: truncate tool results for LLM context ─────────────────────────

function summarizeSearchResults(scored: any[]): any[] {
  return scored.slice(0, 10).map((s: any) => ({
    title: s.title,
    url: s.url,
    peScore: s.peScore,
    peLabel: s.peLabel,
    snippet: (s.snippet || "").slice(0, 150),
    peFactors: s.peFactors,
  }));
}

// ── Domain mapping (shared with agent.ts) ─────────────────────────────────

const DOMAIN_MAP: Record<string, string> = {
  crexi: "crexi.com",
  loopnet: "loopnet.com",
};
const ALWAYS_INCLUDED = ["brevitas.com", "commercialexchange.com", "biproxi.com"];

function buildDomains(ctx: AgentContext): string[] {
  if (ctx?.dataSources?.enabledDomains) {
    const userDomains = ctx.dataSources.enabledDomains
      .filter(id => DOMAIN_MAP[id])
      .map(id => DOMAIN_MAP[id]);
    return [...userDomains, ...ALWAYS_INCLUDED];
  }
  return [...Object.values(DOMAIN_MAP), ...ALWAYS_INCLUDED];
}

// ── Fetch all macro data ──────────────────────────────────────────────────

export async function fetchMacroData(metro?: string, ctx?: AgentContext) {
  const fredEnabled = !ctx?.dataSources || ctx.dataSources.enabledDomains.includes("fred");
  const blsEnabled = !ctx?.dataSources || ctx.dataSources.enabledDomains.includes("bls");
  const fredKey = ctx?.dataSources?.apiKeys?.fred || process.env.FRED_API_KEY;
  const blsKey = ctx?.dataSources?.apiKeys?.bls || process.env.BLS_API_KEY;

  const nullFred = { value: null, deltaBps: null, date: null };
  const nullBls = { latestRate: null, yoyDelta: null, period: null, seriesId: null };

  const metroSeries = metro ? inferMetroSeriesIdFromText(metro) : null;

  const [tenYData, curve2s10, cpiYoY, nationalUnemp, bls] = await Promise.all([
    fredEnabled ? fred10YMoM(fredKey) : nullFred,
    fredEnabled ? fred2s10(fredKey) : null,
    fredEnabled ? fredCpiYoY(fredKey) : null,
    fredEnabled ? fredUnrate(fredKey) : null,
    (blsEnabled && metroSeries) ? blsMetroUnemp(metroSeries, blsKey) : nullBls,
  ]);

  return { tenYData, curve2s10, cpiYoY, nationalUnemp, bls, metroSeries };
}

/**
 * Market-wide risk score (0-100) from live macro data, via riskBlender.
 * The underlying FRED/BLS series are cached (12-24h) in infra/market.ts, so
 * calling this repeatedly within a run does not re-hit the APIs and is
 * deterministic — every deal-emitting tool gets the SAME number. Returns null
 * when no macro data is available (e.g. FRED key missing) so callers can avoid
 * fabricating a neutral 50.
 */
export async function getMarketRisk(query: string, ctx?: AgentContext): Promise<number | null> {
  try {
    const macro = await fetchMacroData(query, ctx);
    const r = JSON.parse(String(await riskBlender.invoke(JSON.stringify({
      query,
      data: {
        treasury10yBps: macro.tenYData.value != null ? Math.round(macro.tenYData.value * 10000) : null,
        treasury10yDeltaBps: macro.tenYData.deltaBps,
        curve2s10: macro.curve2s10,
        cpiYoY: macro.cpiYoY,
        bls: macro.bls,
        nationalUnemp: macro.nationalUnemp,
      }
    }))));
    return r.riskScore ?? null;
  } catch (err) {
    console.warn("[getMarketRisk] computation failed:", err);
    return null;
  }
}

// ── Tool Definitions ──────────────────────────────────────────────────────

const searchProperties: RegisteredTool = {
  category: "search",
  estimatedDurationMs: 5000,
  schema: {
    name: "search_properties",
    description: "Search commercial real estate listings across CREXi, LoopNet, Brevitas, and other CRE marketplaces. Returns PE-scored and ranked results. Call this when the user asks to find, search, or discover properties.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query. Include property type, location, tenant, size, cap rate range as needed." },
        maxResults: { type: "number", description: "Max results to return (default 20, max 30)" },
      },
      required: ["query"],
    },
  },
  execute: async (args, ctx) => {
    const { query, maxResults = 20 } = args;
    const domains = buildDomains(ctx);
    const mdQuery = `${query} (${domains.map(d => ` site:${d}`).join(" OR ")}) "for sale" -filetype:pdf -site:images.loopnet.com`;

    ctx.pub?.("thinking", { text: "Searching commercial real estate listings..." });

    const rawResults = JSON.parse(String(await webSearch.invoke(JSON.stringify({
      query: mdQuery, preferCrexi: false, maxResults, timeoutMs: 10000
    })))) as Array<{ title: string; url: string; snippet: string }>;

    ctx.pub?.("thinking", { text: `Found ${rawResults.length} results. Applying PE scoring model...` });

    const scored = JSON.parse(String(await peScorePro.invoke(JSON.stringify({
      rows: rawResults, query,
      ...(ctx.orgSettings?.peWeights ? { peWeights: ctx.orgSettings.peWeights } : {}),
    })))) as any[];

    // Market-wide risk so the Screening Summary shows a real number even when the
    // Risk Analyst specialist isn't invoked. Macro series are cached, so this is
    // cheap and deterministic across tools (see getMarketRisk).
    const marketRisk = scored.length ? await getMarketRisk(query, ctx) : null;

    // Emit source_found for each result (legacy compat)
    scored.slice(0, 10).forEach((s: any, i: number) => {
      ctx.pub?.("source_found", {
        source: { id: i + 1, title: s.title, url: s.url, snippet: s.snippet, score: s.peScore, riskScore: marketRisk }
      });
    });

    // Push to deal accumulator if available
    if (ctx._dealAccumulator) {
      for (const s of scored.slice(0, 5)) {
        ctx._dealAccumulator.push({
          title: s.title,
          url: s.url,
          source: (() => { try { return new URL(s.url).hostname; } catch { return null; } })(),
          address: null,
          askingPrice: s.peSignals?.price || null,
          noi: s.peSignals?.noi || null,
          capRate: s.peSignals?.cap || null,
          riskScore: marketRisk,
          raw: { peScore: s.peScore, peLabel: s.peLabel, peFactors: s.peFactors, riskScore: marketRisk },
        });
      }
    }

    return { scored: summarizeSearchResults(scored), rawCount: rawResults.length, query };
  },
};

const scoreDeals: RegisteredTool = {
  category: "analysis",
  estimatedDurationMs: 1000,
  schema: {
    name: "score_deals",
    description: "Apply DealSense PE scoring model to a list of search result rows. Use this after search_properties if you need to re-score with different criteria.",
    parameters: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          description: "Array of {title, url, snippet} objects",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Listing title" },
              url: { type: "string", description: "Listing URL" },
              snippet: { type: "string", description: "Listing description/snippet" },
            },
          },
        },
        query: { type: "string", description: "Original query for context" },
      },
      required: ["rows"],
    },
  },
  execute: async (args, ctx) => {
    const scored = JSON.parse(String(await peScorePro.invoke(JSON.stringify({
      ...args,
      ...(ctx.orgSettings?.peWeights ? { peWeights: ctx.orgSettings.peWeights } : {}),
    }))));
    // Carry the market risk through re-scoring so it isn't dropped vs search_properties.
    const marketRisk = await getMarketRisk(args.query || "", ctx);
    return { scored: summarizeSearchResults(scored), marketRisk };
  },
};

const assessRisk: RegisteredTool = {
  category: "market",
  estimatedDurationMs: 3000,
  schema: {
    name: "assess_risk",
    description: "Compute a 0-100 Market Risk Score using live FRED Treasury data, CPI, yield curve, and BLS metro unemployment. Call this when macro context is needed for a recommendation.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Property search query or location context" },
        forceMetro: { type: "string", description: "Specific metro name to look up, e.g. 'Dallas' or 'Miami'" },
      },
      required: ["query"],
    },
  },
  execute: async (args, ctx) => {
    const { query, forceMetro } = args;
    const metroText = forceMetro || query;
    const macro = await fetchMacroData(metroText, ctx);

    const riskResult = JSON.parse(String(await riskBlender.invoke(JSON.stringify({
      query,
      data: {
        treasury10yBps: macro.tenYData.value != null ? Math.round(macro.tenYData.value * 10000) : null,
        treasury10yDeltaBps: macro.tenYData.deltaBps,
        curve2s10: macro.curve2s10,
        cpiYoY: macro.cpiYoY,
        bls: macro.bls,
        nationalUnemp: macro.nationalUnemp,
      }
    }))));

    return {
      riskScore: riskResult.riskScore,
      riskNote: riskResult.riskNote,
      riskFactors: riskResult.riskFactors,
      macro: {
        treasury10y: macro.tenYData.value != null ? `${(macro.tenYData.value * 100).toFixed(2)}%` : "N/A",
        deltaBps: macro.tenYData.deltaBps,
        curve2s10: macro.curve2s10 != null ? `${(macro.curve2s10 * 100).toFixed(1)}%` : "N/A",
        cpiYoY: macro.cpiYoY != null ? `${(macro.cpiYoY * 100).toFixed(1)}%` : "N/A",
        unemployment: macro.bls?.latestRate?.toFixed(1) || (macro.nationalUnemp != null ? `${(macro.nationalUnemp * 100).toFixed(1)}% (national)` : "N/A"),
      },
    };
  },
};

const getMacroData: RegisteredTool = {
  category: "market",
  estimatedDurationMs: 2000,
  schema: {
    name: "get_macro_data",
    description: "Fetch raw macro-economic data for a metro market: 10Y Treasury, 2s10 curve, CPI YoY, national unemployment, and metro unemployment. Use when you need raw numbers rather than a blended risk score.",
    parameters: {
      type: "object",
      properties: {
        metro: { type: "string", description: "Metro name, e.g. 'Dallas', 'Miami', 'Austin'" },
      },
    },
  },
  execute: async (args, ctx) => {
    const macro = await fetchMacroData(args.metro, ctx);
    return {
      treasury10y: macro.tenYData,
      curve2s10: macro.curve2s10,
      cpiYoY: macro.cpiYoY,
      nationalUnemp: macro.nationalUnemp,
      metroUnemp: macro.bls,
    };
  },
};

const analyzePropertyUrl: RegisteredTool = {
  category: "search",
  estimatedDurationMs: 30000,
  schema: {
    name: "analyze_property_url",
    description: "Extract full property details from a CREXi or LoopNet listing URL using a headless browser. Returns address, price, NOI, cap rate, tenant info, and a screenshot. Only call this for direct property URLs.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Direct property listing URL" },
      },
      required: ["url"],
    },
  },
  execute: async (args, ctx) => {
    // Respect SKIP_EXTRACTION
    if (String(process.env.SKIP_EXTRACTION || "true").toLowerCase() === "true") {
      return { skipped: true, reason: "Browser extraction is disabled (SKIP_EXTRACTION=true). Use search_properties for PE-scored results." };
    }

    const { url } = args;
    ctx.pub?.("nav", { url, label: "Opening page..." });

    const extJson = await browseAndExtract.invoke(JSON.stringify({ url }));
    const ext = JSON.parse(String(extJson));

    if (ext?.blocked || /access denied/i.test(ext?.title || "")) {
      return { blocked: true, url };
    }

    const uwJson = await quickUnderwrite.invoke(JSON.stringify({
      noi: ext.noi, price: ext.askingPrice
    }));
    const uw = JSON.parse(String(uwJson));

    // Emit legacy events
    if (ext.screenshotBase64) {
      ctx.pub?.("shot", { label: "Detail page", b64: ext.screenshotBase64 });
    }
    ctx.pub?.("extracted", {
      summary: { title: ext.title, address: ext.address, price: ext.askingPrice, noi: ext.noi, cap: ext.capRate ?? uw.capRate },
    });

    // Per-deal risk when we have financials (price + NOI), else the market
    // baseline. risk_decomposition is pure/synchronous and returns a deal-specific
    // totalRisk (tenant/market/rate/inflation factors); this is genuine per-deal
    // risk rather than the one-size-fits-all market number.
    let riskScore: number | null = null;
    if (ext.askingPrice && ext.noi) {
      try {
        const rd: any = await riskDecompositionTool.execute(
          { purchasePrice: ext.askingPrice, noi: ext.noi, market: ext.address || undefined },
          ctx
        );
        if (typeof rd?.totalRisk === "number") riskScore = rd.totalRisk;
      } catch { /* fall through to market baseline */ }
    }
    if (riskScore == null) {
      riskScore = await getMarketRisk(ext.address || ext.title || "", ctx);
    }

    const deal = {
      title: ext.title,
      url: ext.finalUrl || url,
      source: (() => { try { return new URL(ext.finalUrl || url).hostname; } catch { return null; } })(),
      address: ext.address,
      askingPrice: ext.askingPrice,
      noi: ext.noi,
      capRate: ext.capRate ?? uw.capRate,
      riskScore,
      screenshotBase64: ext.screenshotBase64,
      underwrite: uw,
    };

    ctx._dealAccumulator?.push(deal);
    ctx.pub?.("deal_found", { deal, count: ctx._dealAccumulator?.length || 1 });

    return {
      title: ext.title,
      address: ext.address,
      askingPrice: ext.askingPrice,
      noi: ext.noi,
      capRate: ext.capRate ?? uw.capRate,
      dscr: uw.dscr,
      url: ext.finalUrl || url,
    };
  },
};

const runDcf: RegisteredTool = {
  category: "analysis",
  estimatedDurationMs: 100,
  schema: {
    name: "run_dcf",
    description: "Run a server-side discounted cash flow analysis. Computes IRR, equity multiple, cash-on-cash, and annual cash flows for a hold period. Use when the user asks for DCF, returns, or valuation.",
    parameters: {
      type: "object",
      properties: {
        purchasePrice: { type: "number", description: "Purchase price in dollars" },
        noi: { type: "number", description: "Annual Net Operating Income in dollars" },
        ltv: { type: "number", description: "Loan-to-value ratio, e.g. 0.65 (default: 0.65)" },
        interestRate: { type: "number", description: "Annual interest rate, e.g. 0.055 (default: 0.055)" },
        holdYears: { type: "number", description: "Hold period in years (default: 5)" },
        noiGrowth: { type: "number", description: "Annual NOI growth rate, e.g. 0.02 (default: 0.02)" },
        exitCapSpread: { type: "number", description: "Exit cap rate spread over entry, e.g. 0.005 (default: 0.005)" },
      },
      required: ["purchasePrice", "noi"],
    },
  },
  execute: async (args) => {
    const result = computeDcf(args);
    if (!result) return { error: "Could not compute DCF — invalid price or NOI" };

    return {
      irr: `${(result.irr * 100).toFixed(1)}%`,
      equityMultiple: `${result.equityMultiple.toFixed(2)}x`,
      cashOnCash: `${(result.cashOnCash * 100).toFixed(1)}%`,
      equity: result.equity,
      loanAmount: result.loanAmount,
      annualDebtService: result.annualDebtService,
      cashFlows: result.cashFlows.map(cf => Math.round(cf)),
      exitValue: Math.round(result.exitValue),
      saleProceeds: Math.round(result.saleProceeds),
      totalReturn: Math.round(result.totalReturn),
    };
  },
};

const generateMemo: RegisteredTool = {
  category: "document",
  estimatedDurationMs: 500,
  schema: {
    name: "generate_memo",
    description: "Generate a professional Investment Committee memorandum for a specific property.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Property title" },
        url: { type: "string", description: "Listing URL" },
        peScore: { type: "number", description: "PE score 0-100" },
        peTier: { type: "string", description: "PE tier label" },
        riskScore: { type: "number", description: "Risk score 0-100" },
        riskNote: { type: "string", description: "Risk summary note" },
        snippet: { type: "string", description: "Property description" },
      },
      required: ["title", "url"],
    },
  },
  execute: async (args) => {
    const memo = generateIcMemo({
      title: args.title,
      url: args.url,
      pe: { score: args.peScore, tier: args.peTier },
      risk: { score: args.riskScore, note: args.riskNote },
      snippet: args.snippet,
    });
    return { memo };
  },
};

const compAnalysis: RegisteredTool = {
  category: "search",
  estimatedDurationMs: 8000,
  schema: {
    name: "comp_analysis",
    description: "Find comparable properties (comps) in the same market, property type, and size range as a subject property. Returns 5-10 comps with PE scores for benchmarking.",
    parameters: {
      type: "object",
      properties: {
        market: { type: "string", description: "City/metro, e.g. 'Dallas, TX'" },
        propertyType: { type: "string", description: "E.g. 'industrial', 'NNN retail', 'medical office'" },
        subjectTitle: { type: "string", description: "Title of subject property for context" },
      },
      required: ["market", "propertyType"],
    },
  },
  execute: async (args, ctx) => {
    const { market, propertyType, subjectTitle } = args;
    const domains = buildDomains(ctx);
    const compQuery = `${propertyType} for sale ${market} (${domains.map(d => ` site:${d}`).join(" OR ")}) -filetype:pdf`;

    ctx.pub?.("thinking", { text: `Searching for comparable ${propertyType} properties in ${market}...` });

    const rawResults = JSON.parse(String(await webSearch.invoke(JSON.stringify({
      query: compQuery, maxResults: 15, timeoutMs: 10000
    }))));

    const scored = JSON.parse(String(await peScorePro.invoke(JSON.stringify({
      rows: rawResults, query: `${propertyType} ${market}`,
      ...(ctx.orgSettings?.peWeights ? { peWeights: ctx.orgSettings.peWeights } : {}),
    }))));

    const comps = scored.slice(0, 10).map((s: any) => ({
      title: s.title,
      url: s.url,
      peScore: s.peScore,
      peLabel: s.peLabel,
      capRate: s.peSignals?.cap,
      snippet: (s.snippet || "").slice(0, 150),
    }));

    const avgScore = comps.length > 0 ? Math.round(comps.reduce((a: number, c: any) => a + c.peScore, 0) / comps.length) : 0;

    return {
      market,
      propertyType,
      subjectTitle,
      compCount: comps.length,
      avgPeScore: avgScore,
      comps,
    };
  },
};

const filterAndRank: RegisteredTool = {
  category: "analysis",
  estimatedDurationMs: 100,
  schema: {
    name: "filter_and_rank",
    description: "Apply filters to a set of deals already in session context. E.g. 'show only deals in Texas with PE score above 75'. Returns the filtered + sorted subset.",
    parameters: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "Natural language filter/sort instruction" },
        minPeScore: { type: "number", description: "Minimum PE score threshold" },
        maxRiskScore: { type: "number", description: "Maximum risk score threshold" },
        location: { type: "string", description: "Filter by location keyword" },
        propertyType: { type: "string", description: "Filter by property type keyword" },
        sortBy: { type: "string", description: "Sort field: peScore, riskScore, capRate, price", enum: ["peScore", "riskScore", "capRate", "price"] },
      },
      required: ["instruction"],
    },
  },
  execute: async (args, ctx) => {
    const deals = ctx.session?.context?.scored || ctx.session?.context?.currentDeals || [];
    if (deals.length === 0) {
      return { error: "No deals in session context to filter. Run a search first." };
    }

    let filtered = [...deals];

    if (args.minPeScore) filtered = filtered.filter((d: any) => (d.peScore || 0) >= args.minPeScore);
    if (args.maxRiskScore) filtered = filtered.filter((d: any) => (d.riskScore || 100) <= args.maxRiskScore);
    if (args.location) {
      const loc = args.location.toLowerCase();
      filtered = filtered.filter((d: any) =>
        `${d.title} ${d.snippet} ${d.address || ""}`.toLowerCase().includes(loc)
      );
    }
    if (args.propertyType) {
      const pt = args.propertyType.toLowerCase();
      filtered = filtered.filter((d: any) =>
        `${d.title} ${d.snippet}`.toLowerCase().includes(pt)
      );
    }
    if (args.sortBy) {
      filtered.sort((a: any, b: any) => {
        const av = a[args.sortBy] || 0;
        const bv = b[args.sortBy] || 0;
        return args.sortBy === "riskScore" || args.sortBy === "price" ? av - bv : bv - av;
      });
    }

    return {
      instruction: args.instruction,
      originalCount: deals.length,
      filteredCount: filtered.length,
      deals: filtered.slice(0, 10).map((d: any) => ({
        title: d.title, url: d.url, peScore: d.peScore,
        snippet: (d.snippet || "").slice(0, 100),
      })),
    };
  },
};

const marketDeepDive: RegisteredTool = {
  category: "market",
  estimatedDurationMs: 6000,
  schema: {
    name: "market_deep_dive",
    description: "Fetch comprehensive market intelligence for a specific metro: Treasury context, metro unemployment (BLS), and investment activity summary. Use for market-level analysis.",
    parameters: {
      type: "object",
      properties: {
        metro: { type: "string", description: "Metro name, e.g. 'Austin TX' or 'South Florida'" },
        propertyType: { type: "string", description: "Optional: focus analysis on specific asset class" },
      },
      required: ["metro"],
    },
  },
  execute: async (args, ctx) => {
    const { metro, propertyType } = args;

    ctx.pub?.("thinking", { text: `Analyzing market conditions for ${metro}...` });

    // Fetch macro data
    const macro = await fetchMacroData(metro, ctx);

    // Risk score for this metro
    const riskResult = JSON.parse(String(await riskBlender.invoke(JSON.stringify({
      query: `${propertyType || "commercial real estate"} ${metro}`,
      data: {
        treasury10yBps: macro.tenYData.value != null ? Math.round(macro.tenYData.value * 10000) : null,
        treasury10yDeltaBps: macro.tenYData.deltaBps,
        curve2s10: macro.curve2s10,
        cpiYoY: macro.cpiYoY,
        bls: macro.bls,
        nationalUnemp: macro.nationalUnemp,
      }
    }))));

    // Search for recent market activity
    const domains = buildDomains(ctx);
    const activityQuery = `${propertyType || "commercial"} real estate market ${metro} (${domains.map(d => ` site:${d}`).join(" OR ")}) -filetype:pdf`;
    const activityResults = JSON.parse(String(await webSearch.invoke(JSON.stringify({
      query: activityQuery, maxResults: 5, timeoutMs: 8000
    }))));

    return {
      metro,
      propertyType: propertyType || "all",
      riskScore: riskResult.riskScore,
      riskNote: riskResult.riskNote,
      macro: {
        treasury10y: macro.tenYData.value != null ? `${(macro.tenYData.value * 100).toFixed(2)}%` : "N/A",
        deltaBps: macro.tenYData.deltaBps,
        curve2s10: macro.curve2s10 != null ? `${(macro.curve2s10 * 100).toFixed(1)}%` : "N/A",
        cpiYoY: macro.cpiYoY != null ? `${(macro.cpiYoY * 100).toFixed(1)}%` : "N/A",
        metroUnemployment: macro.bls?.latestRate?.toFixed(1) || "N/A",
        nationalUnemployment: macro.nationalUnemp != null ? `${(macro.nationalUnemp * 100).toFixed(1)}%` : "N/A",
      },
      recentActivity: activityResults.slice(0, 5).map((r: any) => ({
        title: r.title, url: r.url, snippet: (r.snippet || "").slice(0, 120),
      })),
    };
  },
};

const portfolioReview: RegisteredTool = {
  category: "portfolio",
  estimatedDurationMs: 500,
  schema: {
    name: "portfolio_review",
    description: "Analyze the user's saved portfolio properties from session memory. Identify geographic concentration, asset type gaps, risk distribution, and suggest diversification opportunities.",
    parameters: {
      type: "object",
      properties: {
        focus: { type: "string", description: "What aspect to focus on: 'concentration', 'risk', 'yield', 'diversification'" },
      },
    },
  },
  execute: async (args, ctx) => {
    const portfolio = ctx.session?.portfolio || [];
    if (portfolio.length === 0) {
      return { error: "No saved properties in portfolio. Save some properties first." };
    }

    const markets = portfolio.reduce((acc: Record<string, number>, p) => {
      const m = p.market || "Unknown";
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});

    const types = portfolio.reduce((acc: Record<string, number>, p) => {
      const t = p.assetType || "Unknown";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const scores = portfolio.filter(p => p.peScore).map(p => p.peScore!);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    return {
      totalProperties: portfolio.length,
      avgPeScore: avgScore,
      marketDistribution: markets,
      typeDistribution: types,
      properties: portfolio.map(p => ({
        title: p.title, url: p.url, peScore: p.peScore, market: p.market,
      })),
      focus: args.focus,
    };
  },
};

// ── CRE tool collection ───────────────────────────────────────────────────
// Tool keys are schema.name; registration into the platform registry happens
// via loadPack(crePack) at bootstrap (src/bootstrap.ts).

export const creTools: RegisteredTool[] = [
  searchProperties,
  scoreDeals,
  assessRisk,
  getMacroData,
  analyzePropertyUrl,
  runDcf,
  generateMemo,
  compAnalysis,
  filterAndRank,
  marketDeepDive,
  portfolioReview,
  // BlackRock-style institutional tools
  tenantCreditTool,
  generateLoiTool,
  complianceCheckTool,
  portfolioVarTool,
  riskDecompositionTool,
  multiAssetCompareTool,
  institutionalPipelineTool,
  marketIntelTool,
  // Location Intelligence / Foot Traffic Agent
  analyzeTrafficPatternsTool,
];

// Back-compat re-exports: existing consumers (agentLoop, supervisor,
// routes/tools, routes/mcp) keep importing from this module; the actual
// registry now lives in the platform core and is populated at bootstrap.
export { toolRegistry, getOpenAITools } from "../platform/registry.js";
