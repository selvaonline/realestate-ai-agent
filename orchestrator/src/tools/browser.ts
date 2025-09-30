// src/tools/browser.ts
import { DynamicTool } from "@langchain/core/tools";
import { chromium, webkit, BrowserContext, Page } from "playwright";

export const browseAndExtract = new DynamicTool({
  name: "browse_and_extract",
  description:
    "Open a URL and extract listing fields (title, price, address, capRate, noi). Input: {url:string, selectors?:object}",
  func: async (input: string) => {
    console.log("[browse_and_extract] 🚀 Starting browser extraction");
    const { url, selectors } = JSON.parse(input);
    console.log("[browse_and_extract] 📍 Target URL:", url);

    // 1) Try mobile Safari (WebKit) first — friendlier on some CRE sites
    console.log("[browse_and_extract] 📱 Trying mobile WebKit first...");
    const wk = await runOnce("mobile", url, selectors).catch((e) => {
      console.log("[browse_and_extract] ⚠️ Mobile WebKit failed:", e.message);
      return null;
    });
    
    if (wk && wk.blocked !== true) {
      console.log("[browse_and_extract] ✅ Mobile WebKit succeeded!");
      return JSON.stringify(wk);
    }

    // 2) Fallback to desktop Chromium
    console.log("[browse_and_extract] 🖥️ Falling back to desktop Chromium...");
    const ch = await runOnce("desktop", url, selectors).catch((e) => {
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
  return /(loopnet\.com\/Listing\/|crexi\.com\/property\/|crexi\.com\/sale\/properties\/[^/?#]+\/[^/?#]+|crexi\.com\/lease\/properties\/[^/?#]+\/[^/?#]+)/i
    .test(u);
}

async function runOnce(
  mode: "mobile" | "desktop",
  url: string,
  selectors?: Record<string, string>
): Promise<Extracted> {
  const { ctx, page, close } = await launchContext(mode);
  try {
    // Warm-up pass for crexi to reduce SPA bounce / soft redirect
    if (/crexi\.com/i.test(url)) {
      await page.goto("https://www.crexi.com", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400).catch(() => {});
    }

    await gotoWithGrace(page, url);
    let finalUrl = page.url();
    let autoDrilled = false;

    // If bounced to home/category, SPA-settle + auto-drill to a real detail link
    if (!looksDetail(finalUrl)) {
      try { await page.waitForTimeout(1200); } catch {}
      const detailHref = await findDetailHref(page);
      if (detailHref) {
        autoDrilled = true;
        await gotoWithGrace(page, detailHref);
        finalUrl = page.url();
      }
    }

    // Blocked / empty-shell guard
    let title: string | null = null;
    try { title = (await page.title()) || null; } catch {}

    // Home detection by URL/title
    let isHome = false;
    try {
      const u = new URL(finalUrl);
      isHome = /crexi\.com$/i.test(u.hostname) && (u.pathname === "" || u.pathname === "/");
    } catch {}
    const homeTitle = !!(title && /^www\.crexi\.com/i.test(title));

    const looksHomeBounce =
      (isHome || homeTitle) &&
      !(await page.locator("h1,[itemprop='price'],address").first().isVisible().catch(() => false));

    const blocked =
      !title ||
      /access denied|chrome-error/i.test(title) ||
      looksHomeBounce;

    if (blocked) {
      const shot = await safeScreenshot(page);
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

    // Extract once
    console.log("[extract] 📊 Starting data extraction...");
    let extracted = await extractOnce(page, selectors || {});
    console.log("[extract] ✅ Initial extraction complete:", {
      hasTitle: !!extracted.title,
      hasAddress: !!extracted.address,
      hasPrice: extracted.askingPrice !== null,
      hasNOI: extracted.noi !== null,
      hasCapRate: extracted.capRate !== null
    });
    
    let shot = await safeScreenshot(page);
    console.log("[extract] 📸 Screenshot captured");

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
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const rx = /(loopnet\.com\/Listing\/|crexi\.com\/property\/|crexi\.com\/sale\/properties\/[^/?#]+\/[^/?#]+|crexi\.com\/lease\/properties\/[^/?#]+\/[^/?#]+)/i;
    const a = anchors.find(x => rx.test(x.href));
    return a?.href || null;
  });
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

  // Bright Data proxy configuration
  const brightDataUser = process.env.BRIGHTDATA_USERNAME;
  const brightDataPass = process.env.BRIGHTDATA_PASSWORD;
  const brightDataHost = process.env.BRIGHTDATA_HOST || "brd.superproxy.io:22225";
  const useBrightData = !!(brightDataUser && brightDataPass);
  
  if (useBrightData) {
    console.log("[browser] Using Bright Data residential proxy");
  }

  if (useWebkit) {
    const browser = await webkit.launch({ headless: !headed });
    const contextOptions: any = {
      viewport: mode === "mobile" ? { width: 390, height: 844 } : { width: 1366, height: 900 },
      userAgent: mode === "mobile"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      ignoreHTTPSErrors: true,
    };
    
    // Add Bright Data proxy if configured
    if (useBrightData) {
      contextOptions.proxy = {
        server: `http://${brightDataHost}`,
        username: brightDataUser,
        password: brightDataPass,
      };
    }
    
    const ctx = await browser.newContext(contextOptions);
    const page = await ctx.newPage();
    return { ctx, page, close: () => browser.close() };
  }

  if (useChromium) {
    const browser = await chromium.launch({
      headless: !headed,
      devtools,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-site-isolation-trials",
        "--disable-web-security",
        headed ? "--start-maximized" : ""
      ].filter(Boolean),
    });
    
    const contextOptions: any = {
      viewport: headed ? null : { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      extraHTTPHeaders: { 
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
    };
    
    // Add Bright Data proxy if configured
    if (useBrightData) {
      contextOptions.proxy = {
        server: `http://${brightDataHost}`,
        username: brightDataUser,
        password: brightDataPass,
      };
    }
    
    const ctx = await browser.newContext(contextOptions);
    
    await ctx.addInitScript(() => {
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
    const page = await ctx.newPage();
    return { ctx, page, close: () => browser.close() };
  }

  // Fallback
  const browser = await chromium.launch({ headless: !headed, devtools });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  return { ctx, page, close: () => browser.close() };
}

async function gotoWithGrace(page: Page, u: string) {
  console.log("[browse] 🌐 Opening URL:", u);
  const startTime = Date.now();
  
  try {
    console.log("[browse] ⏳ Waiting for page load (timeout: 45s)...");
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 45000 });
    console.log(`[browse] ✅ Page loaded successfully in ${Date.now() - startTime}ms`);
  } catch (e: any) {
    console.warn(`[browse] ⚠️ Goto timeout/error after ${Date.now() - startTime}ms:`, e?.message);
    // Try simpler wait strategy
    try { 
      console.log("[browse] 🔄 Retrying with simpler strategy...");
      await page.goto(u, { waitUntil: "commit", timeout: 30000 }); 
      console.log(`[browse] ✅ Page committed in ${Date.now() - startTime}ms`);
    } catch (e2) {
      console.error(`[browse] ❌ Complete failure to load after ${Date.now() - startTime}ms:`, e2);
      throw new Error(`Failed to load page: ${u}`);
    }
  }
  
  // Check for Cloudflare challenge
  console.log("[browse] 🔍 Checking for Cloudflare challenge...");
  const pageContent = await page.content();
  const hasCloudflare = pageContent.includes('cloudflare') || pageContent.includes('Verify you are human');
  
  if (hasCloudflare) {
    console.log("[browse] 🛡️ Cloudflare challenge DETECTED - waiting 10 seconds for auto-solve...");
    await page.waitForTimeout(10000);
    
    // Check if we passed the challenge
    const finalContent = await page.content();
    if (finalContent.includes('Verify you are human')) {
      console.error("[browse] ❌ Cloudflare challenge FAILED - still showing CAPTCHA");
      console.error("[browse] 💡 Tip: Ensure BRIGHTDATA_* env vars are set for proxy bypass");
      // Don't throw - let extraction fail gracefully
    } else {
      console.log("[browse] ✅ Cloudflare challenge PASSED!");
    }
  } else {
    console.log("[browse] ✅ No Cloudflare challenge detected");
  }
  
  // Wait for network to settle (but don't fail if it doesn't)
  console.log("[browse] ⏳ Waiting for network idle...");
  try { 
    await page.waitForLoadState("networkidle", { timeout: 3000 }); 
    console.log("[browse] ✅ Network idle");
  } catch {
    console.log("[browse] ⚠️ Network not idle after 3s (continuing anyway)");
  }
  
  // Minimal human-like behavior
  console.log("[browse] 🖱️ Simulating human behavior...");
  try { 
    await page.waitForTimeout(1000);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(300);
    console.log("[browse] ✅ Human simulation complete");
  } catch (e) {
    console.log("[browse] ⚠️ Human simulation failed (non-critical)");
  }
  
  console.log(`[browse] 🎉 Total time: ${Date.now() - startTime}ms`);
}

function toNum(v: any) {
  return v ? Number(String(v).replace(/[^0-9.]/g, "")) : null;
}

async function extractOnce(page: Page, sels: Record<string, string>) {
  // Title
  let title: string | null = null;
  try { title = (await page.title()) || null; } catch {}

  // Address via selectors
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
      const t = await page.locator(sel).first().innerText({ timeout: 1500 });
      if (t && t.trim().length > 0) { addressFromSelectors = t.trim(); break; }
    } catch {}
  }

  // Meta tags (price/address)
  let metaPrice: number | null = null, metaAddress: string | null = null;
  try {
    const content = await page.locator('meta[itemprop="price"], meta[property="product:price:amount"]').first()
      .getAttribute("content", { timeout: 1500 });
    if (content) metaPrice = Number(String(content).replace(/[^0-9.]/g, "")) || null;
  } catch {}
  try {
    const street = await page.locator('meta[itemprop="streetAddress"]').first()
      .getAttribute("content", { timeout: 1500 });
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

async function safeScreenshot(page: Page): Promise<string | null> {
  try {
    const shot = await page.screenshot({ fullPage: true });
    return shot.toString("base64");
  } catch {
    return null;
  }
}
