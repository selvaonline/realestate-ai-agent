// src/tools/riskBlender.ts
// Multi-factor risk model: rates, curve, inflation, labor, news → 0–100 Risk Score
import { DynamicTool } from "@langchain/core/tools";

type NewsItem = { title: string; sentiment?: "pos" | "neg" | "neu" };

type Inputs = {
  query: string;
  data: {
    treasury10yBps: number | null;        // e.g., 410
    treasury10yDeltaBps?: number | null;  // optional MoM delta, e.g., +15
    cpiYoY?: number | null;               // decimal, e.g., 0.032 for 3.2%
    curve2s10?: number | null;            // decimal spread (positive = steep, negative = inverted)
    bls?: { latestRate?: number | null; yoyDelta?: number | null; period?: string | null };
    nationalUnemp?: number | null;        // decimal, fallback
    news?: NewsItem[];
  };
};

export const riskBlender = new DynamicTool({
  name: "risk_blender",
  description: "Blend macro signals into a 0–100 Market Risk Score with a concise note.",
  func: async (input: string) => {
    const payload: Inputs = JSON.parse(input);
    let score = 50; // neutral baseline
    const f: Record<string, number> = {};
    const parts: string[] = [];

    // -------- Rates: 10Y level vs regime baseline ----------
    let rateAdd = 0;
    if (payload.data.treasury10yBps != null) {
      const tenY = payload.data.treasury10yBps / 10000; // decimal
      const delta = tenY - 0.035; // vs 3.5% regime baseline
      rateAdd = Math.max(-10, Math.min(20, Math.round(delta * 1000 / 10))); // 10 bps → 1 point
      score += rateAdd; f.rate = rateAdd;
      parts.push(`10Y ${(tenY * 100).toFixed(2)}%`);
    }

    // Trend (MoM bps): add/sub small swing (±6)
    if (payload.data.treasury10yDeltaBps != null) {
      const d = payload.data.treasury10yDeltaBps;
      const trendAdd = Math.max(-6, Math.min(6, Math.round(d / 10))); // 10 bps MoM → 1 point
      score += trendAdd; f.rateTrend = trendAdd;
      parts.push(`${d > 0 ? '↑' : '↓'} ${Math.abs(d)} bps MoM`);
    }

    // -------- Curve: 2s10s inversion risk ----------
    if (payload.data.curve2s10 != null) {
      const sp = payload.data.curve2s10; // decimal
      const curveAdd = sp < 0 
        ? Math.max(0, Math.min(10, Math.round(Math.abs(sp) * 1000 / 10))) 
        : Math.max(-5, Math.min(3, -Math.round(sp * 1000 / 20)));
      score += curveAdd; f.curve = curveAdd;
      parts.push(`2s10 ${(sp * 100).toFixed(1)}%`);
    }

    // -------- Inflation YoY ----------
    if (payload.data.cpiYoY != null) {
      const cpi = payload.data.cpiYoY; // decimal
      const inflAdd = Math.max(-6, Math.min(8, Math.round((cpi - 0.02) * 1000 / 10))); // 2% neutral
      score += inflAdd; f.inflation = inflAdd;
      parts.push(`CPI YoY ${(cpi * 100).toFixed(1)}%`);
    }

    // -------- Labor: metro or national fallback ----------
    const metro = payload.data.bls;
    let laborAdd = 0;
    if (metro?.yoyDelta != null) {
      laborAdd += Math.max(-5, Math.min(10, Math.round(metro.yoyDelta * 2))); // +2 per pp YoY ↑
      parts.push(`U/E ${metro.latestRate?.toFixed(1)}%${metro.period ? ` (${metro.period})` : ""}, ΔYoY ${metro.yoyDelta?.toFixed(1)}pp`);
    } else if (payload.data.nationalUnemp != null) {
      const u = payload.data.nationalUnemp; // decimal
      laborAdd += Math.max(-4, Math.min(8, Math.round((u - 0.04) * 1000 / 25))); // 25 bps → 1 point
      parts.push(`U/E (US) ${(u * 100).toFixed(1)}%`);
    }
    score += laborAdd; f.labor = laborAdd;

    // -------- News sentiment (light) ----------
    const news = payload.data.news || [];
    const neg = news.filter(n => /closure|bankruptcy|downgrade|lawsuit|layoff|default|distress/i.test(n.title)).length;
    const pos = news.filter(n => /expansion|opening|upgrade|acquire|record|investment/i.test(n.title)).length;
    const newsAdj = Math.max(-8, Math.min(8, (neg - pos) * 2)); // each net item → 2 points
    if (news.length) {
      score += newsAdj; f.news = newsAdj;
      parts.push(`News ${newsAdj >= 0 ? '+' : ''}${newsAdj}`);
    }

    // -------- Data quality scaling ----------
    const hasTenY = payload.data.treasury10yBps != null;
    const hasCurve = payload.data.curve2s10 != null;
    const hasCpi = payload.data.cpiYoY != null;
    const hasLabor = (metro?.latestRate != null) || (payload.data.nationalUnemp != null);
    const inputs = [hasTenY, hasCurve, hasCpi, hasLabor].filter(Boolean).length;

    if (inputs <= 1) {
      const shrink = 0.6; // shrink swings by 40%
      const swing = score - 50;
      score = Math.round(50 + swing * shrink);
      f.quality = -Math.round(Math.abs(swing) * (1 - shrink));
      parts.push(`(low signal confidence)`);
    }

    // Clamp 0..100 and build note
    score = Math.max(0, Math.min(100, Math.round(score)));
    const note = parts.length ? parts.join(" · ") : "Neutral macro conditions";

    console.log(`[riskBlender] ✅ Final Score: ${score}/100`);
    console.log(`[riskBlender] Factors: ${JSON.stringify(f)}`);
    console.log(`[riskBlender] Note: ${note}`);

    return JSON.stringify({ riskScore: score, riskFactors: f, riskNote: note });
  }
});
