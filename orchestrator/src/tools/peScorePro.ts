// src/tools/peScorePro.ts - DealSense PE: Professional-grade deal scoring
import { DynamicTool } from "@langchain/core/tools";
import fs from "node:fs";
import path from "node:path";

type SerpRow = { title: string; url: string; snippet: string };

type Config = {
  weights: any;
  benchmarks: { riskFreeBps: number; minCapBps: number; targetSpreadBps: number };
  tenantCredit: { investmentGrade: string[]; upperMid: string[]; lowerMid: string[] };
  marketTiers: { A: string[]; B: string[]; C: string[] };
  sectorPrefs: Record<string, number>;
  dscr: { ltv: number; rate: number; amortYears: number; minDscr: number };
  executionRules: { preferDetailUrl: boolean; penalizeProfilePages: boolean; penalizeCategoryPages: boolean };
  institutional?: { minDealSize?: number; idealDealMin?: number; idealDealMax?: number };
};

const mode = String(process.env.PE_MODE || "").toLowerCase() === "institutional" ? "institutional" : "private";
const configPath =
  mode === "institutional"
    ? path.join(process.cwd(), "config", "pe-config-institutional.json")
    : path.join(process.cwd(), "config", "pe-config.json");
const cfg: Config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
console.log(`[DealSense PE] Loaded config mode=${mode} from ${path.basename(configPath)}`);

