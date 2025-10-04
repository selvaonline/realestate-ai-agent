// src/utils/dedupe.ts
// Simple URL + address-based deduplication utility.

export interface Candidate {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
  address?: string | null;
}

export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function normalizeAddress(a?: string | null): string | null {
  if (!a) return null;
  return a.toLowerCase().replace(/[\s,.-]+/g, "");
}

export function dedupeCandidates(rows: Candidate[]): Candidate[] {
  const seen = new Map<string, Candidate>();
  for (const r of rows) {
    const key = canonicalizeUrl(r.url);
    if (!seen.has(key)) seen.set(key, r);
  }
  // Optional: address dedupe (loose)
  const unique: Candidate[] = [];
  const seenAddr = new Set<string>();
  for (const r of seen.values()) {
    const addr = normalizeAddress(r.address);
    if (addr && !seenAddr.has(addr)) {
      seenAddr.add(addr);
      unique.push(r);
    } else if (!addr) {
      unique.push(r);
    }
  }
  return unique;
}
