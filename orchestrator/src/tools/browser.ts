// src/tools/browser.ts
import { DynamicTool } from "@langchain/core/tools";
import { chromium, webkit, BrowserContext, Page } from "playwright";

console.log("[browser] build tag: crexi-fix-v2-stealth", new Date().toISOString());

// ------------------- runtime config & helpers -------------------
const CAPTURE_ON_BLOCK = String(process.env.CAPTURE_ON_BLOCK || "true").toLowerCase() === "true";
const BRIGHTDATA_STICKY_SESSION = String(process.env.BRIGHTDATA_SESSION || "").trim(); // optional "-session-xxx"
const DEBUG_SLOWMO = Number(process.env.BROWSER_SLOWMO || "0"); // ms slowMo for debugging (headed dev)

const CREXI_DETAIL_RX = /https?:\/\/(?:www\.)?crexi\.com\/(?:property|sale|lease)\/[^/?#]+\/[a-z0-9]+/i;
const CREXI_LIST_RX = /https?:\/\/(?:www\.)?crexi\.com\/properties\//i;
const CREXI_NON_DETAIL_DISALLOWED =
  /\/(?:for-sale|for-lease|tenants|categories|search|results|brokerage|brokerages)\/|\/(TX|CA|FL|NY|IL|GA|NC|VA|WA|AZ|MA|TN|CO|MD|OR|MI|MO|WI|MN|AL|LA|KY|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|RI|MT|DE|SD|ND|AK|VT|WY)\//i;

// small helper for unique console timers
function timerLabel(prefix = "[phase]") {
  return `${prefix}-${Date.now() % 100000}`;
}

async function withTimeoutBound<T>(p: Promise<T>, ms: number, label?: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label || 'operation'} timeout after ${ms}ms`)), ms))
  ]);
}

function isCrexiDetailUrl(u: string) {
  try {
    return /crexi\.com/i.test(u) && CREXI_DETAIL_RX.test(u) && !CREXI_NON_DETAIL_DISALLOWED.test(u);
  } catch { return false; }
}

async function waitForVisibleAny(page: Page, selectors: string[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    for (const sel of selectors) {
      try {
        const ok = await page.locator(sel).first().isVisible({ timeout: 150 });
        if (ok) return sel;
      } catch {}
    }
    if (Date.now() > deadline) break;
    await page.waitForTimeout(50);
  }
  throw new Error(`waitForVisibleAny timeout after ${timeoutMs}ms`);
}

async function waitForCrexiDetailReady(page: Page, timeoutMs = 6000) {
  const winner = await Promise.race([
    (async () => { const end = Date.now() + timeoutMs; while (Date.now() < end) { if (isCrexiDetailUrl(page.url())) return "url-pattern"; await page.waitForTimeout(50);} throw new Error("detail-url timeout"); })(),
    (async () => { 
      const sel = await waitForVisibleAny(page, [
        "h1",
        "[itemprop='price']",
        "address,[itemprop='address']",
        "[data-testid*='price']",
        "[class*='price']",
        "[data-testid='property-title']",
        "[data-testid='property-header']",
        "[data-testid*='card']",
        "[class*='card']",
        "a[href*='/property/']"
      ], timeoutMs); 
      return `selector:${sel}`; 
    })(),
  ]);
  return winner;
}

// Timeout wrapper for extraction
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

export const browseAndExtract = new DynamicTool({
  name: "browse_and_extract",
  description:
    "Open a URL and extract listing fields (title, price, address, capRate, noi). Input: {url:string, selectors?:object}",
  func: async (input: string) => {
    console.log("[browse_and_extract] 🚀 Starting browser extraction");
    const { url, selectors } = JSON.parse(input);
    console.log("[browse_and_extract] 📍 Target URL:", url);

    // 1) Try mobile Safari (WebKit) first — friendlier on some CRE sites
    console.log("[browse_and_extract] 📱 Trying mobile WebKit first (timeout: 30s)...");
    const wk = await withTimeout(
      runOnce("mobile", url, selectors),
      30000,
      "Mobile WebKit extraction timeout after 30s"
    ).catch((e) => {
      console.log("[browse_and_extract] ⚠️ Mobile WebKit failed:", e.message);
      return null;
    });
    
    if (wk && wk.blocked !== true) {
      console.log("[browse_and_extract] ✅ Mobile WebKit succeeded!");
      return JSON.stringify(wk);
    }

    // 2) Fallback to desktop Chromium
    console.log("[browse_and_extract] 🖥️ Falling back to desktop Chromium (timeout: 30s)...");
    const ch = await withTimeout(
      runOnce("desktop", url, selectors),
      30000,
      "Desktop Chromium extraction timeout after 30s"
    ).catch((e) => {
      console.log("[browse_and_extract] ⚠️ Desktop Chromium failed:", e.message);
      return null;
    });
    
    if (ch) {
      console.log("[browse_and_extract] ✅ Desktop Chromium succeeded!");
      return JSON.stringify(ch);
    }
    
    console.log("[browse_and_extract] ❌ Both browsers failed - returning blocked result");
    return JSON.stringify({
      title: null,
      address: null,
      askingPrice: null,
      noi: null,
      capRate: null,
      screenshotBase64: null,
      autoDrilled: false,
      finalUrl: url,
      blocked: true,
    });
  },
});

type Extracted = {
  title: string | null;
  address: string | null;
  askingPrice: number | null;
  noi: number | null;
  capRate: number | null;
  screenshotBase64: string | null;
  autoDrilled?: boolean;
  finalUrl?: string;
  blocked?: boolean;
};

function looksDetail(u: string) {
  return isCrexiDetailUrl(u) || /(loopnet\.com\/Listing\/)/i.test(u);
}

async function runOnce(
  mode: "mobile" | "desktop",
  url: string,
  selectors?: Record<string, string>
): Promise<Extracted> {
  const { ctx, page, close } = await launchContext(mode);
  try {
    // (Optional) very small warm-up; bounded
    if (/crexi\.com/i.test(url)) { try { await page.goto("https://www.crexi.com", { waitUntil: "commit", timeout: 8000 }); await page.waitForTimeout(200);} catch {} }

    console.log("[runOnce] ✅ Page loaded, checking if need to drill...");
    await gotoWithGrace(page, url);
    let finalUrl = page.url();
    let autoDrilled = false;

    // Bounded SPA readiness race before drilling
    if (/crexi\.com/i.test(finalUrl)) {
      try {
        const winner = await waitForCrexiDetailReady(page, 6000);
        console.log(`[browse] SPA readiness winner: ${winner}`);
      } catch (e: any) {
        console.log("[browse] SPA readiness timed out:", e?.message);
      }
    }

    // If bounced to home/category, SPA-settle + auto-drill to real detail links
    if (!looksDetail(finalUrl)) {
      console.log("[runOnce] 🔄 Not a detail page, looking for drill links...");
      try {
        await Promise.race([
          (async () => {
            await page.waitForTimeout(700);

            // Collect up to 5 candidate detail URLs
            const hrefs = await withTimeout(findDetailHrefs(page, 5), 6000, "findDetailHrefs 6s").catch(() => []);
            console.log("[runOnce] 🔗 Drill candidates:", hrefs.length);

            for (const href of hrefs) {
              try {
                await withTimeout(gotoWithGrace(page, href), 12000, "drill goto 12s");
                finalUrl = page.url();
                if (looksDetail(finalUrl)) {
                  autoDrilled = true;
                  console.log("[runOnce] ✅ Drilled to detail:", finalUrl);
                  break; // we're on a true detail now
                }
              } catch (e: any) {
                console.log("[runOnce] ⚠️ Drill candidate failed:", href, e?.message);
              }
            }
          })(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("drill phase timeout 8s")), 8000)),
        ]);
      } catch (e: any) {
        console.log("[runOnce] ⚠️ Drill step timed out:", e?.message);
      }
    }

    // Blocked / empty-shell guard
    console.log("[runOnce] 🔍 Checking if blocked...");
    let title: string | null = null;
    try { title = (await page.title()) || null; } catch {}

    // Home detection by URL/title
    let isHome = false;
    try {
      const u = new URL(finalUrl);
      isHome = /crexi\.com$/i.test(u.hostname) && (u.pathname === "" || u.pathname === "/");
    } catch {}
    const homeTitle = !!(title && /^www\.crexi\.com/i.test(title));

    console.log("[runOnce] 🏠 Checking home bounce...");
    const looksHomeBounce =
      (isHome || homeTitle) &&
      !(await page.locator("h1,[itemprop='price'],address").first().isVisible({ timeout: 500 }).catch(() => false));

    const blocked =
      !title ||
      /access denied|chrome-error/i.test(title) ||
      looksHomeBounce;

    console.log(`[runOnce] Blocked check: ${blocked}, Title: ${title}`);

    if (blocked) {
      console.log("[runOnce] ❌ Page is blocked/empty - capturing screenshot (if enabled) and returning");
      let shot = null;
      if (CAPTURE_ON_BLOCK) {
        try {
          shot = await withTimeoutBound(safeScreenshot(page, { fullPage: false }), 5000, "safeScreenshotOnBlock").catch(() => null);
          console.log("[runOnce] 📸 Block screenshot size:", shot ? `${Math.round(shot.length/1024)}KB` : "none");
        } catch (e) {
          console.log("[runOnce] ⚠️ screenshot on block failed:", (e as Error).message?.slice?.(0,200) || e);
        }
      }
      return {
        title: title || "Access Denied",
        address: null,
        askingPrice: null,
        noi: null,
        capRate: null,
        screenshotBase64: shot,
        autoDrilled,
        finalUrl,
        blocked: true,
      };
    }

    // Extract once with timeout
    console.log("[extract] 📊 Starting data extraction (timeout: 15s)...");
    let extracted = await withTimeout(
      extractOnce(page, selectors || {}),
      15000,
      "Extraction timeout after 15s"
    ).catch((e) => {
      console.error("[extract] ❌ Extraction failed:", e.message);
      return {
        title: null,
        address: null,
        askingPrice: null,
        noi: null,
        capRate: null,
      };
    });
    
    console.log("[extract] ✅ Initial extraction complete:", {
      hasTitle: !!extracted.title,
      hasAddress: !!extracted.address,
      hasPrice: extracted.askingPrice !== null,
      hasNOI: extracted.noi !== null,
      hasCapRate: extracted.capRate !== null
    });
    
    // Capture screenshot for progressive display
    console.log("[extract] 📸 Capturing screenshot...");
    let shot = await safeScreenshot(page);
    console.log(`[extract] Screenshot result: ${shot ? `${shot.length} chars` : 'NULL'}`);

    // Second-chance auto-drill: if all nulls and not drilled yet, try one more time
    const allNull =
      !extracted.title && !extracted.address &&
      extracted.askingPrice == null && extracted.noi == null && extracted.capRate == null;

    if (allNull && !autoDrilled) {
      console.log("[extract] ⚠️ All fields null - attempting auto-drill to detail page...");
      const detailHref2 = await findDetailHref(page);
      if (detailHref2) {
        console.log("[extract] 🔗 Found detail link:", detailHref2);
        autoDrilled = true;
        await gotoWithGrace(page, detailHref2);
        finalUrl = page.url();
        console.log("[extract] 📊 Re-extracting from detail page...");
        extracted = await extractOnce(page, selectors || {});
        shot = await safeScreenshot(page);
        console.log("[extract] ✅ Second extraction complete");
      } else {
        console.log("[extract] ⚠️ No detail link found for auto-drill");
      }
    }

    console.log("[extract] 🎉 Extraction complete - returning results");
    return { ...extracted, screenshotBase64: shot, autoDrilled, finalUrl };
  } finally {
    await close();
  }
}

async function findDetailHref(page: Page) {
  // Prefer anchors within cards first, then scan all; play nice with tight timeouts
  try {
    const href = await page.evaluate(() => {
      const DETAIL = /https?:\/\/(?:www\.)?crexi\.com\/(?:property|sale|lease)\/[^/?#]+\/[a-z0-9]+/i;
      const pools = [
        document.querySelectorAll("[data-testid*='card'] a[href]"),
        document.querySelectorAll("[class*='card'] a[href]"),
      ];
      for (const pool of pools) {
        for (const a of Array.from(pool) as HTMLAnchorElement[]) {
          if (DETAIL.test(a.href)) return a.href;
        }
      }
      return null;
    });
    if (href) return href;
  } catch {}
  try {
    const href = await page.evaluate(() => {
      const DETAIL = /https?:\/\/(?:www\.)?crexi\.com\/(?:property|sale|lease)\/[^/?#]+\/[a-z0-9]+/i;
      for (const a of Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[]) if (DETAIL.test(a.href)) return a.href;
      return null;
    });
    return href;
  } catch { return null; }
}

async function findDetailHrefs(page: Page, limit = 5): Promise<string[]> {
  try {
    return await page.evaluate((arg: { rxSrc: string; limitCount: number }) => {
      const DETAIL = new RegExp(arg.rxSrc, "i");
      const anchors = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
      const out: string[] = [];
      const seen = new Set<string>();
      for (const a of anchors) {
        const href = a.href;
        if (DETAIL.test(href) && !seen.has(href)) {
          seen.add(href);
          out.push(href);
          if (out.length >= arg.limitCount) break;
        }
      }
      return out;
    }, { rxSrc: CREXI_DETAIL_RX.source, limitCount: limit });
  } catch {
    return [];
  }
}

/** Headed-mode toggles via env:
 *  BROWSER_HEADED=true | false
 *  BROWSER_ENGINE=chromium | webkit    (optional override)
 *  BROWSER_DEVTOOLS=true               (Chromium only)
 */
async function launchContext(mode: "mobile" | "desktop") {
  const headed   = String(process.env.BROWSER_HEADED   || "").toLowerCase() === "true";
  const devtools = String(process.env.BROWSER_DEVTOOLS || "").toLowerCase() === "true";
  const engine   = (process.env.BROWSER_ENGINE || "").toLowerCase(); // chromium|webkit

  const useWebkit   = engine ? engine === "webkit"   : mode === "mobile";
  const useChromium = engine ? engine === "chromium" : mode === "desktop";

  // Bright Data proxy configuration with sticky session support
  const brightDataUser = process.env.BRIGHTDATA_USERNAME;
  const brightDataPass = process.env.BRIGHTDATA_PASSWORD;
  const brightDataHost = process.env.BRIGHTDATA_HOST || "brd.superproxy.io:33335";
  const useBrightData = !!(brightDataUser && brightDataPass);
  
  const proxyConfig = useBrightData ? {
    server: `http://${brightDataHost}`,
    username: brightDataUser + (BRIGHTDATA_STICKY_SESSION ? `-session-${BRIGHTDATA_STICKY_SESSION}` : ""),
    password: brightDataPass!,
  } : undefined;
  
  console.log(`[browser] 🚀 Launching ${useWebkit ? 'WebKit' : 'Chromium'} (${mode} mode)`);
  if (useBrightData) {
    console.log(`[browser] 🌐 Using Bright Data proxy: ${brightDataHost}`);
    console.log(`[browser] 👤 Username: ${brightDataUser?.substring(0, 10)}${BRIGHTDATA_STICKY_SESSION ? ` (session: ${BRIGHTDATA_STICKY_SESSION})` : ''}...`);
  } else {
    console.log(`[browser] ⚠️  NO PROXY - Direct connection`);
  }

  // --- WebKit (mobile) ---
  if (useWebkit) {
    const browser = await webkit.launch({ headless: !headed, proxy: proxyConfig, slowMo: DEBUG_SLOWMO || undefined });
    const ctxOpts: any = {
      viewport: mode === "mobile" ? { width: 390 + Math.floor(Math.random()*2), height: 844 } : { width: 1366, height: 900 },
      userAgent: mode === "mobile"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      ignoreHTTPSErrors: true,
    };
    const ctx = await browser.newContext(ctxOpts);
    // block heavy assets (fonts/media) to speed up
    await ctx.route("**/*", (route) => {
      const url = route.request().url();
      if (/\.(woff2?|ttf|otf|mp4|webm|ogg)$/.test(url) || route.request().resourceType() === "media") return route.abort();
      return route.continue();
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(4000);
    page.setDefaultNavigationTimeout(20000);
    return { ctx, page, close: () => browser.close() };
  }

  // --- Chromium (desktop) ---
  if (useChromium) {
    const browser = await chromium.launch({
      headless: !headed,
      devtools,
      slowMo: DEBUG_SLOWMO || undefined,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-site-isolation-trials",
        "--no-first-run",
        "--no-default-browser-check",
        headed ? "--start-maximized" : "--disable-gpu",
      ].filter(Boolean),
      proxy: proxyConfig,
    });

    const contextOptions: any = {
      viewport: headed ? null : { width: 1920 + Math.floor(Math.random()*20), height: 1080 },
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    };

    const ctx = await browser.newContext(contextOptions);

    // more convincing navigator + feature spoofing
    await ctx.addInitScript(() => {
      // navigator spoofing (do not remove)
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      // @ts-ignore
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => 0 });
      // @ts-ignore
      delete navigator.__proto__.webdriver;
    });

    // block heavy assets
    await ctx.route("**/*", (route) => {
      const url = route.request().url();
      if (/\.(woff2?|ttf|otf|mp4|webm|ogg)$/.test(url) || route.request().resourceType() === "media") return route.abort();
      return route.continue();
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(4000);
    page.setDefaultNavigationTimeout(20000);

    return { ctx, page, close: () => browser.close() };
  }

  // Fallback
  const browser = await chromium.launch({ headless: !headed, devtools });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  page.setDefaultNavigationTimeout(20000);
  return { ctx, page, close: () => browser.close() };
}

