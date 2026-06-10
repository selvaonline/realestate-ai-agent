import { DynamicTool } from "@langchain/core/tools";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { withRetry } from "../utils/retry.js";

chromium.use(StealthPlugin());

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

const DOMAINS = ["crexi.com","loopnet.com","brevitas.com","commercialexchange.com","biproxi.com"];

function buildSerperQuery(userQuery: string): string {
  return `${userQuery} (${DOMAINS.map(d => ` site:${d}`).join(" OR ")}) "for sale" -filetype:pdf -site:images.loopnet.com`;
}

/**
 * Browser-friendly query: strip advanced operators that only work well
 * via API, keep the human-readable intent, and add simple site filters.
 */
function buildBrowserQuery(userQuery: string): string {
  const cleaned = userQuery
    .replace(/\(\s*site:[^)]+\)/gi, "")      // remove grouped site: blocks
    .replace(/site:\S+/gi, "")               // remove individual site: operators
    .replace(/-filetype:\S+/gi, "")          // remove -filetype:
    .replace(/-site:\S+/gi, "")              // remove -site:
    .replace(/"for sale"/gi, "")             // remove duplicated "for sale"
    .replace(/\b(OR|AND)\b/gi, "")           // remove boolean operators
    .replace(/\d+\.\.\d+%?/g, "")           // remove range operators like 6..8%
    .replace(/[()]/g, " ")                   // remove grouping parens
    .replace(/"([^"]+)"/g, "$1")             // unquote exact-match phrases
    .replace(/\s{2,}/g, " ")                 // collapse whitespace
    .trim();
  return `${cleaned} for sale site:crexi.com OR site:loopnet.com`;
}

function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|ct|court|cir|circle|pl|place|hwy|highway)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 60);
}

function isFuzzyDuplicate(a: SearchRow, b: SearchRow): boolean {
  if (a.url === b.url) return true;
  const normA = normalizeForDedup(a.title);
  const normB = normalizeForDedup(b.title);
  if (!normA || !normB || normA.length < 10 || normB.length < 10) return false;
  if (normA.includes(normB) || normB.includes(normA)) return true;
  const shorter = Math.min(normA.length, normB.length);
  let matches = 0;
  for (let i = 0; i < shorter; i++) {
    if (normA[i] === normB[i]) matches++;
  }
  return matches / shorter > 0.8;
}

function filterAndDedupe(rows: SearchRow[], maxResults: number): SearchRow[] {
  let filtered = rows.filter(r => {
    try {
      const u = new URL(r.url);
      if (/\.(pdf|doc|docx)$/i.test(u.pathname)) return false;
      if (/^images\.loopnet\.com$/i.test(u.hostname)) return false;
      if (/^images[0-9]\.loopnet\.com$/i.test(u.hostname)) return false;
      return true;
    } catch { return false; }
  });

  const byDomain = filtered.reduce((m: any, x: any) => {
    try { const d = new URL(x.url).hostname.replace(/^www\./, ""); m[d] = (m[d] || 0) + 1; } catch {}
    return m;
  }, {});
  console.log("[search] per-domain counts:", byDomain);

  const kept: SearchRow[] = [];
  let dupeCount = 0;
  for (const row of filtered) {
    if (kept.some(k => isFuzzyDuplicate(k, row))) {
      dupeCount++;
      continue;
    }
    kept.push(row);
  }
  if (dupeCount > 0) console.log(`[search] removed ${dupeCount} fuzzy duplicate(s)`);

  return kept.slice(0, maxResults);
}

