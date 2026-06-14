// src/tools/multiAssetCompare.ts
// Compare CRE deal returns against other asset classes with risk-adjusted metrics
import type { RegisteredTool } from "../lib/agentTypes.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function sharpe(ret: number, riskFree: number, vol: number): number {
  return Math.round(((ret - riskFree) / vol) * 100) / 100;
}

function ratingFromSharpe(s: number): string {
  if (s > 1.0) return "Excellent";
  if (s > 0.5) return "Good";
  if (s > 0.2) return "Fair";
  return "Poor";
}

// ── Tool Definition ──────────────────────────────────────────────────────────

export const multiAssetCompare: RegisteredTool = {
  category: "analysis",
  estimatedDurationMs: 200,
  schema: {
    name: "multi_asset_compare",
    description:
      "Compare a CRE deal's returns against Treasury bonds, S&P 500, REIT index, and private CRE benchmarks. Computes risk-adjusted returns (Sharpe ratio) for each asset class.",
    parameters: {
      type: "object",
      properties: {
        creIrr: {
          type: "number",
          description:
            "The CRE deal's IRR as a decimal (e.g., 0.12 for 12%)",
        },
        creEquityMultiple: {
          type: "number",
          description: "Equity multiple from DCF (e.g., 1.85)",
        },
        holdYears: {
          type: "number",
          description: "Hold period in years (default 5)",
        },
        riskScore: {
          type: "number",
          description: "Risk score 0-100 from assess_risk",
        },
        treasury10y: {
          type: "number",
          description: "Current 10Y Treasury yield as decimal (default 0.043)",
        },
      },
      required: ["creIrr"],
    },
  },

  execute: async (args) => {
    const {
      creIrr,
      creEquityMultiple,
      holdYears = 5,
      riskScore,
      treasury10y = 0.043,
    } = args;

    const riskFree = treasury10y;

    // ── Historical benchmarks ──────────────────────────────────────────────
    const benchmarks = [
      { asset: "S&P 500",                expectedReturn: 0.105, volatility: 0.16 },
      { asset: "REIT Index",             expectedReturn: 0.092, volatility: 0.18 },
      { asset: "Private CRE",            expectedReturn: 0.09,  volatility: 0.12 },
      { asset: "Investment Grade Bonds",  expectedReturn: 0.055, volatility: 0.06 },
      { asset: `10Y Treasury`,           expectedReturn: riskFree, volatility: 0.0 },
    ];

    // ── CRE deal volatility (adjusted by risk score) ───────────────────────
    let creVolatility = 0.14;
    if (riskScore != null) {
      if (riskScore > 60) creVolatility += 0.02;
      else if (riskScore < 30) creVolatility -= 0.02;
    }

    // ── CRE return metrics ─────────────────────────────────────────────────
    const creSharpe = sharpe(creIrr, riskFree, creVolatility);
    const creRating = ratingFromSharpe(creSharpe);

    const creReturn: Record<string, any> = {
      irr: pct(creIrr),
      sharpe: creSharpe,
      volatility: pct(creVolatility),
      rating: creRating,
    };
    if (creEquityMultiple != null) {
      creReturn.equityMultiple = `${creEquityMultiple.toFixed(2)}x`;
    }

    // ── Comparison table ───────────────────────────────────────────────────
    const comparisonTable = benchmarks.map((b) => {
      // Treasury has zero volatility — Sharpe is not meaningful
      if (b.volatility === 0) {
        return {
          asset: b.asset,
          expectedReturn: pct(b.expectedReturn),
          volatility: pct(b.volatility),
          sharpe: 0,
          rating: "N/A" as string,
        };
      }
      const s = sharpe(b.expectedReturn, riskFree, b.volatility);
      return {
        asset: b.asset,
        expectedReturn: pct(b.expectedReturn),
        volatility: pct(b.volatility),
        sharpe: s,
        rating: ratingFromSharpe(s),
      };
    });

    // ── Risk premium ───────────────────────────────────────────────────────
    const riskPremium = pct(creIrr - riskFree);

    // ── Recommendation ─────────────────────────────────────────────────────
    const betterThanCount = comparisonTable.filter(
      (c) => c.volatility !== pct(0) && creSharpe > c.sharpe
    ).length;
    const totalComparable = comparisonTable.filter(
      (c) => c.volatility !== pct(0)
    ).length;

    let recommendation: string;
    if (creSharpe > 1.0) {
      recommendation =
        `Excellent risk-adjusted returns. This CRE deal (Sharpe ${creSharpe}) outperforms ${betterThanCount} of ${totalComparable} comparable asset classes on a risk-adjusted basis. The ${riskPremium} risk premium over Treasuries is compelling for a ${holdYears}-year hold.`;
    } else if (creSharpe > 0.5) {
      recommendation =
        `Good risk-adjusted returns. This CRE deal (Sharpe ${creSharpe}) offers competitive returns vs. ${betterThanCount} of ${totalComparable} asset classes. The ${riskPremium} spread over Treasuries provides adequate compensation for illiquidity and concentration risk over a ${holdYears}-year hold.`;
    } else if (creSharpe > 0.2) {
      recommendation =
        `Fair risk-adjusted returns. This CRE deal (Sharpe ${creSharpe}) underperforms several liquid alternatives. Consider whether the ${riskPremium} premium over Treasuries justifies the illiquidity and execution risk over a ${holdYears}-year hold. REITs or diversified equity may offer better risk-adjusted exposure.`;
    } else {
      recommendation =
        `Poor risk-adjusted returns. This CRE deal (Sharpe ${creSharpe}) does not adequately compensate for risk. The ${riskPremium} premium over Treasuries is insufficient given the illiquidity, concentration, and operational burdens. Consider Treasuries, investment-grade bonds, or REITs as alternatives for a ${holdYears}-year horizon.`;
    }

    return {
      creReturn,
      comparisonTable,
      riskPremium,
      recommendation,
    };
  },
};
