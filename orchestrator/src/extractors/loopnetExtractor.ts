// src/extractors/loopnetExtractor.ts
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
    const el = await page.locator(selector).first();
    const t = await el.innerText({ timeout: 500 });
    return t?.trim() || null;
  } catch {
    return null;
  }
}

export async function loopnetExtractor(page: Page, url: string): Promise<Extracted> {
  const title = await safeText(page, "h1, [data-testid='listing-title']");
  const address = await safeText(page, "address,[class*='address'],[data-testid*='address']");
  const capRateText = await safeText(page, "text=/Cap Rate/i");
  const priceText = await safeText(page, "text=/Price/i");

  const toNum = (v: string | null) =>
    v ? Number(String(v).replace(/[^0-9.]/g, "")) : null;

  const capRate =
    capRateText && /([0-9.]+)\s*%/.test(capRateText)
      ? parseFloat(RegExp.$1) / 100
      : null;

  const askingPrice = priceText ? toNum(priceText) : null;

  return {
    title,
    address,
    askingPrice,
    noi: null,
    capRate,
    tenant: null,
    market: { metro: null },
    source: { domain: "loopnet.com", url, confidence: 0.85 },
    finalUrl: page.url(),
    blocked: false,
  };
}
