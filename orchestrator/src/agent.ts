// src/agent.ts
import { webSearch } from "./tools/search.js";
import { browseAndExtract } from "./tools/browser.js";
import { quickUnderwrite } from "./tools/finance.js";
import type { Deal } from "./lib/types.js";

/** ✅ Fallback URLs - CREXI detail pages only (avoid tenants/categories) */
const DEMO_FALLBACK_URLS = [
  // Example of a verified detail page (keep small, can be empty in prod)
  "https://www.crexi.com/properties/2164390/texas-7-eleven",
];

/** Detail-page patterns - CREXI true-detail only (avoid categories/tenants) */
const CREXI_DETAIL_PATTERNS = [
  /https?:\/\/(?:www\.)?crexi\.com\/properties\/[0-9]+\/[A-Za-z0-9\-]+/i,
  /https?:\/\/(?:www\.)?crexi\.com\/property\/[0-9]+\/[A-Za-z0-9\-]+/i,
  /https?:\/\/(?:www\.)?crexi\.com\/(?:sale|lease)\/properties\/[^\/?#]+\/[^\/?#]+/i,
];
const NON_DETAIL_CREXI = /https?:\/\/(?:www\.)?crexi\.com\/(?:properties\/[A-Z]{2}(?:\/|$)|properties\/[A-Za-z]+(?:\/|$)|properties\?|tenants|categories|search|results)(?:[\/?#]|$)/i;
const OTHER_DETAIL_PATTERNS = [
  /loopnet\.com\/Listing\//i,
  /propertyshark\.com\/.*\/Property\//i,
  /realnex\.com\/listing\//i,
  /realtor\.com\/(commercial|realestateandhomes-detail)\//i,
];
const isDetailUrl = (u: string) => {
  if (/crexi\.com/i.test(u)) {
    return CREXI_DETAIL_PATTERNS.some((rx) => rx.test(u)) && !NON_DETAIL_CREXI.test(u);
  }
  return OTHER_DETAIL_PATTERNS.some((rx) => rx.test(u));
};



// simple ctx for SSE
type Ctx = { runId?: string; pub?: (kind: string, payload?: Record<string, any>) => void };
const nop = () => {};
const emit = (ctx?: Ctx, kind?: string, payload?: Record<string, any>) =>
  (ctx?.pub || nop)(kind!, payload || {});

// Local timeout wrapper for tool calls
async function withTimeoutLocal<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${tag} timeout after ${ms}ms`)), ms)),
  ]) as Promise<T>;
}

// Cancellable status ticker for per-URL progress
function startProgressTicker(ctx: Ctx | undefined, url: string) {
  const start = Date.now();
  const labels = [
    "Loading page...",
    "Negotiating security...",
    "Settling SPA...",
    "Extracting property data...",
  ];
  let i = 0;
  const id = setInterval(() => {
    const label = labels[i % labels.length];
    emit(ctx, "status", { label: `${label} (${((Date.now() - start) / 1000).toFixed(0)}s)` });
    i++;
  }, 2500);
  return () => clearInterval(id);
}

async function tryExtractOnce(url: string) {
  console.time(`[agent] browse+extract ${url}`);
  const extJson = await withTimeoutLocal(
    browseAndExtract.invoke(JSON.stringify({ url })),
    130_000,
    "browseAndExtract"
  );
  console.timeEnd(`[agent] browse+extract ${url}`);

  const ext = JSON.parse(String(extJson));

  console.time(`[agent] underwrite ${url}`);
  const uwJson = await withTimeoutLocal(
    quickUnderwrite.invoke(JSON.stringify({ noi: ext.noi, price: ext.askingPrice })),
    5_000,
    "quickUnderwrite"
  ).catch((e) => {
    console.warn("[agent] quickUnderwrite failed:", e?.message);
    return JSON.stringify({ capRate: ext.capRate ?? null, dscr: null, loanAmt: null, debtSvc: null });
  });
  console.timeEnd(`[agent] underwrite ${url}`);

  const uw = JSON.parse(String(uwJson));
  return { ext, uw };
}

export async function runAgent(goal: string, ctx?: Ctx) {
  const q = (goal ?? "").trim();
  const isDirectUrl = /^https?:\/\//i.test(q);

  // ── Direct URL mode ──────────────────────────────────────────────────────────
  if (isDirectUrl) {
    emit(ctx, "status", { label: "Opening detail page" });
    try {
      emit(ctx, "nav", { url: q, label: "Navigating" });
      const { ext, uw } = await tryExtractOnce(q);

      const blocked = ext?.blocked || /access denied/i.test(ext?.title || "");
      const meaningful =
        !!ext?.title || !!ext?.address || ext?.askingPrice != null || ext?.noi != null || ext?.capRate != null;

      if (!blocked && meaningful) {
        emit(ctx, "shot", { label: "Detail page", b64: ext.screenshotBase64 || null });
        emit(ctx, "extracted", {
          summary: { title: ext.title, address: ext.address, price: ext.askingPrice, noi: ext.noi, cap: ext.capRate ?? uw.capRate },
        });

        return {
          plan: `Direct extraction from: ${q}`,
          deals: [
            {
              title: ext.title,
              url: ext.finalUrl || q,
              source: new URL(ext.finalUrl || q).hostname,
              address: ext.address,
              askingPrice: ext.askingPrice,
              noi: ext.noi,
              capRate: ext.capRate ?? uw.capRate,
              screenshotBase64: ext.screenshotBase64,
              underwrite: uw,
              raw: { plan: "Direct URL", directUrl: true, autoDrilled: ext.autoDrilled ?? false },
            },
          ],
          toolResult: null,
        };
      }

      emit(ctx, "status", { label: "Blocked or no data on page" });
      return { plan: `Direct extraction from: ${q}`, deals: [], toolResult: null };
    } catch (e) {
      console.error("[agent] Direct URL extraction failed:", e);
      return { plan: `Failed to extract from: ${q}`, deals: [], toolResult: null };
    }
  }

  // ── Perplexity-style flow: Thinking → Searching → Sources → Answer ──────────
  emit(ctx, "thinking", { text: "Understanding your query..." });
  
  // Simple plan - no LLM needed, we know what to search
  const plan = `Searching Crexi.com for: ${q}`;

  emit(ctx, "thinking", { text: "Searching Crexi commercial real estate listings..." });
  
  const deals: Deal[] = [];
  const sources: Array<{ id: number; title: string; url: string; snippet: string }> = [];
  let sourceId = 0;

  // ── Search: detail-first → broader → general ───────────────────────────────────
  // Strategy 1: Focused search - Crexi preferred but not strict site: restriction
  const detailQuery = `${q} crexi.com commercial real estate for sale`;
  
  console.log("[agent] Search strategy 1:", detailQuery);
  const detail = (JSON.parse(String(await webSearch.invoke(detailQuery))) as Array<{ title: string; url: string; snippet: string }>) || [];
  console.log(`[agent] Strategy 1 returned ${detail.length} results`);
  
  // DEBUG: Log all URLs returned
  detail.forEach((r, i) => {
    console.log(`[agent] Search result ${i+1}: ${r.url} | isDetail: ${r.url ? isDetailUrl(r.url) : false}`);
  });
  
  // Prioritize Crexi URLs first, then others
  const crexiCandidates = detail.filter((r) => r?.url && isDetailUrl(r.url) && /crexi\.com/i.test(r.url));
  const otherCandidates = detail.filter((r) => r?.url && isDetailUrl(r.url) && !/crexi\.com/i.test(r.url) && !/loopnet\.com/i.test(r.url));
  let candidates = [...crexiCandidates, ...otherCandidates];
  console.log(`[agent] Strategy 1 detail URLs: ${candidates.length} (${crexiCandidates.length} Crexi, ${otherCandidates.length} other)`);
  
  // Emit sources found
  for (const candidate of candidates.slice(0, 5)) {
    sourceId++;
    const source = { id: sourceId, ...candidate };
    sources.push(source);
    emit(ctx, "source_found", { source });
  }

  // Strategy 2: Broader Crexi search with tenants
  if (candidates.length < 3) {
    emit(ctx, "thinking", { text: "Expanding search criteria..." });
    const broaderQuery = `${q} crexi properties tenants commercial`;
    console.log("[agent] Search strategy 2:", broaderQuery);
    const broader = (JSON.parse(String(await webSearch.invoke(broaderQuery))) as Array<{ title: string; url: string; snippet: string }>) || [];
    console.log(`[agent] Strategy 2 returned ${broader.length} results`);
    const broaderCrexi = broader.filter((r) => r?.url && isDetailUrl(r.url) && /crexi\.com/i.test(r.url));
    const broaderOther = broader.filter((r) => r?.url && isDetailUrl(r.url) && !/crexi\.com/i.test(r.url) && !/loopnet\.com/i.test(r.url));
    const broaderCandidates = [...broaderCrexi, ...broaderOther];
    console.log(`[agent] Strategy 2 detail URLs: ${broaderCandidates.length}`);
    
    // Add new sources and candidates
    for (const candidate of broaderCandidates) {
      if (!candidates.find(c => c.url === candidate.url)) {
        candidates.push(candidate);
        if (candidates.length <= 5 && !sources.find(s => s.url === candidate.url)) {
          sourceId++;
          const source = { id: sourceId, ...candidate };
          sources.push(source);
          emit(ctx, "source_found", { source });
        }
      }
    }
  }

  // Strategy 3: General search - cast wider net but filter out LoopNet
  if (candidates.length < 2) {
    emit(ctx, "thinking", { text: "Trying broader search..." });
    const generalQuery = `${q} commercial real estate for sale`;
    console.log("[agent] Search strategy 3:", generalQuery);
    const general = (JSON.parse(String(await webSearch.invoke(generalQuery))) as Array<{ title: string; url: string; snippet: string }>) || [];
    console.log(`[agent] Strategy 3 returned ${general.length} results`);
    const generalCrexi = general.filter((r) => r?.url && isDetailUrl(r.url) && /crexi\.com/i.test(r.url));
    const generalOther = general.filter((r) => r?.url && isDetailUrl(r.url) && !/crexi\.com/i.test(r.url) && !/loopnet\.com/i.test(r.url));
    const generalCandidates = [...generalCrexi, ...generalOther];
    console.log(`[agent] Strategy 3 detail URLs: ${generalCandidates.length}`);
    
    // Add new sources and candidates
    for (const candidate of generalCandidates) {
      if (!candidates.find(c => c.url === candidate.url)) {
        candidates.push(candidate);
        if (candidates.length <= 5 && !sources.find(s => s.url === candidate.url)) {
          sourceId++;
          const source = { id: sourceId, ...candidate };
          sources.push(source);
          emit(ctx, "source_found", { source });
        }
      }
    }
  }
  
  // Dedupe and rank (CREXI first)
  const seen = new Set<string>();
  candidates = candidates
    .filter(c => {
      if (!c?.url) return false;
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    })
    .sort((a, b) => {
      const ac = /crexi\.com/i.test(a.url) ? 0 : 1;
      const bc = /crexi\.com/i.test(b.url) ? 0 : 1;
      return ac - bc;
    });

  console.log(`[agent] Total candidates after all searches: ${candidates.length}`);

  // ── Try first few detail URLs ────────────────────────────────────────────────
  if (candidates.length > 0) {
    emit(ctx, "thinking", { text: "Analyzing property listings..." });
  }
  
  const urls = candidates.map((c) => c.url).slice(0, 8);
  const tried: string[] = [];
  let extractionSucceeded = false;
  
  for (const url of urls) {
    tried.push(url);
    console.log(`[agent] Attempting to extract from: ${url}`);
    emit(ctx, "nav", { url, label: "Opening page..." });
    const PER_URL_CAP_MS = 140_000;
    const stopTicker = startProgressTicker(ctx, url);
    try {
      const { ext, uw } = await withTimeoutLocal(tryExtractOnce(url), PER_URL_CAP_MS, "perUrlAttempt");
      const blocked = ext?.blocked || /access denied/i.test(ext?.title || "");
      const meaningful =
        !!ext?.title || !!ext?.address || ext?.askingPrice != null || ext?.noi != null || ext?.capRate != null;

      console.log(`[agent] Extraction result - blocked: ${blocked}, meaningful: ${meaningful}, title: ${ext?.title}`);

      if (blocked || !meaningful) {
        console.log(`[agent] Skipping ${url} - blocked or no data`);
        stopTicker();
        continue;
      }

      console.log(`[agent] Successfully extracted from: ${url}`);
      extractionSucceeded = true;
      stopTicker();
      emit(ctx, "shot", { label: "Detail page", b64: ext.screenshotBase64 || null });
      emit(ctx, "extracted", {
        summary: { title: ext.title, address: ext.address, price: ext.askingPrice, noi: ext.noi, cap: ext.capRate ?? uw.capRate },
      });

      // Stream answer with citations
      const sourceIdx = sources.findIndex(s => s.url === (ext.finalUrl || url));
      const citationNum = sourceIdx >= 0 ? sourceIdx + 1 : null;
      
      emit(ctx, "answer_chunk", { text: `Found a promising listing${citationNum ? ` [${citationNum}]` : ''}: ` });
      emit(ctx, "answer_chunk", { text: `**${ext.title || 'Property'}** located at ${ext.address || 'address unavailable'}. ` });
      
      if (ext.askingPrice) {
        emit(ctx, "answer_chunk", { text: `The asking price is $${ext.askingPrice.toLocaleString()}. ` });
      }
      
      if (ext.noi) {
        emit(ctx, "answer_chunk", { text: `Net Operating Income (NOI) is $${ext.noi.toLocaleString()}. ` });
      }
      
      const finalCapRate = ext.capRate ?? uw.capRate;
      if (finalCapRate) {
        emit(ctx, "answer_chunk", { text: `The cap rate is ${(finalCapRate * 100).toFixed(2)}%. ` });
      }
      
      if (uw.dscr) {
        emit(ctx, "answer_chunk", { text: `DSCR is ${uw.dscr.toFixed(2)}. ` });
      }

      deals.push({
        title: ext.title,
        url: ext.finalUrl || url,
        source: new URL(ext.finalUrl || url).hostname,
        address: ext.address,
        askingPrice: ext.askingPrice,
        noi: ext.noi,
        capRate: ext.capRate ?? uw.capRate,
        screenshotBase64: ext.screenshotBase64,
        underwrite: uw,
        raw: { plan, tried, autoDrilled: ext.autoDrilled ?? false },
      });
      break; // stop after first success
    } catch (e) {
      console.error("[agent] extract failed:", url, e);
    } finally {
      try { stopTicker(); } catch {}
    }
  }
  
  console.log(`[agent] Extraction attempts complete. Success: ${extractionSucceeded}, Deals: ${deals.length}`);

  // ── Demo fallback (detail pages only; no mock data) ───────────────────────────
  if (deals.length === 0 && DEMO_FALLBACK_URLS.length > 0) {
    console.log(`[agent] No deals found, trying ${DEMO_FALLBACK_URLS.length} fallback URLs`);
    emit(ctx, "thinking", { text: "Using demonstration listing..." });
    
    // Try each fallback URL until one works
    for (const fallbackUrl of DEMO_FALLBACK_URLS) {
      console.log(`[agent] Trying fallback URL: ${fallbackUrl}`);
      try {
        const { ext, uw } = await tryExtractOnce(fallbackUrl);
        const blocked = ext?.blocked || /access denied/i.test(ext?.title || "");
        const meaningful =
          !!ext?.title || !!ext?.address || ext?.askingPrice != null || !!ext?.noi || !!ext?.capRate;

        console.log(`[agent] Fallback extraction - blocked: ${blocked}, meaningful: ${meaningful}`);

        if (!blocked && meaningful) {
          emit(ctx, "shot", { label: "Fallback detail", b64: ext.screenshotBase64 || null });
          emit(ctx, "extracted", {
            summary: { title: ext.title, address: ext.address, price: ext.askingPrice, noi: ext.noi, cap: ext.capRate ?? uw.capRate },
          });

          // Stream answer for fallback
          emit(ctx, "answer_chunk", { text: `Here's a demonstration listing: ` });
          emit(ctx, "answer_chunk", { text: `**${ext.title || 'Property'}** located at ${ext.address || 'address unavailable'}. ` });
          
          if (ext.askingPrice) {
            emit(ctx, "answer_chunk", { text: `The asking price is $${ext.askingPrice.toLocaleString()}. ` });
          }
          
          const finalCapRate = ext.capRate ?? uw.capRate;
          if (finalCapRate) {
            emit(ctx, "answer_chunk", { text: `The cap rate is ${(finalCapRate * 100).toFixed(2)}%. ` });
          }

          deals.push({
            title: ext.title,
            url: ext.finalUrl || fallbackUrl,
            source: new URL(ext.finalUrl || fallbackUrl).hostname,
            address: ext.address,
            askingPrice: ext.askingPrice,
            noi: ext.noi,
            capRate: ext.capRate ?? uw.capRate,
            screenshotBase64: ext.screenshotBase64,
            underwrite: uw,
            raw: { plan, fallback: true, autoDrilled: ext.autoDrilled ?? false },
          });
          console.log(`[agent] Fallback extraction succeeded from: ${fallbackUrl}`);
          break; // Success, stop trying other URLs
        } else {
          console.log(`[agent] Fallback URL ${fallbackUrl} failed - blocked: ${blocked}, meaningful: ${meaningful}`);
        }
      } catch (e) {
        console.error(`[agent] Fallback URL ${fallbackUrl} error:`, e);
      }
    }
    
    // If all fallback URLs failed, do not create mock data
  } else if (deals.length === 0) {
    console.log(`[agent] No deals found and no fallback URLs configured`);
    emit(ctx, "answer_chunk", { text: "I couldn't find any matching commercial real estate listings. " });
    emit(ctx, "answer_chunk", { text: "Try a broader search query or paste a direct property URL from Crexi or LoopNet." });
  }
  
  console.log(`[agent] Final deals count: ${deals.length}`);
  
  emit(ctx, "answer_complete", {});

  return { plan, deals, toolResult: null };
}
