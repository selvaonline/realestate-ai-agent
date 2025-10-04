// src/extractors/brevitasExtractor.ts
import type { Page } from "playwright";

export interface Extracted {
  title: string | null;
  address: string | null;
  askingPrice: number | null;
  noi: number | null;
  capRate: number | null;
  tenant: string | null;
  market?: { metro?: string | null };
  source: { domain: string; url: string; confidence?: number };
  finalUrl?: string;
  blocked?: boolean;
}

async function safeText(page: Page, selector: string): Promise<string | null> {
  try {
    const el = page.locator(selector).first();
    const t = await el.innerText({ timeout: 600 });
    return (t || "").trim() || null;
  } catch {
    return null;
  }
}

function toNum(s: string | null): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  return isFinite(n) ? n : null;
}

// Heuristics for Brevitas listing pages:
// - Title: h1, or [data-test*='title']
// - Address: address tag, or '[class*="address"]'
// - Price: elements containing "Price" label or '$'
// - Cap rate: elements containing "Cap Rate"
export async function brevitasExtractor(page: Page, url: string): Promise<Extracted> {
  // Title
  const title =
    (await safeText(page, "h1")) ??
    (await safeText(page, "[data-test*='title'], [class*='title']"));

  // Address
  const address =
    (await safeText(page, "address")) ??
    (await safeText(page, "[class*='address'], [data-test*='address']"));

  // Price
  let priceText =
    (await safeText(page, "text=/^Price\\b/i")) ??
    (await safeText(page, "text=/Asking Price/i")) ??
    (await safeText(page, "text=/\\$[\\d,]+/"));

  // Cap Rate
  let capText =
    (await safeText(page, "text=/Cap\\s*Rate/i")) ??
    (await safeText(page, "[class*='cap'], [data-test*='cap']"));

  const capRate =
    capText && /([0-9]+(?:\.[0-9]+)?)\s*%/i.test(capText)
      ? parseFloat(RegExp.$1) / 100
      : null;

  const askingPrice = toNum(priceText);

  // NOI is rarely explicit on Brevitas cards; leave null unless clearly labeled.
  let noiText = await safeText(page, "text=/\\bNOI\\b/i");
  const noi = toNum(noiText);

  // Tenant often not labeled on Brevitas; you may infer from title later.
  const tenant = null;

  return {
    title,
    address,
    askingPrice,
    noi,
    capRate,
    tenant,
    market: { metro: null },
    source: { domain: "brevitas.com", url, confidence: 0.8 },
    finalUrl: page.url(),
    blocked: false,
  };
}
