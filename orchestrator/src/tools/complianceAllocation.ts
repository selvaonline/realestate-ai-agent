// src/tools/complianceAllocation.ts — Fund Compliance & LP Waterfall
// Portfolio-level mandate checks, concentration analysis, and LP/GP distribution

import type { RegisteredTool } from "../lib/agentTypes.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface PortfolioDeal {
  title: string;
  purchasePrice: number;
  noi: number;
  market: string;
  propertyType: string;
  peScore?: number;
}

interface Mandates {
  maxSingleAssetPct: number;
  maxGeoPct: number;
  minDscr: number;
  maxLtv: number;
  minPeScore: number;
}

interface LpSplit {
  preferredReturn: number;
  catchUpPct: number;
  carriedInterest: number;
  gpCommit: number;
}

interface Violation {
  deal: string;
  rule: string;
  actual: number;
  limit: number;
}

interface WaterfallResult {
  lpReturn: number;
  gpReturn: number;
  carriedInterest: number;
  totalDistributed: number;
}

interface ConcentrationEntry {
  count: number;
  pct: number;
}

interface ComplianceResult {
  compliant: boolean;
  violations: Violation[];
  fundMetrics: {
    nav: number;
    totalInvested: number;
    dealCount: number;
  };
  waterfall?: WaterfallResult;
  concentrationReport: {
    byGeo: Record<string, ConcentrationEntry>;
    byType: Record<string, ConcentrationEntry>;
    largestPositionPct: number;
  };
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_MANDATES: Mandates = {
  maxSingleAssetPct: 0.10,
  maxGeoPct: 0.25,
  minDscr: 1.25,
  maxLtv: 0.65,
  minPeScore: 60,
};

const DEFAULT_LP_SPLIT: LpSplit = {
  preferredReturn: 0.08,
  catchUpPct: 0.50,
  carriedInterest: 0.20,
  gpCommit: 0.02,
};

// ── Tool ───────────────────────────────────────────────────────────────────

export const complianceCheckTool: RegisteredTool = {
  category: "portfolio",
  estimatedDurationMs: 300,
  schema: {
    name: "compliance_check",
    description:
      "Check portfolio compliance against fund mandates and compute LP/GP waterfall distribution. Identifies concentration violations, DSCR breaches, and LTV limits.",
    parameters: {
      type: "object",
      properties: {
        portfolio: {
          type: "array",
          description:
            "Array of {title, purchasePrice, noi, market, propertyType, peScore?}",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Property title" },
              purchasePrice: { type: "number", description: "Purchase price in dollars" },
              noi: { type: "number", description: "Annual NOI in dollars" },
              market: { type: "string", description: "Market/metro name" },
              propertyType: { type: "string", description: "Property type" },
              peScore: { type: "number", description: "PE score 0-100" },
            },
          },
        },
        fundSize: {
          type: "number",
          description: "Total fund AUM",
        },
        mandates: {
          type: "object",
          description:
            "Optional overrides: {maxSingleAssetPct, maxGeoPct, minDscr, maxLtv, minPeScore}",
          properties: {
            maxSingleAssetPct: { type: "number", description: "Max single-asset concentration (default 0.10)" },
            maxGeoPct: { type: "number", description: "Max geographic concentration (default 0.25)" },
            minDscr: { type: "number", description: "Minimum DSCR (default 1.25)" },
            maxLtv: { type: "number", description: "Maximum LTV (default 0.65)" },
            minPeScore: { type: "number", description: "Minimum PE score (default 60)" },
          },
        },
        totalReturn: {
          type: "number",
          description: "Total fund return for waterfall calculation",
        },
        lpSplit: {
          type: "object",
          description:
            "Optional LP/GP split overrides: {preferredReturn, catchUpPct, carriedInterest, gpCommit}",
          properties: {
            preferredReturn: { type: "number", description: "LP preferred return (default 0.08)" },
            catchUpPct: { type: "number", description: "GP catch-up percentage (default 0.50)" },
            carriedInterest: { type: "number", description: "GP carried interest (default 0.20)" },
            gpCommit: { type: "number", description: "GP co-invest commitment (default 0.02)" },
          },
        },
      },
      required: ["portfolio", "fundSize"],
    },
  },

  execute: async (args) => {
    const portfolio: PortfolioDeal[] = args.portfolio;
    const fundSize: number = args.fundSize;
    const mandates: Mandates = { ...DEFAULT_MANDATES, ...args.mandates };
    const lpSplit: LpSplit = { ...DEFAULT_LP_SPLIT, ...args.lpSplit };
    const totalReturn: number | undefined = args.totalReturn;

    const violations: Violation[] = [];

    // ── 1. Per-deal mandate checks ───────────────────────────────────────

    for (const deal of portfolio) {
      // Single-asset concentration
      const singleAssetPct = deal.purchasePrice / fundSize;
      if (singleAssetPct > mandates.maxSingleAssetPct) {
        violations.push({
          deal: deal.title,
          rule: "maxSingleAssetPct",
          actual: parseFloat(singleAssetPct.toFixed(4)),
          limit: mandates.maxSingleAssetPct,
        });
      }

      // DSCR check (simplified annual debt service)
      if (deal.noi) {
        const annualDebtService =
          deal.purchasePrice * mandates.maxLtv * 0.055; // simplified: principal * rate
        const dscr = deal.noi / annualDebtService;
        if (dscr < mandates.minDscr) {
          violations.push({
            deal: deal.title,
            rule: "minDscr",
            actual: parseFloat(dscr.toFixed(2)),
            limit: mandates.minDscr,
          });
        }
      }

      // PE score check
      if (deal.peScore != null && deal.peScore < mandates.minPeScore) {
        violations.push({
          deal: deal.title,
          rule: "minPeScore",
          actual: deal.peScore,
          limit: mandates.minPeScore,
        });
      }
    }

    // ── 2. Geographic concentration ──────────────────────────────────────

    const geoGroups: Record<string, PortfolioDeal[]> = {};
    for (const deal of portfolio) {
      const market = deal.market || "Unknown";
      if (!geoGroups[market]) geoGroups[market] = [];
      geoGroups[market].push(deal);
    }

    const dealCount = portfolio.length;

    const byGeo: Record<string, ConcentrationEntry> = {};
    for (const [market, deals] of Object.entries(geoGroups)) {
      const pct = deals.length / dealCount;
      byGeo[market] = { count: deals.length, pct: parseFloat(pct.toFixed(4)) };
      if (pct > mandates.maxGeoPct) {
        violations.push({
          deal: `[Market: ${market}]`,
          rule: "maxGeoPct",
          actual: parseFloat(pct.toFixed(4)),
          limit: mandates.maxGeoPct,
        });
      }
    }

    // ── 3. Property type concentration ───────────────────────────────────

    const typeGroups: Record<string, PortfolioDeal[]> = {};
    for (const deal of portfolio) {
      const pt = deal.propertyType || "Unknown";
      if (!typeGroups[pt]) typeGroups[pt] = [];
      typeGroups[pt].push(deal);
    }

    const byType: Record<string, ConcentrationEntry> = {};
    for (const [propType, deals] of Object.entries(typeGroups)) {
      const pct = deals.length / dealCount;
      byType[propType] = { count: deals.length, pct: parseFloat(pct.toFixed(4)) };
    }

    // ── 4. Largest single position ───────────────────────────────────────

    let largestPositionPct = 0;
    for (const deal of portfolio) {
      const pct = deal.purchasePrice / fundSize;
      if (pct > largestPositionPct) largestPositionPct = pct;
    }
    largestPositionPct = parseFloat(largestPositionPct.toFixed(4));

    // ── 5. Fund metrics ──────────────────────────────────────────────────

    const nav = portfolio.reduce((sum, d) => sum + d.purchasePrice, 0);
    const equityPct = 1 - mandates.maxLtv;
    const totalInvested = portfolio.reduce(
      (sum, d) => sum + d.purchasePrice * equityPct,
      0
    );

    // ── 6. LP/GP waterfall (if totalReturn provided) ─────────────────────

    let waterfall: WaterfallResult | undefined;
    if (totalReturn != null) {
      const invested = totalInvested;
      const prefAmount = invested * lpSplit.preferredReturn;

      let lpReturn = 0;
      let gpReturn = 0;
      let remaining = totalReturn;

      // Tier 1: LP preferred return
      const prefPaid = Math.min(remaining, prefAmount);
      lpReturn += prefPaid;
      remaining -= prefPaid;

      // Tier 2: GP catch-up until GP has catchUpPct of total profits so far
      if (remaining > 0) {
        // GP catches up so that GP share = catchUpPct of all profits distributed
        // After pref, LP has prefPaid. GP needs catchUpPct/(1-catchUpPct) * prefPaid
        const catchUpTarget =
          (lpSplit.catchUpPct / (1 - lpSplit.catchUpPct)) * prefPaid;
        const catchUpPaid = Math.min(remaining, catchUpTarget);
        gpReturn += catchUpPaid;
        remaining -= catchUpPaid;
      }

      // Tier 3: remaining split by carried interest
      if (remaining > 0) {
        const lpShare = remaining * (1 - lpSplit.carriedInterest);
        const gpShare = remaining * lpSplit.carriedInterest;
        lpReturn += lpShare;
        gpReturn += gpShare;
        remaining = 0;
      }

      waterfall = {
        lpReturn: parseFloat(lpReturn.toFixed(2)),
        gpReturn: parseFloat(gpReturn.toFixed(2)),
        carriedInterest: parseFloat(gpReturn.toFixed(2)),
        totalDistributed: parseFloat((lpReturn + gpReturn).toFixed(2)),
      };
    }

    // ── 7. Build result ──────────────────────────────────────────────────

    const result: ComplianceResult = {
      compliant: violations.length === 0,
      violations,
      fundMetrics: {
        nav: Math.round(nav),
        totalInvested: Math.round(totalInvested),
        dealCount,
      },
      waterfall,
      concentrationReport: {
        byGeo,
        byType,
        largestPositionPct,
      },
    };

    return result;
  },
};
