// src/tools/peScore.ts
import { DynamicTool } from "@langchain/core/tools";

type SerpRow = { title: string; url: string; snippet: string };
type ScoreInput =
  | { rows: SerpRow[]; query?: string; marketHint?: string }
  | SerpRow[];

const TENANT_WHITELIST = [
  "7-eleven","7 eleven","cvs","walgreens","walmart","starbucks","chipotle","chick-fil-a",
  "tractor supply","dollar general","family dollar","albertsons","kroger","home depot","lowe's",
  "target","costco","publix","aldi","whole foods","trader joe's","amazon","fedex","ups","dhl"
].map(s => s.toLowerCase());

const INDUSTRIAL_HINTS = [
  "industrial","warehouse","distribution","logistics","last mile","truck","yard","outdoor storage",
  "ios","equipment","fabrication","manufacturing","flex","cross-dock","dock-high","cold storage"
];

const NNN_HINTS = ["nnn","triple net","absolute net","bondable","net lease"];
const TERM_HINTS = ["long-term","long term","15-year","20-year","25-year","corporate guaranteed","investment grade","s&p","moody"];

function hasAny(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some(w => t.includes(w));
}

function numFrom(text: string | null | undefined) {
  if (!text) return null;
  const n = Number(String(text).replace(/[^0-9.]/g,""));
  return isFinite(n) ? n : null;
}

function extractSignals(r: SerpRow) {
  const t = `${r.title} ${r.snippet}`.toLowerCase();

  // price / cap / NOI regex
  const priceMatch = t.match(/\$?\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)\s?(?:asking|list|price|million|m)?/i);
  const capMatch   = t.match(/cap\s*rate[:\s-]*([0-9]+(?:\.[0-9]+)?)\s?%/i);
  const noiMatch   = t.match(/\bnoi\b[^$%0-9]*\$?\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/i);

  // asset hints
  const isIndustrial = hasAny(t, INDUSTRIAL_HINTS);
  const mentionsNNN  = hasAny(t, NNN_HINTS);
  const strongTenant = TENANT_WHITELIST.find(br => t.includes(br)) || null;
  const longTerm     = hasAny(t, TERM_HINTS);
  const credity      = hasAny(t, ["corporate","guarantee","credit tenant","investment grade"]);
  const sale         = /\/sale\//i.test(r.url) || /\bfor sale\b/i.test(t);
  const lease        = /\/lease\//i.test(r.url) || /\blease\b/i.test(t);

  // price numeric (handle millions)
  let price = priceMatch ? numFrom(priceMatch[1]) : null;
  if (price && /million|m\b/i.test(t) && price < 1000) {
    price = price * 1000000;
  }
  
  const cap   = capMatch   ? (Number(capMatch[1]) / 100) : null;
  const noi   = noiMatch   ? numFrom(noiMatch[1]) : null;

  // geography hint (quick heuristic)
  const isFL  = /florida\b|\bfl\b/i.test(t) || /\/fl(\/|$|\?)/i.test(r.url);
  const isTX  = /texas\b|\btx\b/i.test(t) || /\/tx(\/|$|\?)/i.test(r.url);
  const isCA  = /california\b|\bca\b/i.test(t) || /\/ca(\/|$|\?)/i.test(r.url);

  return { price, cap, noi, isIndustrial, mentionsNNN, strongTenant, longTerm, credity, sale, lease, isFL, isTX, isCA };
}

function scoreRow(r: SerpRow, query?: string) {
  const s = extractSignals(r);

  // Base weightings (0–100, sum of capped components)
  let score = 0;
  const factors: Record<string, number> = {};

  // 1) Relevance to industrial / query (max 30)
  const wantIndustrial = query ? /industrial|warehouse|ios|outdoor storage|logistics/i.test(query) : false;
  const rel = (s.isIndustrial ? 22 : 8) + ((s.isFL || s.isTX || s.isCA) ? 8 : 0) + (wantIndustrial ? (s.isIndustrial ? 6 : 0) : 0);
  factors.relevance = Math.min(30, rel); 
  score += factors.relevance;

  // 2) Tenant quality (max 20)
  const tenant = s.strongTenant ? 16 : 0;
  const term   = s.longTerm ? 4 : 0;
  factors.tenant = Math.min(20, tenant + term); 
  score += factors.tenant;

  // 3) Lease / NNN posture (max 15)
  const leaseScore = (s.sale || s.lease ? 5 : 0) + (s.mentionsNNN ? 10 : 0);
  factors.lease = Math.min(15, leaseScore); 
  score += factors.lease;

  // 4) Yield economics (cap/NOI/price) (max 20)
  let yieldScore = 0;
  if (s.cap != null) {
    // Higher cap rate = better yield (4% = 0, 8% = 16, 10% = 20)
    yieldScore += Math.max(0, Math.min(20, Math.round((s.cap * 100 - 4) * 4)));
  }
  if (s.noi && s.price && s.price > 0) {
    const impliedCap = s.noi / s.price;
    yieldScore += Math.max(0, Math.min(8, Math.round((impliedCap * 100 - 4) * 2)));
  }
  factors.yield = Math.min(20, yieldScore); 
  score += factors.yield;

  // 5) URL quality / bot-filter proxy (max 15)
  let urlScore = 10;
  if (/crexi\.com\/(property|sale|lease)\/[^\/]+\/[a-z0-9-]+$/i.test(r.url)) urlScore += 5; // Detail page
  if (/crexi\.com\/(profile|brokerage)\//i.test(r.url)) urlScore -= 5; // Profile page
  if (/loopnet\.com\/Listing\//i.test(r.url)) urlScore += 3; // LoopNet listing
  factors.urlQuality = Math.max(0, Math.min(15, urlScore)); 
  score += factors.urlQuality;

  // Clamp 0–100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Short label for display
  const label = [
    s.isIndustrial ? "Industrial" : "Other",
    s.mentionsNNN ? "NNN" : null,
    s.strongTenant ? `${s.strongTenant.toUpperCase()}` : null,
    s.cap != null ? `${(s.cap*100).toFixed(1)}% Cap` : null,
    s.price ? `$${(s.price/1000000).toFixed(1)}M` : null,
    s.isFL ? "FL" : s.isTX ? "TX" : s.isCA ? "CA" : null
  ].filter(Boolean).join(" · ");

  return { score, factors, signals: s, label };
}

export const peScore = new DynamicTool({
  name: "pe_score",
  description: "Compute a 0–100 Private Equity score for CRE leads from Serper rows; returns scored rows with factor breakdown.",
  func: async (input: string) => {
    const parsed: ScoreInput = (() => { 
      try { return JSON.parse(input); } 
      catch { return []; }
    })();
    
    const rows: SerpRow[] = Array.isArray(parsed) ? parsed : (parsed.rows || []);
    const query = Array.isArray(parsed) ? undefined : parsed.query;

    console.log(`[peScore] Scoring ${rows.length} rows...`);

    const out = rows.map(row => {
      const sc = scoreRow(row, query);
      return { 
        ...row, 
        peScore: sc.score, 
        peLabel: sc.label, 
        peFactors: sc.factors, 
        peSignals: sc.signals 
      };
    }).sort((a,b) => b.peScore - a.peScore);

    console.log(`[peScore] Top 3 scores: ${out.slice(0,3).map(r => `${r.peScore} (${r.title?.slice(0,40)})`).join(", ")}`);

    return JSON.stringify(out);
  }
});