async function gotoWithGrace(page: Page, u: string) {
  const start = Date.now();
  const label = timerLabel("[browse] goto");
  console.log(`${label} 🌐 Opening URL: ${u}`);

  // 1) try commit-first (fast), then fallback to domcontentloaded
  try {
    console.time(label);
    await page.goto(u, { waitUntil: "commit", timeout: 15000 });
    // give a short DOM settle
    await page.waitForLoadState("domcontentloaded", { timeout: 4000 }).catch(() => {});
    console.timeEnd(label);
    console.log(`${label} ✅ Commit successful in ${Date.now() - start}ms`);
  } catch (err1) {
    console.warn(`${label} ⚠️ commit goto failed: ${String(err1).slice(0,100)}`);
    try {
      const fallbackLabel = timerLabel("[browse] goto-fallback");
      console.time(fallbackLabel);
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 12000 });
      console.timeEnd(fallbackLabel);
      console.log(`${fallbackLabel} ✅ DOMContentLoaded fallback success in ${Date.now() - start}ms`);
    } catch (err2) {
      console.error(`${label} ❌ Both goto strategies failed: ${String(err2).slice(0,200)}`);
      throw new Error(`Failed to load page: ${u}`);
    }
  }

  // 2) cheap Cloudflare/challenge probe using small selector checks
  const challengeDetected = await Promise.race([
    page.locator("text=/Verify you are human/i").first().isVisible({ timeout: 350 }).catch(() => false),
    page.locator("form#challenge-form, #cf-please-wait, #challenge-form").first().isVisible({ timeout: 350 }).catch(() => false),
  ]).then(Boolean);

  if (challengeDetected) {
    console.warn("[browse] 🛡️ Challenge interstitial detected - sleeping 8s to allow auto-resolve");
    await page.waitForTimeout(8000); // allow BrightData or human-solve (if enabled)
  } else {
    console.log("[browse] ✅ No CF challenge detected");
  }

  // 3) short network idle attempt (bounded)
  try {
    await page.waitForLoadState("networkidle", { timeout: 3000 });
    console.log("[browse] ✅ Network idle");
  } catch {
    console.log("[browse] ⚠️ networkidle not reached after 3s (continuing)");
  }

  // 4) Minimal human-like simulation
  try {
    await page.waitForTimeout(600);
    // small random scroll to trigger lazy-load for cards
    await page.mouse.wheel(0, 300 + Math.floor(Math.random()*200));
    await page.waitForTimeout(250);
  } catch (e) {
    console.log("[browse] ⚠️ Human simulation minor error", (e as any)?.message?.slice?.(0,100) || e);
  }

  console.log(`[browse] 🎉 Total goto time ${Date.now() - start}ms`);
}

