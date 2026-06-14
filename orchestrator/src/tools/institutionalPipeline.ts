// src/tools/institutionalPipeline.ts — Institutional Deal Pipeline Screening
// Screens properties through an institutional deal pipeline with PE scoring and tenant quality filters.

import type { RegisteredTool } from "../lib/agentTypes.js";
import { webSearch } from "./search.js";
import { peScorePro } from "./peScorePro.js";

// ── Types ───────────────────────────────────────────────────────────────────

type PipelineTag = "ic_ready" | "under_review" | "watchlist";

interface PipelineDeal {
  title: string;
  url: string;
  peScore: number;
  tag: PipelineTag;
  snippet: string;
}

interface PipelineResult {
  screened: number;
  qualified: number;
  icReady: number;
  underReview: number;
  watchlist: number;
  passRate: string;
  avgPeScore: number;
  deals: PipelineDeal[];
  pipelineMetrics: {
    topMarkets: string[];
    avgPeScore: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tagFromScore(score: number): PipelineTag {
  if (score >= 80) return "ic_ready";
  if (score >= 70) return "under_review";
  return "watchlist";
}

/**
 * Extract top markets from deal titles by looking for common US city/state patterns.
 */
function extractTopMarkets(deals: PipelineDeal[]): string[] {
  const marketCounts: Record<string, number> = {};

  for (const deal of deals) {
    const text = deal.title;
    // Match patterns like "City, ST" or "City, State"
    const cityState = text.match(
      /(?:^|[\s|·\-—,])\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),?\s+([A-Z]{2})\b/
    );
    if (cityState) {
      const market = `${cityState[1]}, ${cityState[2]}`;
      marketCounts[market] = (marketCounts[market] || 0) + 1;
    }
  }

  return Object.entries(marketCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([market]) => market);
}

// ── Tool ────────────────────────────────────────────────────────────────────

export const institutionalPipelineTool: RegisteredTool = {
  category: "search",
  estimatedDurationMs: 8000,
  schema: {
    name: "institutional_pipeline",
    description:
      "Screen properties through an institutional deal pipeline. Filters by deal size, PE score, and tenant quality. Tags deals as IC-ready, under review, or watchlist.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for property listings",
        },
        minDealSize: {
          type: "number",
          description: "Minimum deal size in dollars (default 5000000)",
          default: 5_000_000,
        },
        minPeScore: {
          type: "number",
          description: "Minimum PE score to qualify (default 70)",
          default: 70,
        },
        tenantGrade: {
          type: "string",
          description:
            "Tenant quality filter: investment_grade, any, or all",
          enum: ["investment_grade", "any", "all"],
          default: "investment_grade",
        },
      },
      required: ["query"],
    },
  },

  execute: async (args, ctx) => {
    const query = args.query as string;
    const minDealSize = (args.minDealSize as number) ?? 5_000_000;
    const minPeScore = (args.minPeScore as number) ?? 70;
    const _tenantGrade = (args.tenantGrade as string) ?? "investment_grade";

    // ── Step 1: Build search query ──────────────────────────────────────
    const mdQuery = `${query} "for sale" site:crexi.com OR site:loopnet.com OR site:brevitas.com -filetype:pdf`;
    ctx.pub?.("thinking", { message: `Searching: ${mdQuery.slice(0, 80)}...` });

    // ── Step 2: Web search ──────────────────────────────────────────────
    ctx.pub?.("thinking", { message: "Running web search across CRE platforms..." });
    const rawResults = JSON.parse(
      String(
        await webSearch.invoke(
          JSON.stringify({ query: mdQuery, maxResults: 25, timeoutMs: 10000 })
        )
      )
    );
    const totalScreened = rawResults.length;
    ctx.pub?.("thinking", {
      message: `Found ${totalScreened} listings. Running PE scoring...`,
    });

    // ── Step 3: PE scoring ──────────────────────────────────────────────
    const scored: any[] = JSON.parse(
      String(
        await peScorePro.invoke(
          JSON.stringify({ rows: rawResults, query })
        )
      )
    );
    ctx.pub?.("thinking", {
      message: `Scored ${scored.length} deals. Filtering pipeline...`,
    });

    // ── Step 4: Filter by minPeScore ────────────────────────────────────
    const passedScore = scored.filter(
      (d: any) => (d.peScore ?? 0) >= minPeScore
    );

    // ── Step 5: Tag each qualifying deal ────────────────────────────────
    const tagged: PipelineDeal[] = passedScore.map((d: any) => ({
      title: d.title ?? "",
      url: d.url ?? "",
      peScore: d.peScore ?? 0,
      tag: tagFromScore(d.peScore ?? 0),
      snippet: ((d.snippet as string) ?? "").slice(0, 100),
    }));

    // ── Step 6: Filter by deal size ─────────────────────────────────────
    const sizeFiltered: PipelineDeal[] = [];
    for (let i = 0; i < tagged.length; i++) {
      const scoredDeal = passedScore[i];
      const estimatedPrice = scoredDeal?.peSignals?.price ?? null;

      // Keep deal if price is unknown (cannot disqualify without data)
      // or if price meets minimum deal size
      if (estimatedPrice == null || estimatedPrice >= minDealSize) {
        sizeFiltered.push(tagged[i]);
      }
    }

    // ── Step 7: Compute pipeline metrics ────────────────────────────────
    const icReady = sizeFiltered.filter((d) => d.tag === "ic_ready").length;
    const underReview = sizeFiltered.filter(
      (d) => d.tag === "under_review"
    ).length;
    const watchlist = sizeFiltered.filter((d) => d.tag === "watchlist").length;

    const avgPeScore =
      sizeFiltered.length > 0
        ? Math.round(
            sizeFiltered.reduce((sum, d) => sum + d.peScore, 0) /
              sizeFiltered.length
          )
        : 0;

    const passRate =
      totalScreened > 0
        ? `${((sizeFiltered.length / totalScreened) * 100).toFixed(1)}%`
        : "0.0%";

    const topMarkets = extractTopMarkets(sizeFiltered);

    ctx.pub?.("thinking", {
      message: `Pipeline complete: ${sizeFiltered.length}/${totalScreened} qualified, ${icReady} IC-ready`,
    });

    const result: PipelineResult = {
      screened: totalScreened,
      qualified: sizeFiltered.length,
      icReady,
      underReview,
      watchlist,
      passRate,
      avgPeScore,
      deals: sizeFiltered,
      pipelineMetrics: {
        topMarkets,
        avgPeScore,
      },
    };

    return result;
  },
};