const CREXI_DETAIL = /crexi\.com\/(?:property|sale|lease)\/[^/?#]+\/[a-z0-9-]+/i;
const CREXI_PROFILE = /crexi\.com\/profile\//i;
const CREXI_CATEGORY = /crexi\.com\/properties\//i;

function has(text: string, list: string[]) {
  const t = text.toLowerCase();
  return list.some(x => t.includes(x.toLowerCase()));
}

function capFrom(text: string): number | null {
  const m = text.toLowerCase().match(/cap\s*rate[:\s-]*([0-9]+(?:\.[0-9]+)?)\s?%/i);
  return m ? Number(m[1]) / 100 : null;
}

function moneyFrom(text: string): number | null {
  const m = text.match(/\$?\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/);
  if (!m) return null;
  let val = Number(m[1].replace(/,/g, ""));
  // Check if it's in millions
  if (/million|m\b/i.test(text) && val < 1000) {
    val = val * 1000000;
  }
  return val;
}

function isIndustrial(text: string) {
  const t = text.toLowerCase();
  return /(industrial|warehouse|distribution|logistics|last mile|ios|outdoor storage|yard|truck|flex|cross-dock)/i.test(t);
}

function geoTier(text: string): "A" | "B" | "C" | null {
  const t = text.toLowerCase();
  if (has(t, cfg.marketTiers.A)) return "A";
  if (has(t, cfg.marketTiers.B)) return "B";
  if (has(t, cfg.marketTiers.C)) return "C";
  return null;
}

function mortgagePmt(p: number, rate: number, years: number) {
  const mRate = rate / 12;
  const n = years * 12;
  return (p * (mRate * Math.pow(1 + mRate, n))) / (Math.pow(1 + mRate, n) - 1);
}

function scoreRow(row: SerpRow, query?: string) {
  const t = `${row.title} ${row.snippet}`.toLowerCase();
  const url = row.url;

  // Extract signals
  const cap = capFrom(t);
  const price = moneyFrom(t);
  const noiMatch = /noi/i.test(t) ? moneyFrom(t) : null;
  const noi = noiMatch;
  const nnn = /(nnn|triple net|absolute net|bondable)/i.test(t);
  const longTerm = /(long[-\s]?term|15[-\s]?year|20[-\s]?year|25[-\s]?year)/i.test(t);
  const guarantee = /(corporate guarantee|corporate guaranteed|guaranteed)/i.test(t);
  const sectorIndustrial = isIndustrial(t);
  const tier = geoTier(t);
  
  const tenantName = (() => {
    const all = [...cfg.tenantCredit.investmentGrade, ...cfg.tenantCredit.upperMid, ...cfg.tenantCredit.lowerMid];
    const hit = all.find(br => t.includes(br.toLowerCase()));
    return hit || null;
  })();

  // 1. Tenant & Lease Quality (25 points)
  let tenantLease = 0;
  if (tenantName && has(tenantName, cfg.tenantCredit.investmentGrade)) tenantLease += 18;
  else if (tenantName && has(tenantName, cfg.tenantCredit.upperMid)) tenantLease += 12;
  else if (tenantName && has(tenantName, cfg.tenantCredit.lowerMid)) tenantLease += 6;
  if (nnn) tenantLease += 5;
  if (longTerm) tenantLease += 2;
  if (guarantee) tenantLease += 2;
  tenantLease = Math.min(cfg.weights.tenantLease, tenantLease);

  // 2. Yield vs Benchmark (20 points)
  const rf = cfg.benchmarks.riskFreeBps / 10000; // e.g., 0.043
  let yieldSpread = 0;
  if (cap != null) {
    const spreadBps = Math.round((cap - rf) * 10000); // bps
    if (spreadBps >= cfg.benchmarks.targetSpreadBps) yieldSpread = 18;
    else if (spreadBps > 0) yieldSpread = Math.max(6, Math.round(spreadBps / 20)); // ~20 bps per point
    if (cap * 10000 < cfg.benchmarks.minCapBps) yieldSpread -= 4; // too tight cap
  }
  yieldSpread = Math.max(0, Math.min(cfg.weights.yieldSpread, yieldSpread));

  // 3. Market Quality (20 points)
  let marketQuality = 8; // neutral base
  if (tier === "A") marketQuality += 10;
  else if (tier === "B") marketQuality += 5;
  else if (tier === "C") marketQuality += 0;
  marketQuality = Math.min(cfg.weights.marketQuality, marketQuality);

  // 4. Asset Fit (15 points)
  let assetFit = 5;
  if (sectorIndustrial) assetFit += 7;
  const sectorPref = sectorIndustrial ? cfg.sectorPrefs.industrial : cfg.sectorPrefs.retail_nnn || 0.7;
  assetFit += Math.round(3 * sectorPref);
  assetFit = Math.min(cfg.weights.assetFit, assetFit);

  // 5. Deal Economics (10 points)
  let dealEconomics = 0;
  if (noi && price && price > 0) {
    const impliedCap = noi / price;
    if (cap == null) {
      // infer from NOI/Price
      if (impliedCap >= 0.06) dealEconomics += 6;
      else if (impliedCap >= 0.05) dealEconomics += 3;
    } else {
      // consistency bonus
      const diff = Math.abs(impliedCap - cap);
      if (diff <= 0.005) dealEconomics += 2;
    }
    // DSCR feasibility (rough; assumes LTV & rate from cfg)
    const loan = price * cfg.dscr.ltv;
    const debtSvcAnnual = mortgagePmt(loan, cfg.dscr.rate, cfg.dscr.amortYears) * 12;
    const dscr = noi / debtSvcAnnual;
    if (dscr >= cfg.dscr.minDscr) dealEconomics += 2;
  }
  dealEconomics = Math.min(cfg.weights.dealEconomics, dealEconomics);

  // 6. Execution Risk (10 points)
  let executionRisk = 6; // start slightly positive
  if (CREXI_DETAIL.test(url)) executionRisk += 3;
  if (CREXI_PROFILE.test(url) && cfg.executionRules.penalizeProfilePages) executionRisk -= 3;
  if (CREXI_CATEGORY.test(url) && cfg.executionRules.penalizeCategoryPages) executionRisk -= 2;
  
  // Institutional-only deal size preference: reward institutional scale, penalize sub-scale
  if (mode === "institutional") {
    const bounds = cfg.institutional || {};
    const idealMin = bounds.idealDealMin ?? 20000000;
    const idealMax = bounds.idealDealMax ?? 200000000;
    const minDeal = bounds.minDealSize ?? 20000000;
    if (price != null) {
      if (price < minDeal) {
        executionRisk -= 3; // too small for institutional mandate
      } else if (price >= idealMin && price <= idealMax) {
        executionRisk += 2; // fits institutional scale nicely
      }
    } else {
      // Unknown price — slight penalty vs known-scaled opportunities
      executionRisk -= 1;
    }
  }
  
  executionRisk = Math.max(0, Math.min(cfg.weights.executionRisk, executionRisk));

  const raw = {
    tenantLease,
    yieldSpread,
    marketQuality,
    assetFit,
    dealEconomics,
    executionRisk,
  };

  const total = Math.round(
    (tenantLease + yieldSpread + marketQuality + assetFit + dealEconomics + executionRisk) *
      (100 /
        (cfg.weights.tenantLease +
          cfg.weights.yieldSpread +
          cfg.weights.marketQuality +
          cfg.weights.assetFit +
          cfg.weights.dealEconomics +
          cfg.weights.executionRisk))
  );

  // Analyst label
  const parts = [
    sectorIndustrial ? "Industrial" : "Retail",
    nnn ? "NNN" : null,
    tenantName ? tenantName.toUpperCase() : null,
    cap != null ? `${(cap * 100).toFixed(1)}% Cap` : null,
    tier ? tier : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Analyst rationale
  const rationale = [
    tenantName
      ? `Tenant: ${tenantName}${has(tenantName, cfg.tenantCredit.investmentGrade) ? " (Investment Grade)" : ""}.`
      : "No named tenant identified.",
    cap != null
      ? `Cap spread vs 10Y ≈ ${((cap - rf) * 100).toFixed(1)}bps.`
      : `Cap not stated; scored on other factors.`,
    tier ? `Market tier ${tier}.` : `Market tier unknown.`,
    nnn ? `NNN lease structure.` : null,
    longTerm ? `Long-term lease indicators.` : null,
    guarantee ? `Corporate guarantee language.` : null,
    noi && price ? `Implied cap ≈ ${((noi / price) * 100).toFixed(1)}%. DSCR check applied.` : null,
    mode === "institutional" && price != null
      ? `Deal size ≈ $${Math.round(price / 1e6)}M.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    score: total,
    label: parts,
    factors: raw,
    signals: { cap, price, noi, nnn, longTerm, guarantee, sectorIndustrial, tier, tenantName },
    analystNote: rationale,
  };
}

export const peScorePro = new DynamicTool({
  name: "pe_score_pro",
  description: "DealSense PE: Professional-grade deal scoring for SERP rows; returns rows with score, factors and analyst rationale.",
  func: async (input: string) => {
    const payload = (() => {
      try {
        return JSON.parse(input);
      } catch {
        return { rows: [] as SerpRow[], query: "" };
      }
    })();
    const rows: SerpRow[] = payload.rows || [];
    const query: string = payload.query || "";

    console.log(`[DealSense PE] Scoring ${rows.length} opportunities...`);

    const out = rows
      .map((r) => {
        const sc = scoreRow(r, query);
        return {
          ...r,
          peScore: sc.score,
          peLabel: sc.label,
          peFactors: sc.factors,
          peSignals: sc.signals,
          analystNote: sc.analystNote,
        };
      })
      .sort((a, b) => b.peScore - a.peScore);

    console.log(
      `[DealSense PE] Top 3 scores: ${out
        .slice(0, 3)
        .map((r) => `${r.peScore} (${r.title?.slice(0, 40)})`)
        .join(", ")}`
    );

    return JSON.stringify(out);
  },
});
