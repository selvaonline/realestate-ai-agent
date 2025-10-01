// src/tools/riskBlender.ts
// Blends macro + labor + (optional) news into a 0–100 Risk Score with an analyst note.
import { DynamicTool } from "@langchain/core/tools";

type NewsItem = { source?: string; title: string; url?: string; sentiment?: "pos" | "neg" | "neu" };

type Inputs = {
  query: string;
  tenant?: string | null;
  metro?: string | null;
  data: {
    treasury10yBps: number | null; // e.g., 430 = 4.30%
    bls?: { latestRate: number | null; yoyDelta: number | null; period?: string | null };
    capSurvey?: { sector?: string; metroTier?: "A" | "B" | "C"; qCapAvg?: number | null };
    news?: NewsItem[];
  };
};

export const riskBlender = new DynamicTool({
  name: "risk_blender",
  description: "Blend rates, labor, and news into a 0–100 Risk Score and short analyst note.",
  func: async (input: string) => {
    const payload: Inputs = (() => { try { return JSON.parse(input); } catch { return { query: "", data: { treasury10yBps: null } }; }})();
    let score = 50; // neutral base
    const f: Record<string, number> = {};

    // Rates: higher 10Y => higher financing risk
    if (payload.data.treasury10yBps != null) {
      const tenY = payload.data.treasury10yBps / 10000; // convert bps→decimal
      const delta = tenY - 0.035; // baseline 3.5%
      const add = Math.max(-10, Math.min(20, Math.round(delta * 1000))); // ~0.1 per 10bps above 3.5%, capped
      score += add; f.rate = add;
    }

    // Labor: rising unemployment => risk up
    if (payload.data.bls) {
      const dy = payload.data.bls.yoyDelta ?? 0;
      const add = Math.max(-5, Math.min(10, Math.round(dy * 2))); // +2 per pp YoY increase
      score += add; f.labor = add;
    }

    // News sentiment: count naive negatives vs positives
    const news = payload.data.news || [];
    const neg = news.filter(n => /closure|bankruptcy|downgrade|lawsuit|layoff|default|distress/i.test(n.title)).length;
    const pos = news.filter(n => /expansion|opening|upgrade|acquire|record|investment/i.test(n.title)).length;
    const newsAdj = Math.max(-12, Math.min(12, (neg - pos) * 3));
    score += newsAdj; f.news = newsAdj;

    // Cap survey anchor (optional input): if provided and suggests "tight"
    if (payload.data.capSurvey?.qCapAvg != null) {
      // Without an observed deal cap, we lightly penalize cycles known for compression
      const add = -1;
      score += add; f.capSurvey = add;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const parts: string[] = [];
    if (payload.data.treasury10yBps != null) parts.push(`10Y ≈ ${(payload.data.treasury10yBps / 100).toFixed(2)}% (rate ${f.rate ?? 0})`);
    if (payload.data.bls?.latestRate != null) {
      parts.push(`U/E ${payload.data.bls.latestRate.toFixed(1)}%${payload.data.bls.period ? ` (${payload.data.bls.period})` : ""}${payload.data.bls.yoyDelta != null ? `, ΔYoY ${payload.data.bls.yoyDelta.toFixed(1)}pp` : ""} (labor ${f.labor ?? 0})`);
    }
    if (news.length) parts.push(`News ${f.news ?? 0}${neg ? ` ; neg:${neg}` : ""}${pos ? ` ; pos:${pos}` : ""}`);
    const note = parts.join(" · ") || "No macro/labor/news inputs provided.";

    return JSON.stringify({ riskScore: score, riskFactors: f, riskNote: note });
  }
});