// --------------- Serper API search ---------------
async function searchViaSerper(
  q: string, maxResults: number, timeoutMs: number, region: string, lang: string
): Promise<SearchRow[]> {
  const key = process.env.SERPER_API_KEY!;
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        q, gl: region, hl: lang,
        num: Math.min(20, Math.max(10, (maxResults || 10) * 2)),
        autocorrect: true, page: 1,
      }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`serper ${r.status} ${r.statusText}: ${txt}`);
    }

    const j: any = await r.json();
    const rowsRaw = j.organic ?? [];
    console.log("[search] serper organic count:", rowsRaw.length);

    return rowsRaw.map((v: any) => ({
      title: v?.title ?? "",
      url: v?.link ?? "",
      snippet: v?.snippet ?? "",
    })).filter((x: SearchRow) => x.url);
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`web_search timeout after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(to);
  }
}

// --------------- Playwright browser search (DuckDuckGo → Google → Bing) ---------------
async function searchViaPlaywright(
  q: string, maxResults: number, timeoutMs: number
): Promise<SearchRow[]> {
  console.log("[search] 🌐 Using Playwright + stealth browser search");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-first-run", "--no-default-browser-check", "--disable-gpu"],
  });

  try {
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    const engines = [
      { name: "DuckDuckGo", fn: () => searchDuckDuckGo(page, q) },
      { name: "Google",     fn: () => searchGoogle(page, q) },
      { name: "Bing",       fn: () => searchBing(page, q) },
    ];

    for (const engine of engines) {
      try {
        const rows = await engine.fn();
        if (rows.length > 0) {
          console.log(`[search] ✅ ${engine.name} returned ${rows.length} results`);
          return rows;
        }
        console.log(`[search] ⚠️ ${engine.name} returned 0 results, trying next...`);
      } catch (e: any) {
        console.log(`[search] ⚠️ ${engine.name} failed: ${e.message}, trying next...`);
      }
    }

    console.log("[search] ❌ All search engines returned 0 results");
    return [];
  } finally {
    await browser.close();
  }
}

async function searchGoogle(page: any, q: string): Promise<SearchRow[]> {
  console.log("[search] 📎 Trying Google...");
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&num=20&hl=en`, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  await page.waitForTimeout(1000 + Math.floor(Math.random() * 500));

  // Dismiss cookie consent if present
  try {
    const consentBtn = page.locator('button:has-text("Accept all"), button:has-text("I agree"), button#L2AGLb');
    if (await consentBtn.first().isVisible({ timeout: 1500 })) {
      await consentBtn.first().click();
      await page.waitForTimeout(500);
    }
  } catch {}

  // Check for CAPTCHA / block
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  if (/unusual traffic|captcha|are not a robot/i.test(bodyText)) {
    throw new Error("Google CAPTCHA detected");
  }

  const rows: SearchRow[] = await page.evaluate(() => {
    const results: { title: string; url: string; snippet: string }[] = [];
    const items = document.querySelectorAll("#search .g, #rso .g, div[data-sokoban-container]");
    for (const item of Array.from(items)) {
      const anchor = item.querySelector("a[href]") as HTMLAnchorElement | null;
      const titleEl = item.querySelector("h3");
      const snippetEl = item.querySelector("[data-sncf], .VwiC3b, [style*='-webkit-line-clamp'], .st");
      if (!anchor?.href || !titleEl) continue;
      if (anchor.href.startsWith("https://www.google.com")) continue;
      results.push({
        title: titleEl.textContent?.trim() || "",
        url: anchor.href,
        snippet: snippetEl?.textContent?.trim() || "",
      });
    }
    return results;
  });

  if (rows.length === 0) throw new Error("No Google results extracted (layout may have changed)");
  console.log(`[search] ✅ Google returned ${rows.length} results`);
  return rows;
}

