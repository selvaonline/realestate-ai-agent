// src/tools/riskDecomposition.ts — Multi-factor risk decomposition for CRE deals
// Breaks down risk into: interest rate sensitivity, credit/tenant, liquidity, inflation

import type { RegisteredTool } from "../lib/agentTypes.js";
import { computeDcf } from "./dcfServer.js";

// ── Tenant credit tiers ─────────────────────────────────────────────────────

const INVESTMENT_GRADE = new Set([
  "walmart", "amazon", "fedex", "costco", "target", "home depot",
  "starbucks", "mcdonald's", "cvs", "chick-fil-a", "7-eleven",
  "publix", "whole foods",
]);

const MID_TIER = new Set([
  "dollar general", "walgreens", "autozone", "o'reilly", "kroger",
  "tractor supply",
]);

const LOWER_TIER = new Set([
  "dollar tree", "family dollar", "rite aid", "panera",
]);

// ── Market tier lists ───────────────────────────────────────────────────────

const TIER_A_MARKETS = new Set([
  "dallas", "houston", "miami", "new york", "los angeles", "chicago",
  "atlanta", "phoenix", "tampa", "orlando", "austin", "denver",
  "seattle", "boston", "san francisco", "washington dc",
]);

const TIER_B_MARKETS = new Set([
  "nashville", "charlotte", "raleigh", "salt lake city", "san antonio",
  "jacksonville", "columbus", "indianapolis", "minneapolis", "kansas city",
  "portland", "las vegas", "richmond",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtIrr(irr: number): string {
  return `${(irr * 100).toFixed(1)}%`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function matchSet(value: string | undefined, set: Set<string>): boolean {
  if (!value) return false;
  const key = value.toLowerCase().trim();
  if (set.has(key)) return true;
  // Partial match: check if the value contains any set entry or vice versa
  for (const entry of set) {
    if (key.includes(entry) || entry.includes(key)) return true;
  }
  return false;
}

// ── Tool ────────────────────────────────────────────────────────────────────

export const riskDecompositionTool: RegisteredTool = {
  category: "analysis",
  estimatedDurationMs: 500,
  schema: {
    name: "risk_decomposition",
    description:
      "Decompose a CRE deal's risk into individual factors: interest rate sensitivity, credit/tenant risk, liquidity risk, and inflation risk. Shows IRR impact per 100bps rate change.",
    parameters: {
      type: "object",
      properties: {
        purchasePrice: {
          type: "number",
          description: "Purchase price in dollars",
        },
        noi: {
          type: "number",
          description: "Annual Net Operating Income in dollars",
        },
        market: {
          type: "string",
          description: "Metro name for market tier assessment, e.g. 'Dallas' or 'Miami'",
        },
        tenantName: {
          type: "string",
          description: "Tenant name for credit risk scoring, e.g. 'Walgreens', 'FedEx'",
        },
        propertyType: {
          type: "string",
          description: "Property type, e.g. 'NNN retail', 'industrial', 'office'",
        },
        interestRate: {
          type: "number",
          description: "Annual interest rate, e.g. 0.055 (default: 0.055)",
        },
        ltv: {
          type: "number",
          description: "Loan-to-value ratio, e.g. 0.65 (default: 0.65)",
        },
      },
      required: ["purchasePrice", "noi"],
    },
  },

  execute: async (args) => {
    const {
      purchasePrice,
      noi,
      market,
      tenantName,
      propertyType,
      interestRate = 0.055,
      ltv = 0.65,
    } = args;

    const dcfBase = { purchasePrice, noi, interestRate, ltv };

    // ── 1. Interest rate sensitivity ──────────────────────────────────────

    const baseResult = computeDcf(dcfBase);
    const plus50Result = computeDcf({ ...dcfBase, interestRate: interestRate + 0.005 });
    const plus100Result = computeDcf({ ...dcfBase, interestRate: interestRate + 0.01 });
    const plus200Result = computeDcf({ ...dcfBase, interestRate: interestRate + 0.02 });

    if (!baseResult || !plus50Result || !plus100Result || !plus200Result) {
      return { error: "Could not compute DCF — invalid price or NOI" };
    }

    const baseIrr = baseResult.irr;
    const plus100Irr = plus100Result.irr;
    const deltaIrrPer100bps = baseIrr - plus100Irr; // positive means IRR drops

    // Rate sensitivity score: how much IRR drops per 100bps
    // >3pp drop = very sensitive (score 90), 2pp = 70, 1pp = 40, <0.5pp = 15
    const rateSensitivityScore = clamp(
      Math.round(deltaIrrPer100bps * 100 * 20), // 1pp -> 20, 3pp -> 60, scale up
      10,
      95,
    );

    const rateSensitivity = {
      base: { rate: fmtIrr(interestRate), irr: fmtIrr(baseIrr) },
      plus50bps: { rate: fmtIrr(interestRate + 0.005), irr: fmtIrr(plus50Result.irr) },
      plus100bps: { rate: fmtIrr(interestRate + 0.01), irr: fmtIrr(plus100Irr) },
      plus200bps: { rate: fmtIrr(interestRate + 0.02), irr: fmtIrr(plus200Result.irr) },
      deltaIrrPer100bps: `${(deltaIrrPer100bps * 100).toFixed(2)}pp`,
    };

    // ── 2. Credit / tenant risk ───────────────────────────────────────────

    let creditScore: number;
    let creditDetail: string;

    if (tenantName && matchSet(tenantName, INVESTMENT_GRADE)) {
      creditScore = 15;
      creditDetail = `${tenantName} — investment-grade national tenant`;
    } else if (tenantName && matchSet(tenantName, MID_TIER)) {
      creditScore = 40;
      creditDetail = `${tenantName} — mid-tier tenant, adequate credit`;
    } else if (tenantName && matchSet(tenantName, LOWER_TIER)) {
      creditScore = 65;
      creditDetail = `${tenantName} — lower-tier tenant, elevated default risk`;
    } else if (tenantName) {
      creditScore = 75;
      creditDetail = `${tenantName} — not in credit database, unknown risk`;
    } else {
      creditScore = 75;
      creditDetail = "No tenant specified — assuming elevated credit risk";
    }

    // ── 3. Liquidity risk ─────────────────────────────────────────────────

    let liquidityScore: number;
    let liquidityDetail: string;

    if (matchSet(market, TIER_A_MARKETS)) {
      liquidityScore = 20;
      liquidityDetail = `${market} — Tier A market, deep buyer pool`;
    } else if (matchSet(market, TIER_B_MARKETS)) {
      liquidityScore = 45;
      liquidityDetail = `${market} — Tier B market, moderate liquidity`;
    } else if (market) {
      liquidityScore = 70;
      liquidityDetail = `${market} — Tier C or unrecognized market, limited buyer pool`;
    } else {
      liquidityScore = 70;
      liquidityDetail = "No market specified — assuming limited liquidity";
    }

    // Deal size adjustment
    if (purchasePrice > 10_000_000) {
      liquidityScore = clamp(liquidityScore - 10, 0, 100);
      liquidityDetail += "; large deal size improves institutional interest (-10)";
    } else if (purchasePrice < 2_000_000) {
      liquidityScore = clamp(liquidityScore + 15, 0, 100);
      liquidityDetail += "; small deal size limits buyer universe (+15)";
    }

    // ── 4. Inflation risk ─────────────────────────────────────────────────

    const noiGrowth = 0.02; // default assumption in DCF
    const typicalCpi = 0.035;
    let inflationScore: number;
    let inflationDetail: string;

    if (noiGrowth < typicalCpi) {
      inflationScore = 60;
      inflationDetail = `NOI growth (${(noiGrowth * 100).toFixed(1)}%) trails typical CPI (${(typicalCpi * 100).toFixed(1)}%) — real returns erode over hold`;
    } else {
      inflationScore = 25;
      inflationDetail = `NOI growth (${(noiGrowth * 100).toFixed(1)}%) meets or exceeds CPI assumption (${(typicalCpi * 100).toFixed(1)}%)`;
    }

    // NNN lease bonus: expenses passed through to tenant
    const isNNN = propertyType
      ? /nnn|triple\s*net|net\s*lease|absolute\s*net/i.test(propertyType)
      : false;

    if (isNNN) {
      inflationScore = clamp(inflationScore - 10, 0, 100);
      inflationDetail += "; NNN structure passes opex inflation to tenant (-10)";
    }

    // ── 5. Total risk (weighted average) ──────────────────────────────────

    const weights = {
      rateSensitivity: 0.30,
      credit: 0.25,
      liquidity: 0.25,
      inflation: 0.20,
    };

    const totalRisk = Math.round(
      rateSensitivityScore * weights.rateSensitivity +
      creditScore * weights.credit +
      liquidityScore * weights.liquidity +
      inflationScore * weights.inflation,
    );

    const factors = [
      {
        name: "Interest Rate Sensitivity",
        score: rateSensitivityScore,
        weight: weights.rateSensitivity,
        detail: `IRR drops ${(deltaIrrPer100bps * 100).toFixed(2)}pp per 100bps rate increase`,
      },
      {
        name: "Credit / Tenant Risk",
        score: creditScore,
        weight: weights.credit,
        detail: creditDetail,
      },
      {
        name: "Liquidity Risk",
        score: liquidityScore,
        weight: weights.liquidity,
        detail: liquidityDetail,
      },
      {
        name: "Inflation Risk",
        score: inflationScore,
        weight: weights.inflation,
        detail: inflationDetail,
      },
    ];

    // ── Recommendation ────────────────────────────────────────────────────

    let recommendation: string;
    if (totalRisk <= 30) {
      recommendation = "LOW RISK - suitable for core strategy";
    } else if (totalRisk <= 50) {
      recommendation = "MODERATE RISK - value-add opportunity";
    } else if (totalRisk <= 70) {
      recommendation = "ELEVATED RISK - requires risk premium";
    } else {
      recommendation = "HIGH RISK - opportunistic or avoid";
    }

    return {
      totalRisk,
      factors,
      rateSensitivity,
      recommendation,
    };
  },
};
