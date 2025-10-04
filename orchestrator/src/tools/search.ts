import { DynamicTool } from "@langchain/core/tools";

/** ---- URL filters shared with the agent ---- */
const CREXI_DETAIL_RX =
  /https?:\/\/(?:www\.)?crexi\.com\/(?:property|sale|lease)\/[^\/?#]+\/[a-z0-9]+/i;
const CREXI_NON_DETAIL_DISALLOWED =
  /\/(?:properties|for-sale|for-lease|tenants|categories|search|results)(?:[\/?#]|$)/i;

function isCrexiDetailUrl(u: string) {
  try {
    const s = String(u);
    if (!/crexi\.com/i.test(s)) return false;
    return CREXI_DETAIL_RX.test(s) && !CREXI_NON_DETAIL_DISALLOWED.test(s);
  } catch { return false; }
}
function isDetailUrl(u: string) {
  return isCrexiDetailUrl(u)
    || /loopnet\.com\/Listing\//i.test(u)
    || /propertyshark\.com\/.*\/Property\//i.test(u)
    || /realnex\.com\/listing\//i.test(u)
    || /realtor\.com\/(commercial|realestateandhomes-detail)\//i.test(u);
}

type SearchRow = { title: string; url: string; snippet: string };
type ToolInput =
  | string
  | {
      query: string;
      preferCrexi?: boolean;   // default true
      maxResults?: number;     // default 10
      timeoutMs?: number;      // default 10000
      region?: string;         // e.g., "us"
      lang?: string;           // e.g., "en"
    };

/**
 * Serper.dev web search
 * Requires: SERPER_API_KEY
 */
export const webSearch = new DynamicTool({
  name: "web_search",
  description:
    "Search the web for property listings/news; returns top results with title,url,snippet. Accepts string or JSON {query, preferCrexi, maxResults}.",
  func: async (input: string) => {
    const key = process.env.SERPER_API_KEY;
    console.log("[search] SERPER_API_KEY loaded:", key ? `${key.substring(0, 10)}... (length: ${key.length})` : "MISSING");
    if (!key) throw new Error("SERPER_API_KEY missing");

    // Backward-compatible args
    let args: ToolInput;
    try { args = JSON.parse(input); } catch { args = input; }

    const preferCrexi = (typeof args === "object" && (args as any)?.preferCrexi !== undefined) ? !!(args as any).preferCrexi : true;
    const maxResults  = (typeof args === "object" && (args as any)?.maxResults !== undefined) ? Number((args as any).maxResults) : 10;
    const timeoutMs   = (typeof args === "object" && (args as any)?.timeoutMs !== undefined) ? Number((args as any).timeoutMs) : 10_000;
    const region      = (typeof args === "object" && (args as any)?.region) || "us";
    const lang        = (typeof args === "object" && (args as any)?.lang) || "en";

    const userQuery = typeof args === "string" ? (args as string) : (args as any).query;

    // Search across multiple CRE domains in one pass (exclude PDFs and CDN hosts)
    const DOMAINS = ["crexi.com","loopnet.com","brevitas.com","commercialexchange.com","biproxi.com"];
    const q = `${userQuery} (${DOMAINS.map(d => ` site:${d}`).join(" OR ")}) "for sale" -filetype:pdf -site:images.loopnet.com`;

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q,
          gl: region,       // country bias
          hl: lang,         // language
          num: Math.min(20, Math.max(10, (maxResults || 10) * 2)), // overfetch a bit; we'll filter
          autocorrect: true,
          page: 1,
        }),
        signal: controller.signal,
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`serper ${r.status} ${r.statusText}: ${txt}` );
      }

      const j: any = await r.json();
      
      const rowsRaw = j.organic ?? [];
      console.log("[search] serper organic count:", rowsRaw.length);
      
      // Per-domain debug (before filtering)
      const byDomainRaw = rowsRaw.reduce((m:any, v:any) => {
        try { const d = new URL(v.link).hostname.replace(/^www\./,""); m[d]=(m[d]||0)+1; } catch {}
        return m;
      }, {});
      console.log("[search] per-domain counts (raw):", byDomainRaw);

      // Normalize → rank → dedupe → cap (let agent filter by detail URL)
      let rows: SearchRow[] = (j.organic ?? []).map((v: any) => ({
        title: v?.title ?? "",
        url: v?.link ?? "",
        snippet: v?.snippet ?? "",
      })).filter((x: SearchRow) => x.url);

      // Drop PDFs and known CDN hosts
      rows = rows.filter(r => {
        try {
          const u = new URL(r.url);
          if (/\.(pdf|doc|docx)$/i.test(u.pathname)) return false;
          if (/^images\.loopnet\.com$/i.test(u.hostname)) return false;
          if (/^images[0-9]\.loopnet\.com$/i.test(u.hostname)) return false;
          return true;
        } catch { return false; }
      });

      // Log per-domain to verify diversity (after filtering)
      const byDomain = rows.reduce((m:any,x:any)=>{
        try{const d=new URL(x.url).hostname.replace(/^www\./,""); m[d]=(m[d]||0)+1;}catch{} 
        return m;
      }, {});
      console.log("[search] per-domain counts (after PDF filter):", byDomain);

      // Domain-agnostic ranking (removed CREXi bias)
      // rows are already in relevance order from SERPER

      // Dedupe by URL
      const seen = new Set<string>();
      rows = rows.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });

      return JSON.stringify(rows.slice(0, maxResults));
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new Error(`web_search timeout after ${timeoutMs}ms` );
      }
      throw e;
    } finally {
      clearTimeout(to);
    }
  },
});
