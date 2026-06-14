// src/tools/tenantCredit.ts — Tenant Credit Analysis
// S&P-equivalent credit ratings, financial health, lease covenant analysis

import type { RegisteredTool } from "../lib/agentTypes.js";

// ── Credit database ─────────────────────────────────────────────────────────

interface TenantProfile {
  rating: string;
  ratingLabel: string;
  outlook: "positive" | "stable" | "negative" | "watch";
  revenueStability: "growing" | "stable" | "declining";
  storePresence: "national" | "regional" | "local";
  publicCompany: boolean;
  sector: string;
  avgRevPerSqft?: number; // estimated annual revenue per sqft
}

const CREDIT_DB: Record<string, TenantProfile> = {
  // AAA/AA tier
  "walmart": { rating: "AA", ratingLabel: "Investment Grade — Prime", outlook: "stable", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "discount retail", avgRevPerSqft: 450 },
  "amazon": { rating: "AA", ratingLabel: "Investment Grade — Prime", outlook: "positive", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "logistics", avgRevPerSqft: 600 },
  "fedex": { rating: "AA-", ratingLabel: "Investment Grade — Prime", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "logistics", avgRevPerSqft: 350 },
  "costco": { rating: "AA", ratingLabel: "Investment Grade — Prime", outlook: "positive", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "wholesale retail", avgRevPerSqft: 1200 },
  "target": { rating: "A+", ratingLabel: "Investment Grade — Strong", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "general retail", avgRevPerSqft: 320 },
  "home depot": { rating: "A", ratingLabel: "Investment Grade — Strong", outlook: "stable", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "home improvement", avgRevPerSqft: 500 },
  "lowe's": { rating: "A-", ratingLabel: "Investment Grade — Strong", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "home improvement", avgRevPerSqft: 380 },
  "ups": { rating: "A+", ratingLabel: "Investment Grade — Strong", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "logistics", avgRevPerSqft: 300 },
  "dhl": { rating: "A", ratingLabel: "Investment Grade — Strong", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: false, sector: "logistics", avgRevPerSqft: 280 },

  // A tier
  "cvs": { rating: "BBB+", ratingLabel: "Investment Grade — Adequate", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "pharmacy", avgRevPerSqft: 650 },
  "walgreens": { rating: "BBB", ratingLabel: "Investment Grade — Adequate", outlook: "negative", revenueStability: "declining", storePresence: "national", publicCompany: true, sector: "pharmacy", avgRevPerSqft: 550 },
  "7-eleven": { rating: "A-", ratingLabel: "Investment Grade — Strong", outlook: "stable", revenueStability: "growing", storePresence: "national", publicCompany: false, sector: "convenience", avgRevPerSqft: 900 },
  "starbucks": { rating: "A-", ratingLabel: "Investment Grade — Strong", outlook: "stable", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "food & beverage", avgRevPerSqft: 700 },
  "kroger": { rating: "BBB", ratingLabel: "Investment Grade — Adequate", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "grocery", avgRevPerSqft: 550 },
  "publix": { rating: "A", ratingLabel: "Investment Grade — Strong", outlook: "positive", revenueStability: "growing", storePresence: "regional", publicCompany: false, sector: "grocery", avgRevPerSqft: 600 },
  "whole foods": { rating: "AA", ratingLabel: "Investment Grade — Prime", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: false, sector: "grocery", avgRevPerSqft: 800 },
  "tractor supply": { rating: "BBB+", ratingLabel: "Investment Grade — Adequate", outlook: "positive", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "specialty retail", avgRevPerSqft: 200 },

  // BBB tier
  "dollar general": { rating: "BBB", ratingLabel: "Investment Grade — Adequate", outlook: "stable", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "discount retail", avgRevPerSqft: 230 },
  "chipotle": { rating: "BBB+", ratingLabel: "Investment Grade — Adequate", outlook: "positive", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "food & beverage", avgRevPerSqft: 850 },
  "chick-fil-a": { rating: "A-", ratingLabel: "Investment Grade — Strong", outlook: "positive", revenueStability: "growing", storePresence: "national", publicCompany: false, sector: "food & beverage", avgRevPerSqft: 1500 },
  "aldi": { rating: "A-", ratingLabel: "Investment Grade — Strong", outlook: "positive", revenueStability: "growing", storePresence: "national", publicCompany: false, sector: "grocery", avgRevPerSqft: 650 },
  "autozone": { rating: "BBB", ratingLabel: "Investment Grade — Adequate", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "auto parts", avgRevPerSqft: 320 },
  "o'reilly": { rating: "BBB+", ratingLabel: "Investment Grade — Adequate", outlook: "stable", revenueStability: "growing", storePresence: "national", publicCompany: true, sector: "auto parts", avgRevPerSqft: 350 },
  "mcdonald's": { rating: "A-", ratingLabel: "Investment Grade — Strong", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "food & beverage", avgRevPerSqft: 700 },
  "wendy's": { rating: "BB+", ratingLabel: "Non-Investment Grade — Speculative", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "food & beverage", avgRevPerSqft: 400 },

  // BB tier
  "dollar tree": { rating: "BBB-", ratingLabel: "Investment Grade — Lower", outlook: "negative", revenueStability: "declining", storePresence: "national", publicCompany: true, sector: "discount retail", avgRevPerSqft: 180 },
  "family dollar": { rating: "BB+", ratingLabel: "Non-Investment Grade — Speculative", outlook: "negative", revenueStability: "declining", storePresence: "national", publicCompany: false, sector: "discount retail", avgRevPerSqft: 150 },
  "rite aid": { rating: "CCC", ratingLabel: "Distressed", outlook: "negative", revenueStability: "declining", storePresence: "national", publicCompany: true, sector: "pharmacy", avgRevPerSqft: 300 },
  "panera": { rating: "BB", ratingLabel: "Non-Investment Grade — Speculative", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: false, sector: "food & beverage", avgRevPerSqft: 500 },
  "albertsons": { rating: "BB+", ratingLabel: "Non-Investment Grade — Speculative", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "grocery", avgRevPerSqft: 450 },
  "safeway": { rating: "BB+", ratingLabel: "Non-Investment Grade — Speculative", outlook: "stable", revenueStability: "stable", storePresence: "regional", publicCompany: false, sector: "grocery", avgRevPerSqft: 500 },

  // Medical / government
  "fresenius": { rating: "BBB", ratingLabel: "Investment Grade — Adequate", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "healthcare", avgRevPerSqft: 400 },
  "davita": { rating: "BB+", ratingLabel: "Non-Investment Grade — Speculative", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: true, sector: "healthcare", avgRevPerSqft: 450 },
  "us government": { rating: "AA+", ratingLabel: "Investment Grade — Prime", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: false, sector: "government" },
  "gsa": { rating: "AA+", ratingLabel: "Investment Grade — Prime", outlook: "stable", revenueStability: "stable", storePresence: "national", publicCompany: false, sector: "government" },
};

