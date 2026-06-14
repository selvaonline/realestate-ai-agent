// src/tools/marketIntel.ts — Comprehensive market intelligence via web search
// Gathers construction pipeline, absorption/vacancy, rent growth, demographics,
// and cap rate trend data for a given US metro area.

import type { RegisteredTool } from "../lib/agentTypes.js";
import { webSearch } from "./search.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface IntelSnippet {
  title: string;
  snippet: string;
}

/** Extract top N results, trimming snippets to maxLen characters. */
function extractTop(
  results: SearchResult[],
  count = 3,
  maxLen = 120,
): IntelSnippet[] {
  return results.slice(0, count).map((r) => ({
    title: r.title,
    snippet: r.snippet.length > maxLen ? r.snippet.slice(0, maxLen) + "..." : r.snippet,
  }));
}

/** Run a single web search and parse the JSON result. */
async function runSearch(query: string): Promise<SearchResult[]> {
  const raw = await webSearch.invoke(
    JSON.stringify({ query, maxResults: 5, timeoutMs: 8000 }),
  );
  return JSON.parse(String(raw)) as SearchResult[];
}

// ── Tool ─────────────────────────────────────────────────────────────────────

export const marketIntelTool: RegisteredTool = {
  category: "market",
  estimatedDurationMs: 10_000,
  schema: {
    name: "market_intel",
    description:
      "Gather comprehensive market intelligence for a US metro: construction pipeline, absorption/vacancy, rent growth, demographics, and cap rate trends via targeted web searches.",
    parameters: {
      type: "object",
      properties: {
        metro: {
          type: "string",
          description: 'Metro name, e.g. "Austin TX", "Miami"',
        },
        propertyType: {
          type: "string",
          description:
            'Property type focus, e.g. "industrial", "NNN retail"',
        },
      },
      required: ["metro"],
    },
  },

  execute: async (args, ctx) => {
    const { metro, propertyType } = args as {
      metro: string;
      propertyType?: string;
    };
    const pt = propertyType || "";
    const ptOrDefault = propertyType || "commercial";

    ctx.pub?.("thinking", {
      message: `Gathering market intelligence for ${metro}${pt ? ` (${pt})` : ""}...`,
    });

    // ── 1. Fire five parallel web searches ────────────────────────────────

    ctx.pub?.("thinking", {
      message: `Running 5 parallel market searches for ${metro}...`,
    });

    const [
      constructionResults,
      absorptionResults,
      rentResults,
      demographicResults,
      capRateResults,
    ] = await Promise.all([
      runSearch(`${metro} commercial ${pt} construction pipeline permits 2025 2026`),
      runSearch(`${metro} ${ptOrDefault} absorption rate vacancy`),
      runSearch(`${metro} commercial rent growth trends`),
      runSearch(`${metro} population growth employment trends`),
      runSearch(`${metro} ${pt} cap rate trends`),
    ]);

    ctx.pub?.("thinking", {
      message: `Compiling market intelligence report for ${metro}...`,
    });

    // ── 2. Extract top 3 from each category ───────────────────────────────

    const constructionPipeline = extractTop(constructionResults);
    const absorptionVacancy = extractTop(absorptionResults);
    const rentGrowth = extractTop(rentResults);
    const demographics = extractTop(demographicResults);
    const capRateTrends = extractTop(capRateResults);

    // ── 3. Build a brief summary from the top results ─────────────────────

    const summaryParts: string[] = [];

    if (constructionPipeline.length > 0) {
      summaryParts.push(
        `Construction: ${constructionPipeline[0].snippet}`,
      );
    }
    if (absorptionVacancy.length > 0) {
      summaryParts.push(
        `Absorption/Vacancy: ${absorptionVacancy[0].snippet}`,
      );
    }
    if (capRateTrends.length > 0) {
      summaryParts.push(`Cap Rates: ${capRateTrends[0].snippet}`);
    }

    const summary =
      summaryParts.length > 0
        ? summaryParts.join(" | ")
        : `Market intelligence gathered for ${metro} across 5 categories; review individual sections for details.`;

    // ── 4. Return categorized report ──────────────────────────────────────

    return {
      metro,
      propertyType: propertyType || "commercial",
      constructionPipeline,
      absorptionVacancy,
      rentGrowth,
      demographics,
      capRateTrends,
      summary,
    };
  },
};
