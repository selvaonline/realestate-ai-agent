// src/agent.ts
import { webSearch } from "./tools/search.js";
import { browseAndExtract } from "./tools/browser.js";
import { quickUnderwrite } from "./tools/finance.js";
import { peScorePro } from "./tools/peScorePro.js"; // DealSense PE: Professional scorer
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
  // Strategy 1: Focused search with better keywords to find actual property listings
  const detailQuery = `${q} property listing for sale site:crexi.com/properties`;
  
  console.log("[agent] 🔍 Search strategy 1:", detailQuery);
  const detail = (JSON.parse(String(await webSearch.invoke(JSON.stringify({
    query: detailQuery, preferCrexi: true, maxResults: 12, timeoutMs: 9000
  })))) as Array<{ title: string; url: string; snippet: string }>) || [];
  console.log(`[agent] ✅ Strategy 1 returned ${detail.length} raw results`);
  
  // ✨ SCORE ALL RESULTS with DealSense PE algorithm
  emit(ctx, "thinking", { text: "Analyzing deal quality with DealSense PE scoring model..." });
  const scored = JSON.parse(String(await peScorePro.invoke(JSON.stringify({ rows: detail, query: q })))) as Array<{
    title: string; 
    url: string; 
    snippet: string; 
    peScore: number; 
    peLabel: string;
    peFactors: Record<string, number>;
  }>;
  
  console.log(`[agent] 📊 PE Scored ${scored.length} results. Top 3:`);
  scored.slice(0, 3).forEach((s, i) => {
    console.log(`[agent]   ${i+1}. [${s.peScore}] ${s.peLabel} - ${s.title?.slice(0, 60)}`);
  });
  
  // Emit top scored sources immediately (value even without browsing!)
  emit(ctx, "answer_chunk", { text: "<br><h2>🎯 Top Investment Opportunities</h2><p style='color:#8b9db5; margin:8px 0;'>Ranked by DealSense PE Scoring Model</p>" });
  for (const s of scored.slice(0, 5)) {
    sourceId++;
    const source = { id: sourceId, title: s.title, url: s.url, snippet: s.snippet };
    sources.push(source);
    emit(ctx, "source_found", { source });
    
    // Emit scored lead to answer with analyst rationale + chart data
    const scoreColor = s.peScore >= 80 ? '#5fc88f' : s.peScore >= 70 ? '#6b9aeb' : '#8b9db5';
    const analystNote = (s as any).analystNote || '';
    const factors = s.peFactors || {};
    
    emit(ctx, "answer_chunk", { 
      text: `<div class="deal-card" data-score="${s.peScore}" data-factors='${JSON.stringify(factors)}' style='margin:16px 0; padding:14px; background:#0b0f14; border-left:4px solid ${scoreColor}; border-radius:6px;'>
        <strong style='color:#c9d7ff; font-size:15px;'>[${sourceId}] ${s.title}</strong><br>
        <div style='margin:8px 0;'>
          <span style='color:${scoreColor}; font-size:20px; font-weight:700;'>${s.peScore}/100</span>
          ${s.peLabel ? `<span style='color:#8b9db5; margin-left:10px; font-size:14px;'>${s.peLabel}</span>` : ''}
          <button class="show-breakdown" data-card-id="${sourceId}" style='margin-left:10px; padding:4px 8px; background:#1a1f2e; border:1px solid #2a3548; color:#6b9aeb; border-radius:4px; cursor:pointer; font-size:12px;'>📊 Show Breakdown</button>
        </div>
        <div id="chart-container-${sourceId}" style='display:none; margin:12px 0; padding:12px; background:#0a0d12; border-radius:4px;'>
          <canvas id="factor-chart-${sourceId}" width="400" height="200"></canvas>
        </div>
        ${analystNote ? `<div style='color:#7c8fa6; font-size:13px; line-height:1.6; margin:8px 0; padding:8px; background:#0a0d12; border-radius:4px;'><strong>Analysis:</strong> ${analystNote}</div>` : ''}
        <a href='${s.url}' target='_blank' style='color:#6b9aeb; font-size:12px; text-decoration:none; word-break:break-all;'>${s.url}</a>
      </div>` 
    });
  }
  
  // Log all URLs and their detail status
  scored.forEach((r, i) => {
    const isDetail = r.url ? isDetailUrl(r.url) : false;
    console.log(`[agent]   ${i+1}. [${r.peScore}] ${isDetail ? '✓' : '✗'} ${r.url}`);
    if (!isDetail && r.url) {
      console.log(`[agent]      ↳ Rejected: ${r.url.includes('/tenants/') ? 'tenant page' : r.url.includes('/categories/') ? 'category page' : r.url.includes('/search') ? 'search page' : 'pattern mismatch'}`);
    }
  });
  
  // Filter for detail URLs and prioritize by score
  const MIN_BROWSE_SCORE = Number(process.env.MIN_BROWSE_SCORE || "70");
  const crexiCandidates = scored.filter((r) => r?.url && isDetailUrl(r.url) && /crexi\.com/i.test(r.url) && r.peScore >= MIN_BROWSE_SCORE);
  const otherCandidates = scored.filter((r) => r?.url && isDetailUrl(r.url) && !/crexi\.com/i.test(r.url) && r.peScore >= MIN_BROWSE_SCORE);
  let candidates: any[] = [...crexiCandidates, ...otherCandidates];
  
  console.log(`[agent] 📊 Strategy 1 filtered to ${candidates.length} detail URLs with score >= ${MIN_BROWSE_SCORE} (${crexiCandidates.length} Crexi, ${otherCandidates.length} other)`);
  if (candidates.length > 0) {
    console.log(`[agent] 🎯 Top browse candidates:`);
    candidates.slice(0, 3).forEach((c, i) => console.log(`[agent]   ${i+1}. [${c.peScore}] ${c.url}`));
  }

  // Strategy 2: Broader Crexi search (only if not enough high-scoring candidates)
  if (candidates.length < 2) {
    emit(ctx, "thinking", { text: "Expanding search criteria..." });
    const broaderQuery = `${q} commercial property site:crexi.com`;
    console.log("[agent] 🔍 Search strategy 2 (broader):", broaderQuery);
    const broader = (JSON.parse(String(await webSearch.invoke(JSON.stringify({
      query: broaderQuery, preferCrexi: true, maxResults: 12, timeoutMs: 9000
    })))) as Array<{ title: string; url: string; snippet: string }>) || [];
    console.log(`[agent] Strategy 2 returned ${broader.length} results`);
    
    // Score broader results
    const scoredBroader = JSON.parse(String(await peScorePro.invoke(JSON.stringify({ rows: broader, query: q })))) as Array<{
      title: string; url: string; snippet: string; peScore: number; peLabel: string;
    }>;
    
    const broaderCrexi = scoredBroader.filter((r) => r?.url && isDetailUrl(r.url) && /crexi\.com/i.test(r.url) && r.peScore >= MIN_BROWSE_SCORE);
    const broaderOther = scoredBroader.filter((r) => r?.url && isDetailUrl(r.url) && !/crexi\.com/i.test(r.url) && r.peScore >= MIN_BROWSE_SCORE);
    const broaderCandidates = [...broaderCrexi, ...broaderOther];
    console.log(`[agent] Strategy 2 detail URLs: ${broaderCandidates.length}`);
    
    // Add new candidates only
    for (const candidate of broaderCandidates) {
      if (!candidates.find(c => c.url === candidate.url)) {
        candidates.push(candidate);
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
  
  // Fix 1: Relax to list/brokerage pages when 0 detail URLs (let Playwright auto-drill)
  if (candidates.length === 0) {
    emit(ctx, "thinking", { text: "No detail pages found; using list page to auto-drill…" });
    const relaxedQuery = `${q} site:crexi.com`;
    console.log("[agent] 🔎 Last-resort query (accepting list/brokerage pages for drilling):", relaxedQuery);

    const relaxed = (JSON.parse(String(await webSearch.invoke(JSON.stringify({
      query: relaxedQuery, preferCrexi: true, maxResults: 10, timeoutMs: 9000
    })))) as Array<{ title: string; url: string; snippet: string }>) || [];

    // Accept ANY crexi.com page - brokerage pages have property links we can drill into
    const listPages = relaxed.filter(r => /crexi\.com/i.test(r.url) && !/\/(tenants|categories)\//.test(r.url));
    if (listPages.length > 0) {
      // Push up to 3 list pages; runOnce() will bounded-drill to detail from each
      candidates.push(...listPages.slice(0, 3));
      console.log(`[agent] ✅ Using ${candidates.length} CREXI pages for auto-drill:`, candidates.map(c => c.url));
      candidates.forEach((c, i) => emit(ctx, "source_found", { source: { id: 990 + i, ...c } }));
    } else {
      console.log("[agent] ❌ No CREXI pages found (relaxed search)");
    }
  }

  // ✨ SKIP EXTRACTION MODE - Focus on PE scoring & analytics instead of browsing
  const SKIP_EXTRACTION = String(process.env.SKIP_EXTRACTION || "true").toLowerCase() === "true";
  
  if (SKIP_EXTRACTION && sources.length > 0) {
    console.log(`[agent] ⚡ SKIP_EXTRACTION=true - generating analytics from ${sources.length} scored sources`);
    emit(ctx, "thinking", { text: "Generating portfolio analytics and market insights..." });
    
    // Calculate portfolio analytics
    const scores = sources.map((s: any) => scored.find((sc: any) => sc.url === s.url)?.peScore || 0).filter(Boolean);
    const capRates = sources.map((s: any) => {
      const sc: any = scored.find((sc: any) => sc.url === s.url);
      return sc?.peSignals?.cap;
    }).filter(Boolean);
    
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const premiumCount = scores.filter(s => s >= 80).length;
    const investmentGradeCount = scores.filter(s => s >= 70).length;
    const avgCapRate = capRates.length > 0 ? (capRates.reduce((a: number, b: number) => a + b, 0) / capRates.length) : null;
    
    // Geographic distribution
    const geoDistribution: Record<string, number> = {};
    sources.forEach((s: any) => {
      const sc: any = scored.find((sc: any) => sc.url === s.url);
      const state = sc?.peSignals?.isFL ? 'FL' : sc?.peSignals?.isTX ? 'TX' : sc?.peSignals?.isCA ? 'CA' : 'Other';
      geoDistribution[state] = (geoDistribution[state] || 0) + 1;
    });
    
    // Score distribution buckets
    const belowThreshold = scores.filter(s => s < 70).length;
    const scoreDistribution = {
      premium: premiumCount,
      investmentGrade: investmentGradeCount - premiumCount,
      belowThreshold
    };
    
    // Emit analytics with proper HTML formatting + chart data
    emit(ctx, "answer_chunk", { text: `<br><br><h2>📊 Portfolio Analytics</h2>` });
    emit(ctx, "answer_chunk", { 
      text: `<div id="portfolio-charts" style="margin:20px 0;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
          <div style="background:#0b0f14; padding:16px; border-radius:8px;">
            <h3 style="color:#c9d7ff; font-size:14px; margin:0 0 12px 0;">Score Distribution</h3>
            <canvas id="score-distribution-chart" width="300" height="200"></canvas>
          </div>
          <div style="background:#0b0f14; padding:16px; border-radius:8px;">
            <h3 style="color:#c9d7ff; font-size:14px; margin:0 0 12px 0;">Geographic Distribution</h3>
            <canvas id="geo-distribution-chart" width="300" height="200"></canvas>
          </div>
        </div>
      </div>
      <script>
        window.portfolioData = ${JSON.stringify({ scoreDistribution, geoDistribution, avgScore, minScore, maxScore, premiumCount, investmentGradeCount, sources: sources.length, avgCapRate, capRates })};
      </script>
      <br>` 
    });
    
    emit(ctx, "answer_chunk", { text: `<strong>Total Opportunities Identified</strong>: ${sources.length}<br>` });
    emit(ctx, "answer_chunk", { text: `<strong>Average Deal Quality Score</strong>: ${avgScore}/100<br>` });
    emit(ctx, "answer_chunk", { text: `<strong>Score Range</strong>: ${minScore} - ${maxScore}<br>` });
    emit(ctx, "answer_chunk", { text: `<strong>Premium Opportunities</strong> (≥80): ${premiumCount} (${Math.round(premiumCount/sources.length*100)}%)<br>` });
    emit(ctx, "answer_chunk", { text: `<strong>Investment Grade</strong> (70-79): ${investmentGradeCount - premiumCount} (${Math.round((investmentGradeCount - premiumCount)/sources.length*100)}%)<br>` });
    emit(ctx, "answer_chunk", { text: `<strong>Below Threshold</strong> (<70): ${belowThreshold} (${Math.round(belowThreshold/sources.length*100)}%)<br><br>` });
    
    if (avgCapRate) {
      emit(ctx, "answer_chunk", { text: `<strong>Average Cap Rate</strong>: ${(avgCapRate * 100).toFixed(2)}%<br>` });
      emit(ctx, "answer_chunk", { text: `<strong>Cap Rate Range</strong>: ${(Math.min(...capRates) * 100).toFixed(2)}% - ${(Math.max(...capRates) * 100).toFixed(2)}%<br><br>` });
    }
    
    emit(ctx, "answer_chunk", { text: `<strong>Geographic Distribution</strong>:<br>` });
    Object.entries(geoDistribution).sort((a, b) => b[1] - a[1]).forEach(([state, count]) => {
      emit(ctx, "answer_chunk", { text: `&nbsp;&nbsp;• <strong>${state}</strong>: ${count} ${count === 1 ? 'property' : 'properties'} (${Math.round(count/sources.length*100)}%)<br>` });
    });
    
    emit(ctx, "answer_chunk", { text: `<br><em>Analysis based on proprietary PE scoring model. For detailed property information, click source links above.</em>` });
    
    console.log(`[agent] ✅ Analytics generated. Final sources: ${sources.length}`);
    emit(ctx, "answer_complete", {});
    return { plan, deals, toolResult: null };
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
    
    // Emit initial property loading state
    emit(ctx, "property_progress", {
      property: { url },
      step: "loading",
      count: tried.length
    });
    
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
        
        // Emit screenshot even when blocked so UI can show what happened
        if (blocked && ext.screenshotBase64) {
          console.log(`[agent] Emitting blocked page screenshot (${ext.screenshotBase64.length} bytes)`);
          emit(ctx, "shot", { label: "Blocked page", b64: ext.screenshotBase64 });
          emit(ctx, "browser_preview", {
            url: ext.finalUrl || url,
            screenshot: ext.screenshotBase64,
            label: "Blocked page view"
          });
        }
        continue;
      }

      console.log(`[agent] ✅ SUCCESS! Extracted meaningful data`);
      extractionSucceeded = true;
      stopTicker();
      
      // Emit live browser preview with screenshot
      console.log(`[agent] Screenshot captured: ${ext.screenshotBase64 ? `${ext.screenshotBase64.length} bytes` : 'NULL'}`);
      if (ext.screenshotBase64) {
        console.log(`[agent] Emitting browser_preview event`);
        emit(ctx, "browser_preview", {
          url: ext.finalUrl || url,
          screenshot: ext.screenshotBase64,
          label: "Live browser view"
        });
      } else {
        console.log(`[agent] ⚠️ No screenshot to emit`);
      }
      
      // Emit screenshot for timeline
      emit(ctx, "shot", { label: "Detail page", b64: ext.screenshotBase64 || null });
      emit(ctx, "property_progress", {
        property: { 
          url: ext.finalUrl || url,
          title: ext.title,
          address: ext.address,
          screenshot: ext.screenshotBase64 
        },
        step: "screenshot",
        count: tried.length
      });
      
      // Then emit extracted data
      emit(ctx, "extracted", {
        summary: { title: ext.title, address: ext.address, price: ext.askingPrice, noi: ext.noi, cap: ext.capRate ?? uw.capRate },
      });
      emit(ctx, "property_progress", {
        property: { 
          url: ext.finalUrl || url,
          title: ext.title,
          address: ext.address,
          screenshot: ext.screenshotBase64,
          extracted: { 
            price: ext.askingPrice, 
            noi: ext.noi, 
            capRate: ext.capRate ?? uw.capRate,
            dscr: uw.dscr 
          }
        },
        step: "extracted",
        count: tried.length
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
      
      // Emit complete property progress
      emit(ctx, "property_progress", {
        property: { 
          url: ext.finalUrl || url,
          title: ext.title,
          address: ext.address,
          screenshot: ext.screenshotBase64,
          extracted: { 
            price: ext.askingPrice, 
            noi: ext.noi, 
            capRate: ext.capRate ?? uw.capRate,
            dscr: uw.dscr 
          }
        },
        step: "complete",
        count: tried.length
      });
      
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
    
    // Only emit failure message if we didn't already show scored leads
    if (sources.length === 0) {
      emit(ctx, "answer_chunk", { text: "I couldn't find any matching commercial real estate listings. " });
      emit(ctx, "answer_chunk", { text: "Try a broader search query or paste a direct property URL from Crexi or LoopNet." });
    } else {
      // We have scored sources - emit summary
      console.log(`[agent] ✅ Showing ${sources.length} PE-scored opportunities (extraction failed but scoring succeeded)`);
      emit(ctx, "answer_chunk", { text: `\n\n*Note: Unable to extract full details due to site restrictions, but ${sources.length} opportunities identified and ranked above.*` });
    }
  }
  
  console.log(`[agent] Final deals count: ${deals.length}, Sources: ${sources.length}`);
  
  emit(ctx, "answer_complete", {});

  return { plan, deals, toolResult: null };
}
