// src/agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { webSearch } from "./tools/search.js";
import { browseAndExtract } from "./tools/browser.js";
import { quickUnderwrite } from "./tools/finance.js";
import type { Deal } from "./lib/types.js";

/** ✅ Fallback URLs - Crexi only (reliable, not blocked) */
const DEMO_FALLBACK_URLS = [
  // Crexi - works reliably, not blocked
  "https://www.crexi.com/properties/2164390/texas-7-eleven",
  "https://www.crexi.com/properties/tenants/CVS_Pharmacy",
  "https://www.crexi.com/properties/tenants/7-Eleven",
  "https://www.crexi.com/properties/tenants/Walgreens",
  
  // If all real URLs fail, we'll create mock data as last resort
];

/** Detail-page patterns - Crexi prioritized (not blocked) */
const DETAIL_PATTERNS = [
  // Crexi - works best, prioritize these
  /crexi\.com\/property\//i,
  /crexi\.com\/properties\//i,
  /crexi\.com\/sale\/properties\/[^/?#]+\/[^/?#]+/i,
  /crexi\.com\/lease\/properties\/[^/?#]+\/[^/?#]+/i,
  // Other platforms (may have bot detection)
  /realtor\.com\/realestateandhomes-detail\//i,
  /realtor\.com\/commercial\//i,
  /propertyshark\.com\/.*\/Property\//i,
  /realnex\.com\/listing\//i,
  // LoopNet - keep pattern but deprioritized (often blocked)
  /loopnet\.com\/Listing\//i,
];
const isDetailUrl = (u: string) => DETAIL_PATTERNS.some((rx) => rx.test(u));

const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature: 0,
});

// simple ctx for SSE
type Ctx = { runId?: string; pub?: (kind: string, payload?: Record<string, any>) => void };
const nop = () => {};
const emit = (ctx?: Ctx, kind?: string, payload?: Record<string, any>) =>
  (ctx?.pub || nop)(kind!, payload || {});

async function tryExtractOnce(url: string) {
  const extJson = await browseAndExtract.invoke(JSON.stringify({ url }));
  const ext = JSON.parse(String(extJson));
  const uwJson = await quickUnderwrite.invoke(
    JSON.stringify({ noi: ext.noi, price: ext.askingPrice })
  );
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
    
    try {
      // Emit progress updates
      setTimeout(() => emit(ctx, "status", { label: `Loading ${url.split('/').pop()}...` }), 2000);
      setTimeout(() => emit(ctx, "status", { label: "Checking security..." }), 5000);
      setTimeout(() => emit(ctx, "status", { label: "Extracting property data..." }), 50000);
      
      const { ext, uw } = await tryExtractOnce(url);
      const blocked = ext?.blocked || /access denied/i.test(ext?.title || "");
      const meaningful =
        !!ext?.title || !!ext?.address || ext?.askingPrice != null || ext?.noi != null || ext?.capRate != null;

      console.log(`[agent] Extraction result - blocked: ${blocked}, meaningful: ${meaningful}, title: ${ext?.title}`);

      if (blocked || !meaningful) {
        console.log(`[agent] Skipping ${url} - blocked or no data`);
        continue;
      }

      console.log(`[agent] Successfully extracted from: ${url}`);
      extractionSucceeded = true;
      
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
    }
  }
  
  console.log(`[agent] Extraction attempts complete. Success: ${extractionSucceeded}, Deals: ${deals.length}`);

  // ── Demo fallback (always triggers if no deals found) ──────────────────────────
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
    
    // If all fallback URLs failed, create a mock deal
    if (deals.length === 0) {
      console.log(`[agent] All fallback URLs failed, creating mock demonstration deal`);
      emit(ctx, "answer_chunk", { text: `Here's a demonstration example (mock data): ` });
      emit(ctx, "answer_chunk", { text: `**Sample Commercial Property** located at 123 Main St, Dallas, TX 75201. ` });
      emit(ctx, "answer_chunk", { text: `The asking price is $5,000,000. ` });
      emit(ctx, "answer_chunk", { text: `The cap rate is 6.50%. ` });
      
      deals.push({
        title: "Sample Commercial Property (Mock Data)",
        url: "https://www.crexi.com",
        source: "www.crexi.com",
        address: "123 Main St, Dallas, TX 75201",
        askingPrice: 5000000,
        noi: 325000,
        capRate: 0.065,
        screenshotBase64: null,
        underwrite: { capRate: 0.065, dscr: 1.25, loanAmt: 3750000, debtSvc: 225000 },
        raw: { plan, fallback: true, mock: true, autoDrilled: false },
      });
      console.log(`[agent] Mock deal created as last resort`);
    }
  } else if (deals.length === 0) {
    console.log(`[agent] No deals found and no fallback URLs configured`);
    emit(ctx, "answer_chunk", { text: "I couldn't find any matching commercial real estate listings. " });
    emit(ctx, "answer_chunk", { text: "Try a broader search query or paste a direct property URL from Crexi or LoopNet." });
  }
  
  console.log(`[agent] Final deals count: ${deals.length}`);
  
  emit(ctx, "answer_complete", {});

  return { plan, deals, toolResult: null };
}