async function searchBing(page: any, q: string): Promise<SearchRow[]> {
  console.log("[search] 🔷 Trying Bing...");
  await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(q)}&count=20`, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // Dismiss cookie / consent banner
  try {
    const acceptBtn = page.locator('#bnp_btn_accept, button#bnp_btn_accept, #bnp_hfly_cta2');
    if (await acceptBtn.first().isVisible({ timeout: 2000 })) {
      await acceptBtn.first().click();
      await page.waitForTimeout(500);
    }
  } catch {}

  // Wait for actual results
  try {
    await page.waitForSelector('#b_results .b_algo, #b_results li.b_algo', { timeout: 6000 });
  } catch {}

  await page.waitForTimeout(800 + Math.floor(Math.random() * 400));

  const rows: SearchRow[] = await page.evaluate(() => {
    const results: { title: string; url: string; snippet: string }[] = [];
    const items = document.querySelectorAll("#b_results .b_algo, #b_results li.b_algo");
    for (const item of Array.from(items)) {
      const anchor = item.querySelector("h2 a[href], a[href]") as HTMLAnchorElement | null;
      const snippetEl = item.querySelector(".b_caption p, .b_lineclamp2, .b_lineclamp3, .b_paractl, p");
      if (!anchor?.href) continue;
      if (anchor.href.includes("bing.com") || anchor.href.includes("microsoft.com")) continue;
      results.push({
        title: anchor.textContent?.trim() || "",
        url: anchor.href,
        snippet: snippetEl?.textContent?.trim() || "",
      });
    }
    return results;
  });

  if (rows.length === 0) throw new Error("No Bing results extracted");
  console.log(`[search] ✅ Bing returned ${rows.length} results`);
  return rows;
}

async function searchDuckDuckGo(page: any, q: string): Promise<SearchRow[]> {
  console.log("[search] 🦆 Trying DuckDuckGo...");
  await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&ia=web`, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // Let the React app render results
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {}
  await page.waitForTimeout(3000 + Math.floor(Math.random() * 1000));

  const rows: SearchRow[] = await page.evaluate(() => {
    const results: { title: string; url: string; snippet: string }[] = [];
    const items = document.querySelectorAll('article[data-testid="result"]');
    for (const item of Array.from(items)) {
      const anchor = item.querySelector('a[data-testid="result-title-a"], h2 a[href]') as HTMLAnchorElement | null;
      const snippetEl = item.querySelector('[data-result="snippet"], [data-testid="result-snippet"]');
      if (!anchor?.href) continue;
      if (anchor.href.includes("duckduckgo.com")) continue;
      results.push({
        title: anchor.textContent?.trim() || "",
        url: anchor.href,
        snippet: snippetEl?.textContent?.trim() || "",
      });
    }
    return results;
  });

  if (rows.length === 0) throw new Error("No DuckDuckGo results extracted");
  console.log(`[search] ✅ DuckDuckGo returned ${rows.length} results`);
  return rows;
}

/**
 * Web search — uses Serper API if SERPER_API_KEY is set,
 * otherwise falls back to Playwright browser-based Google/DuckDuckGo scraping.
 */
export const webSearch = new DynamicTool({
  name: "web_search",
  description:
    "Search the web for property listings/news; returns top results with title,url,snippet. Accepts string or JSON {query, preferCrexi, maxResults}.",
  func: async (input: string) => {
    let args: ToolInput;
    try { args = JSON.parse(input); } catch { args = input; }

    const maxResults  = (typeof args === "object" && (args as any)?.maxResults !== undefined) ? Number((args as any).maxResults) : 10;
    const timeoutMs   = (typeof args === "object" && (args as any)?.timeoutMs !== undefined) ? Number((args as any).timeoutMs) : 15_000;
    const region      = (typeof args === "object" && (args as any)?.region) || "us";
    const lang        = (typeof args === "object" && (args as any)?.lang) || "en";
    const userQuery   = typeof args === "string" ? (args as string) : (args as any).query;

    const key = process.env.SERPER_API_KEY;
    console.log("[search] SERPER_API_KEY:", key ? `${key.substring(0, 10)}... (length: ${key.length})` : "MISSING → using Playwright");

    let rawRows: SearchRow[];
    if (key) {
      const serperQ = buildSerperQuery(userQuery);
      rawRows = await withRetry(
        () => searchViaSerper(serperQ, maxResults, timeoutMs, region, lang),
        { maxRetries: 1, baseDelayMs: 1000, label: 'serper-search' }
      );
    } else {
      const browserQ = buildBrowserQuery(userQuery);
      rawRows = await withRetry(
        () => searchViaPlaywright(browserQ, maxResults, timeoutMs),
        { maxRetries: 1, baseDelayMs: 2000, label: 'playwright-search' }
      );
    }

    return JSON.stringify(filterAndDedupe(rawRows, maxResults));
  },
});