function toNum(v: any) {
  return v ? Number(String(v).replace(/[^0-9.]/g, "")) : null;
}

async function extractOnce(page: Page, sels: Record<string, string>) {
  // Title
  let title: string | null = null;
  try { title = (await page.title()) || null; } catch {}

  // Address via selectors - reduced timeout to 300ms
  const addrSelectors = [
    sels.address,
    "address",
    '[itemprop="address"]',
    '[class*="address"]',
    '[data-testid*="address"]',
    ".Address, .property-address, .listing-address",
  ].filter(Boolean) as string[];
  let addressFromSelectors: string | null = null;
  for (const sel of addrSelectors) {
    try {
      const t = await page.locator(sel).first().innerText({ timeout: 300 });
      if (t && t.trim().length > 0) { addressFromSelectors = t.trim(); break; }
    } catch {}
  }

  // Meta tags (price/address) - reduced timeout to 300ms
  let metaPrice: number | null = null, metaAddress: string | null = null;
  try {
    const content = await page.locator('meta[itemprop="price"], meta[property="product:price:amount"]').first()
      .getAttribute("content", { timeout: 300 });
    if (content) metaPrice = Number(String(content).replace(/[^0-9.]/g, "")) || null;
  } catch {}
  try {
    const street = await page.locator('meta[itemprop="streetAddress"]').first()
      .getAttribute("content", { timeout: 300 });
    if (street) metaAddress = street.trim();
  } catch {}

  // JSON-LD
  let jsonldPrice: number | null = null, jsonldAddress: string | null = null;
  try {
    const jsonld = await page.$$eval('script[type="application/ld+json"]',
      (nodes) => nodes.map(n => n.textContent || "").slice(0, 3));
    for (const raw of jsonld) {
      try {
        const obj = JSON.parse(raw || "{}");
        const price = obj?.offers?.price ?? obj?.price;
        const addr  = obj?.address?.streetAddress ||
                      (obj?.address && (obj.address.addressLocality || obj.address.addressRegion));
        if (price && jsonldPrice == null) jsonldPrice = Number(String(price).replace(/[^0-9.]/g, ""));
        if (addr  && jsonldAddress == null) jsonldAddress = String(addr);
      } catch {}
    }
  } catch {}

  // Body text regex fallback
  let bodyText = "";
  try { bodyText = await page.locator("body").innerText({ timeout: 4000 }); }
  catch { try { bodyText = await page.evaluate(() => document.body?.innerText || ""); } catch {} }

  const priceRegex = /\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i;
  const noiRegex   = /NOI[^\$\d]*\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i;
  const capRegex   = /(cap\s*rate\s*[:\-]?\s*)([0-9]+(?:\.[0-9]+)?)\s*%/i;

  // Address regex last-resort
  let addressRegexGuess: string | null = null;
  const addrMatch =
    bodyText.match(/\d{2,5}\s+[^\n,]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/) ||
    bodyText.match(/\d{2,5}\s+[^\n,]+,\s*[A-Za-z\s]+/);
  if (addrMatch) addressRegexGuess = addrMatch[0].trim();

  const askingPrice = (metaPrice ?? jsonldPrice) ?? toNum(bodyText.match(priceRegex)?.[1] ?? null);
  const noi         = toNum(bodyText.match(noiRegex)?.[1] ?? null);
  const capRate     = (() => { const c = bodyText.match(capRegex)?.[2] ?? null; return c ? Number(c) / 100 : null; })();
  const address     = addressFromSelectors ?? jsonldAddress ?? metaAddress ?? addressRegexGuess;

  return { title, address, askingPrice, noi, capRate };
}

async function safeScreenshot(page: Page, opts: { fullPage?: boolean } = { fullPage: false }): Promise<string | null> {
  try {
    // small bounded wrapper - 3s
    const buf = await withTimeoutBound(page.screenshot({ fullPage: !!opts.fullPage }), 3000, "screenshot");
    return Buffer.from(buf).toString("base64");
  } catch (e) {
    console.log("[screenshot] ❌ screenshot failed:", (e as Error).message?.slice?.(0,100) || e);
    try {
      // last resort: capture small viewport
      const buf2 = await withTimeoutBound(page.screenshot({ fullPage: false, timeout: 2000 }), 2500, "screenshot2");
      return Buffer.from(buf2).toString("base64");
    } catch {
      return null;
    }
  }
}
