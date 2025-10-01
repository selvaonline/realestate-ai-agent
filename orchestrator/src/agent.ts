// src/agent.ts
import { webSearch } from "./tools/search.js";
import { browseAndExtract } from "./tools/browser.js";
import { quickUnderwrite } from "./tools/finance.js";
import type { Deal } from "./lib/types.js";

// ---- Shared URL patterns (strict: only actual property detail pages) ----
const CREXI_DETAIL_RX =
  /https?:\/\/(?:www\.)?crexi\.com\/(property|sale|lease|properties)\/\d+\/[^/?#]+/i;
const CREXI_NON_DETAIL_DISALLOWED =
  /\/(?:for-sale|for-lease|tenants|categories|search|results|brokerage|brokerages)\/|\/(TX|CA|FL|NY|IL|GA|NC|VA|WA|AZ|MA|TN|CO|MD|OR|MI|MO|WI|MN|AL|LA|KY|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|RI|MT|DE|SD|ND|AK|VT|WY)\//i;
const isDetailUrl = (u: string) => {
  if (/crexi\.com/i.test(u)) return CREXI_DETAIL_RX.test(u) && !CREXI_NON_DETAIL_DISALLOWED.test(u);
  return /loopnet\.com\/Listing\//i.test(u)
      || /propertyshark\.com\/.*\/Property\//i.test(u)
      || /realnex\.com\/listing\//i.test(u)
      || /realtor\.com\/(commercial|realestateandhomes-detail)\//i.test(u);
};

/** ✅ Fallback URLs - disabled for now (extraction too slow) */
const DEMO_FALLBACK_URLS: string[] = [
  // Extraction is too slow/unreliable, disabled for now
];

// simple ctx for SSE
type Ctx = { runId?: string; pub?: (kind: string, payload?: Record<string, any>) => void };
const nop = () => {};
const emit = (ctx?: Ctx, kind?: string, payload?: Record<string, any>) =>
  (ctx?.pub || nop)(kind!, payload || {});

async function withTimeoutLocal<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${tag} timeout after ${ms}ms`)), ms)),
  ]) as Promise<T>;
}

async function tryExtractOnce(url: string) {
  const label = `[agent] browse+extract ${Date.now()%100000}`;
  console.time(label);
  const extJson = await withTimeoutLocal(
    browseAndExtract.invoke(JSON.stringify({ url })),
    130_000,
    "browseAndExtract"
  );
  console.timeEnd(label);
  const ext = JSON.parse(String(extJson));
  const uwJson = await withTimeoutLocal(
    quickUnderwrite.invoke(JSON.stringify({ noi: ext.noi, price: ext.askingPrice })),
    5_000,
    "quickUnderwrite"
  ).catch(() => JSON.stringify({ capRate: ext.capRate ?? null, dscr: null, loanAmt: null, debtSvc: null }));
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
  // Strategy 1: Focused search - use simple site: filter, post-filter for detail pages
  const detailQuery = `${q} site:crexi.com`;
  
  console.log("[agent] 🔍 Search strategy 1:", detailQuery);
  const detail = (JSON.parse(String(await webSearch.invoke(JSON.stringify({
    query: detailQuery, preferCrexi: true, maxResults: 12, timeoutMs: 9000
  })))) as Array<{ title: string; url: string; snippet: string }>) || [];
  console.log(`[agent] ✅ Strategy 1 returned ${detail.length} raw results`);
  
  // Log all URLs and their detail status
  detail.forEach((r, i) => {
    const isDetail = r.url ? isDetailUrl(r.url) : false;
    console.log(`[agent]   ${i+1}. ${isDetail ? '✓' : '✗'} ${r.url}`);
    if (!isDetail && r.url) {
      console.log(`[agent]      ↳ Rejected: ${r.url.includes('/tenants/') ? 'tenant page' : r.url.includes('/categories/') ? 'category page' : r.url.includes('/search') ? 'search page' : 'pattern mismatch'}`);
    }
  });
  
  // Prioritize Crexi URLs first, then others
  const crexiCandidates = detail.filter((r) => r?.url && isDetailUrl(r.url) && /crexi\.com/i.test(r.url));
  const otherCandidates = detail.filter((r) => r?.url && isDetailUrl(r.url) && !/crexi\.com/i.test(r.url) && !/loopnet\.com/i.test(r.url));
  let candidates = [...crexiCandidates, ...otherCandidates];
  console.log(`[agent] 📊 Strategy 1 filtered to ${candidates.length} detail URLs (${crexiCandidates.length} Crexi, ${otherCandidates.length} other)`);
  if (candidates.length > 0) {
    console.log(`[agent] 🎯 Top candidates:`);
    candidates.slice(0, 3).forEach((c, i) => console.log(`[agent]   ${i+1}. ${c.url}`));
  }
  
  // Emit sources found
  for (const candidate of candidates.slice(0, 5)) {
    sourceId++;
    const source = { id: sourceId, ...candidate };
    sources.push(source);
    emit(ctx, "source_found", { source });
  }

  // Strategy 2: Broader Crexi search
  if (candidates.length < 3) {
    emit(ctx, "thinking", { text: "Expanding search criteria..." });
    const broaderQuery = `${q} commercial property site:crexi.com`;
    console.log("[agent] 🔍 Search strategy 2 (broader):", broaderQuery);
    const broader = (JSON.parse(String(await webSearch.invoke(JSON.stringify({
      query: broaderQuery, preferCrexi: true, maxResults: 12, timeoutMs: 9000
    })))) as Array<{ title: string; url: string; snippet: string }>) || [];
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
    const generalQuery = `${q} commercial real estate crexi`;
    console.log("[agent] 🔍 Search strategy 3 (broadest):", generalQuery);
    const general = (JSON.parse(String(await webSearch.invoke(JSON.stringify({
      query: generalQuery, preferCrexi: true, maxResults: 12, timeoutMs: 9000
    })))) as Array<{ title: string; url: string; snippet: string }>) || [];
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
  
  // Fix 1: Relax to list pages when 0 detail URLs (let Playwright auto-drill)
  if (candidates.length === 0) {
    emit(ctx, "thinking", { text: "No detail pages found; trying a CREXI results page to auto-drill…" });
    const relaxedQuery = `${q} site:crexi.com inurl:/properties/ -inurl:/tenants/ -inurl:/categories/`;
    console.log("[agent] 🔎 Last-resort query:", relaxedQuery);

    const relaxed = (JSON.parse(String(await webSearch.invoke(JSON.stringify({
      query: relaxedQuery, preferCrexi: true, maxResults: 5, timeoutMs: 9000
    })))) as Array<{ title: string; url: string; snippet: string }>) || [];

    const listPages = relaxed.filter(r => /crexi\.com\/properties\//i.test(r.url));
    if (listPages.length > 0) {
      // Push exactly ONE list page; runOnce() will bounded-drill to detail
      candidates.push(listPages[0]);
      console.log("[agent] ✅ Using CREXI list page for auto-drill:", listPages[0].url);
      emit(ctx, "source_found", { source: { id: 999, ...listPages[0] } });
    } else {
      console.log("[agent] ❌ No CREXI list page found either (relaxed search)");
    }
  }

  // ── Try first few detail URLs ────────────────────────────────────────────────
  if (candidates.length > 0) {
    emit(ctx, "thinking", { text: "Analyzing property listings..." });
  }
  
  const urls = candidates.map((c) => c.url).slice(0, 8);
  const tried: string[] = [];
  let extractionSucceeded = false;
  
  for (const url of urls) {
    tried.push(url);
    console.log(`\n[agent] 🌐 === EXTRACTION ATTEMPT ${tried.length}/${urls.length} ===`);
    console.log(`[agent] 📍 Target: ${url}`);
    emit(ctx, "nav", { url, label: "Opening page..." });
    
    const stopTicker = (() => {
      const start = Date.now();
      const labels = ["Loading page...","Negotiating security...","Settling SPA...","Extracting property data..."];
      let i = 0;
      const id = setInterval(() =>
        emit(ctx, "status", { label: `${labels[i++ % labels.length]} (${((Date.now()-start)/1000|0)}s)` }), 2500);
      return () => clearInterval(id);
    })();
    
    try {
      const { ext, uw } = await withTimeoutLocal(tryExtractOnce(url), 140_000, "perUrlAttempt");
      const blocked = ext?.blocked || /access denied/i.test(ext?.title || "");
      const meaningful =
        !!ext?.title || !!ext?.address || ext?.askingPrice != null || ext?.noi != null || ext?.capRate != null;

      console.log(`[agent] 📊 Extraction result:`);
      console.log(`[agent]   Blocked: ${blocked}`);
      console.log(`[agent]   Meaningful: ${meaningful}`);
      console.log(`[agent]   Title: ${ext?.title || 'null'}`);
      console.log(`[agent]   Address: ${ext?.address || 'null'}`);
      console.log(`[agent]   Price: ${ext?.askingPrice || 'null'}`);
      console.log(`[agent]   NOI: ${ext?.noi || 'null'}`);
      console.log(`[agent]   Cap Rate: ${ext?.capRate || 'null'}`);

      if (blocked || !meaningful) {
        console.log(`[agent] ❌ Skipping - ${blocked ? 'BLOCKED' : 'NO DATA'}`);
        stopTicker();
        continue;
      }

      console.log(`[agent] ✅ SUCCESS! Extracted meaningful data`);
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

      const deal: Deal = {
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
      };
      deals.push(deal);
      
      // ✅ Progressive streaming: emit deal immediately
      emit(ctx, "deal_found", { deal, count: deals.length });
      console.log(`[agent] 📤 Emitted deal ${deals.length}: ${deal.title}`);
      
      // Continue to next candidate (progressive loading)
    } catch (e) {
      console.error("[agent] extract failed:", url, e);
      stopTicker();
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
