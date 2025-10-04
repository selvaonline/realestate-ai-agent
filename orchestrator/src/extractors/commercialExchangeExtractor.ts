// src/extractors/commercialExchangeExtractor.ts
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

export async function commercialExchangeExtractor(page: Page, url: string): Promise<Extracted> {
  const title =
    (await safeText(page, "h1,[data-testid*='property-title']")) ??
    (await safeText(page, "[class*='title']"));

  const address =
    (await safeText(page, "address")) ??
    (await safeText(page, "[class*='address'],[data-testid*='address']"));

  const priceText =
    (await safeText(page, "text=/Price/i")) ??
    (await safeText(page, "text=/Asking/i")) ??
    (await safeText(page, "text=/\\$[\\d,]+/"));

  const capText =
    (await safeText(page, "text=/Cap\\s*Rate/i")) ??
    (await safeText(page, "[class*='cap']"));

  const capRate =
    capText && /([0-9]+(?:\.[0-9]+)?)\s*%/i.test(capText)
      ? parseFloat(RegExp.$1) / 100
      : null;

  const askingPrice = toNum(priceText);

  return {
    title,
    address,
    askingPrice,
    noi: null,
    capRate,
    tenant: null,
    market: { metro: null },
    source: { domain: "commercialexchange.com", url, confidence: 0.75 },
    finalUrl: page.url(),
    blocked: false,
  };
}
