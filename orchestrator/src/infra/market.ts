// src/infra/market.ts
// Lightweight market data helpers with in-memory cache (FRED 10Y, BLS metro unemployment).
// Uses global fetch (Node 18+). If keys are missing, functions return nulls safely.

type CacheEntry<T> = { t: number; data: T };
const CACHE: Record<string, CacheEntry<any>> = {};

function getCache<T>(key: string, ttlMs: number): T | null {
  const e = CACHE[key];
  if (!e) return null;
  if (Date.now() - e.t > ttlMs) return null;
  return e.data as T;
}
function setCache<T>(key: string, data: T) {
  CACHE[key] = { t: Date.now(), data };
}

export async function fred10Y(apiKey?: string) {
  // DGS10 (10-Year Treasury Constant Maturity Rate, percent)
  if (!apiKey) return { seriesId: "DGS10", date: null, value: null };
  const k = "fred:DGS10";
  const cached = getCache<typeof ret>(k, 12 * 60 * 60 * 1000); // 12h
  if (cached) return cached;
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${apiKey}&file_type=json`;
  const r = await fetch(url);
  const j: any = await r.json();
  const obs = (j?.observations || []).filter((o: any) => o.value !== "." && o.value != null);
  const last = obs[obs.length - 1];
  const ret = { seriesId: "DGS10", date: last?.date ?? null, value: last ? Number(last.value) / 100 : null }; // convert %→decimal
  setCache(k, ret);
  return ret;
}

export async function blsMetroUnemp(seriesId: string, apiKey?: string) {
  // seriesId example (LAUS): "LAUMT123310000000003" for Dallas-Fort Worth-Arlington, TX MSA unemployment rate
  if (!apiKey) return { seriesId, latestRate: null, yoyDelta: null, period: null };
  const k = `bls:${seriesId}`;
  const cached = getCache<typeof ret>(k, 24 * 60 * 60 * 1000); // 24h
  if (cached) return cached;
  const r = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesid: [seriesId], registrationkey: apiKey })
  });
  const j: any = await r.json();
  const obs = j?.Results?.series?.[0]?.data || [];
  const latest = obs[0];
  const prior12 = obs[12];
  const ret = {
    seriesId,
    latestRate: latest ? Number(latest.value) : null,
    yoyDelta: latest && prior12 ? Number(latest.value) - Number(prior12.value) : null,
    period: latest ? `${latest.periodName} ${latest.year}` : null
  };
  setCache(k, ret);
  return ret;
}

export function inferMetroSeriesIdFromText(text: string): string | null {
  // Minimal examples. Add more MSAs as needed.
  const t = text.toLowerCase();
  if (/dallas|dfw|plano|arlington/i.test(t)) return "LAUMT481910000000003"; // Dallas-Fort Worth-Arlington, TX
  if (/miami|fort lauderdale|west palm/i.test(t)) return "LAUMT121146000000003"; // Miami-Fort Lauderdale-West Palm Beach, FL
  if (/orlando/i.test(t)) return "LAUMT123674000000003"; // Orlando-Kissimmee-Sanford, FL
  if (/tampa|st\.?\s?petersburg/i.test(t)) return "LAUMT124530000000003"; // Tampa-St. Petersburg-Clearwater, FL
  if (/jacksonville/i.test(t)) return "LAUMT122130000000003"; // Jacksonville, FL
  if (/phoenix|scottsdale|mesa/i.test(t)) return "LAUMT040380000000003"; // Phoenix-Mesa-Scottsdale, AZ
  if (/atlanta|sandy springs|roswell/i.test(t)) return "LAUMT130120000000003"; // Atlanta-Sandy Springs-Roswell, GA
  if (/austin|round rock/i.test(t)) return "LAUMT481230000000003"; // Austin-Round Rock, TX
  if (/houston|the woodlands|sugar land/i.test(t)) return "LAUMT482630000000003"; // Houston-The Woodlands-Sugar Land, TX
  if (/san antonio|new braunfels/i.test(t)) return "LAUMT484160000000003"; // San Antonio-New Braunfels, TX
  if (/nashville|davidson|murfreesboro/i.test(t)) return "LAUMT473460000000003"; // Nashville-Davidson-Murfreesboro-Franklin, TN
  if (/charlotte|concord|gastonia/i.test(t)) return "LAUMT371650000000003"; // Charlotte-Concord-Gastonia, NC-SC
  if (/raleigh|cary/i.test(t)) return "LAUMT374010000000003"; // Raleigh-Cary, NC
  return null;
}