// ── Rating utilities ────────────────────────────────────────────────────────

const RATING_ORDER = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-", "BB+", "BB", "BB-", "B+", "B", "B-", "CCC", "CC", "C", "D", "NR"];

function isInvestmentGrade(rating: string): boolean {
  const idx = RATING_ORDER.indexOf(rating);
  const bbbMinusIdx = RATING_ORDER.indexOf("BBB-");
  return idx >= 0 && idx <= bbbMinusIdx;
}

function lookupTenant(name: string): TenantProfile | null {
  const key = name.toLowerCase().trim();
  if (CREDIT_DB[key]) return CREDIT_DB[key];
  // Fuzzy match
  for (const [k, v] of Object.entries(CREDIT_DB)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

// ── Tool ─────────────────────────────────────────────────────────────────────

export const tenantCreditTool: RegisteredTool = {
  category: "analysis",
  estimatedDurationMs: 200,
  schema: {
    name: "tenant_credit_analysis",
    description: "Analyze a tenant's credit quality with S&P-equivalent ratings, financial health indicators, and lease covenant analysis. Returns watchlist flags for risky tenants.",
    parameters: {
      type: "object",
      properties: {
        tenantName: { type: "string", description: "Tenant name, e.g. 'Walgreens', 'Dollar General', 'FedEx'" },
        leaseTermYears: { type: "number", description: "Remaining lease term in years" },
        annualRent: { type: "number", description: "Annual rent in dollars" },
        propertyType: { type: "string", description: "Property type, e.g. 'NNN retail', 'industrial'" },
        propertySqft: { type: "number", description: "Property square footage for occupancy cost analysis" },
      },
      required: ["tenantName"],
    },
  },
  execute: async (args) => {
    const { tenantName, leaseTermYears, annualRent, propertyType, propertySqft } = args;

    if (!tenantName || typeof tenantName !== "string" || !tenantName.trim()) {
      return {
        tenant: tenantName || "Unknown",
        rating: "NR",
        ratingLabel: "Not Rated — No Tenant Provided",
        outlook: "unknown",
        investmentGrade: false,
        financialHealth: { revenueStability: "unknown", storePresence: "unknown", publicCompany: false },
        leaseAnalysis: null,
        watchlistFlags: ["No tenant name provided — enter a tenant name to run credit analysis"],
        recommendation: "INCOMPLETE — provide a tenant name (e.g. 'Walgreens', 'Dollar General', 'FedEx') to run credit analysis.",
      };
    }

    const profile = lookupTenant(tenantName);

    if (!profile) {
      return {
        tenant: tenantName,
        rating: "NR",
        ratingLabel: "Not Rated — Unknown Tenant",
        outlook: "unknown",
        investmentGrade: false,
        financialHealth: {
          revenueStability: "unknown",
          storePresence: "unknown",
          publicCompany: false,
        },
        leaseAnalysis: null,
        watchlistFlags: [
          "Tenant not in credit database — additional due diligence required",
          "Consider requiring personal guarantee or letter of credit",
        ],
        recommendation: "INVESTIGATE — tenant not in DealSense credit database. Request financials, rent roll, and tenant operating history before proceeding.",
      };
    }

    const watchlistFlags: string[] = [];

    // Lease analysis
    let leaseAnalysis = null;
    if (annualRent || leaseTermYears) {
      const occupancyCostRatio = (annualRent && propertySqft && profile.avgRevPerSqft)
        ? (annualRent / propertySqft) / profile.avgRevPerSqft
        : null;

      const coverageRatio = (profile.avgRevPerSqft && annualRent && propertySqft)
        ? (profile.avgRevPerSqft * propertySqft) / annualRent
        : null;

      leaseAnalysis = {
        occupancyCostRatio: occupancyCostRatio ? `${(occupancyCostRatio * 100).toFixed(1)}%` : null,
        coverageRatio: coverageRatio ? `${coverageRatio.toFixed(1)}x` : null,
        termRemaining: leaseTermYears ? `${leaseTermYears} years` : null,
      };

      if (occupancyCostRatio && occupancyCostRatio > 0.12) {
        watchlistFlags.push(`Occupancy cost ratio ${(occupancyCostRatio * 100).toFixed(1)}% exceeds 12% threshold — rent may be unsustainable`);
      }
      if (leaseTermYears && leaseTermYears < 3) {
        watchlistFlags.push(`Lease term ${leaseTermYears}yr is below 3-year minimum — vacancy risk elevated`);
      }
    }

    // Credit-based flags
    if (!isInvestmentGrade(profile.rating)) {
      watchlistFlags.push(`Sub-investment grade (${profile.rating}) — higher default risk`);
    }
    if (profile.outlook === "negative") {
      watchlistFlags.push(`Negative outlook — credit deterioration possible`);
    }
    if (profile.revenueStability === "declining") {
      watchlistFlags.push(`Revenue trend declining — store closure risk`);
    }

    // Recommendation
    let recommendation: string;
    if (isInvestmentGrade(profile.rating) && watchlistFlags.length === 0) {
      recommendation = "STRONG — investment-grade tenant with favorable lease metrics. Suitable for core/core+ strategy.";
    } else if (isInvestmentGrade(profile.rating)) {
      recommendation = "ACCEPTABLE — investment-grade tenant but monitor flagged concerns. Suitable for value-add with appropriate risk premium.";
    } else if (RATING_ORDER.indexOf(profile.rating) <= RATING_ORDER.indexOf("BB-")) {
      recommendation = "CAUTION — below investment grade. Requires higher cap rate spread (150+ bps) and shorter hold period.";
    } else {
      recommendation = "HIGH RISK — distressed or unrated tenant. Consider only with significant discount, replacement tenant pipeline, or redevelopment potential.";
    }

    return {
      tenant: tenantName,
      rating: profile.rating,
      ratingLabel: profile.ratingLabel,
      outlook: profile.outlook,
      investmentGrade: isInvestmentGrade(profile.rating),
      sector: profile.sector,
      financialHealth: {
        revenueStability: profile.revenueStability,
        storePresence: profile.storePresence,
        publicCompany: profile.publicCompany,
      },
      leaseAnalysis,
      watchlistFlags,
      recommendation,
    };
  },
};
