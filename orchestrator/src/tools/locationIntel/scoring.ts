// src/tools/locationIntel/scoring.ts — Mobility Intelligence heuristic scoring (PoC)
// Deterministic keyword/location-based model. Pure functions, unit-testable.
// Replace/augment with real provider data (Placer.ai, SafeGraph, DOT, etc.) via providers/.

export interface TrafficPatternInput {
  address: string;
  propertyType?: string;
  tenant?: string;
  metro?: string;
  /** Optional extra context, e.g. the original user query */
  query?: string;
}

export type MobilityTrend = "Increasing" | "Stable" | "Declining";
export type MobilityConfidence = "Low" | "Medium" | "High";
export type RecommendationImpact = "Positive" | "Neutral" | "Negative";

export interface TrafficPatternResult {
  address: string;
  mobilityScore: number;
  parkingScore: number;
  trafficScore: number;
  footTrafficScore: number;
  nearbyAnchorScore: number;
  visibilityScore: number;
  trend: MobilityTrend;
  confidence: MobilityConfidence;
  signals: string[];
  risks: string[];
  recommendationImpact: RecommendationImpact;
  summary: string;
}

// ── Keyword dictionaries ──────────────────────────────────────────────────

export const ANCHOR_TENANTS = [
  "walgreens", "cvs", "starbucks", "chick-fil-a", "walmart", "target",
  "costco", "kroger", "publix", "whole foods", "hospital",
];

export const HIGH_VISIT_PROPERTY_TYPES = [
  "retail", "pharmacy", "medical office", "grocery", "qsr", "urgent care",
  "restaurant", "veterinary", "convenience", "drive-thru", "drive thru",
];

export const GROWTH_METROS = [
  "dallas", "austin", "orlando", "phoenix", "atlanta", "charlotte",
  "nashville", "tampa", "raleigh", "houston", "miami",
];

const CORPORATE_BACKING = [
  "nnn", "triple net", "corporate-backed", "corporate backed", "corporate guarantee",
  "hospital affiliation", "hospital-affiliated", "national tenant", "investment grade",
  "vca", "mars",
];

const CORRIDOR_HINTS = [" ave", " avenue", " blvd", " boulevard", " hwy", " highway", " rd", " road", " pkwy", " parkway", " main st"];
const VISIBILITY_HINTS = ["corner", "signalized", "intersection", "frontage", "pad site", "outparcel", "hard corner"];
const PARKING_HINTS = ["freestanding", "free-standing", "standalone", "pad", "drive-thru", "drive thru", "strip center", "shopping center"];
const RURAL_HINTS = ["rural", "county road", "unincorporated", "township", "farm", "route 9w"];
const MEDICAL_HINTS = ["medical", "veterinary", "urgent care", "clinic", "hospital", "dental", "pharmacy"];

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const hasAny = (text: string, list: string[]) => list.some(k => text.includes(k));

function combinedText(input: TrafficPatternInput): string {
  return [input.address, input.propertyType, input.tenant, input.metro, input.query]
    .filter(Boolean).join(" ").toLowerCase();
}

// ── Component scores (each 0–100, deterministic) ──────────────────────────

export function scoreNearbyAnchors(text: string): number {
  let score = 52;
  const anchorHits = ANCHOR_TENANTS.filter(a => text.includes(a)).length;
  if (anchorHits >= 1) score += 18;
  if (anchorHits >= 2) score += 8;
  if (hasAny(text, MEDICAL_HINTS)) score += 6;
  if (hasAny(text, RURAL_HINTS)) score -= 12;
  return clamp(score);
}

export function scoreFootTraffic(text: string): number {
  let score = 54;
  if (hasAny(text, HIGH_VISIT_PROPERTY_TYPES)) score += 15;
  if (ANCHOR_TENANTS.some(a => text.includes(a))) score += 7;
  if (hasAny(text, MEDICAL_HINTS)) score += 4; // recurring appointment-driven visits
  if (hasAny(text, RURAL_HINTS)) score -= 14;
  return clamp(score);
}

export function scoreRoadTraffic(text: string): number {
  let score = 56;
  if (GROWTH_METROS.some(m => text.includes(m))) score += 12; // moderate metro boost
  if (hasAny(text, CORRIDOR_HINTS)) score += 9;
  if (hasAny(text, RURAL_HINTS)) score -= 16;
  return clamp(score);
}

export function scoreParking(text: string): number {
  let score = 58;
  if (hasAny(text, PARKING_HINTS)) score += 12;
  if (hasAny(text, HIGH_VISIT_PROPERTY_TYPES)) score += 6; // suburban retail formats carry dedicated lots
  if (text.includes("downtown") || text.includes("cbd")) score -= 10;
  return clamp(score);
}

export function scoreVisibility(text: string): number {
  let score = 54;
  if (hasAny(text, VISIBILITY_HINTS)) score += 14;
  if (hasAny(text, CORRIDOR_HINTS)) score += 8;
  if (ANCHOR_TENANTS.some(a => text.includes(a))) score += 5;
  if (hasAny(text, RURAL_HINTS)) score -= 10;
  return clamp(score);
}

/** Weighted blend: parking 25%, traffic 25%, foot traffic 25%, anchors 15%, visibility 10%. */
export function computeMobilityScore(parts: {
  parkingScore: number; trafficScore: number; footTrafficScore: number;
  nearbyAnchorScore: number; visibilityScore: number;
}): number {
  return clamp(
    parts.parkingScore * 0.25 +
    parts.trafficScore * 0.25 +
    parts.footTrafficScore * 0.25 +
    parts.nearbyAnchorScore * 0.15 +
    parts.visibilityScore * 0.10
  );
}

export function mobilityStrengthLabel(mobilityScore: number): "strong" | "moderate" | "weak" {
  if (mobilityScore >= 75) return "strong";
  if (mobilityScore >= 55) return "moderate";
  return "weak";
}

// ── Full PoC model ────────────────────────────────────────────────────────

export function scoreTrafficPatterns(input: TrafficPatternInput): TrafficPatternResult {
  const text = combinedText(input);
  const hasAddress = Boolean(input.address && input.address.trim().length >= 8);

  const parkingScore = scoreParking(text);
  const trafficScore = scoreRoadTraffic(text);
  const footTrafficScore = scoreFootTraffic(text);
  const nearbyAnchorScore = scoreNearbyAnchors(text);
  const visibilityScore = scoreVisibility(text);
  const mobilityScore = computeMobilityScore({
    parkingScore, trafficScore, footTrafficScore, nearbyAnchorScore, visibilityScore,
  });

  const anchorHit = ANCHOR_TENANTS.find(a => text.includes(a)) || null;
  const isGrowthMetro = GROWTH_METROS.some(m => text.includes(m));
  const isRural = hasAny(text, RURAL_HINTS);
  const isCorporate = hasAny(text, CORPORATE_BACKING);
  const isHighVisitType = hasAny(text, HIGH_VISIT_PROPERTY_TYPES);
  const isMedical = hasAny(text, MEDICAL_HINTS);

  // Confidence: corporate/national backing and recognizable anchors raise it; rural/missing data lowers it
  let confidence: MobilityConfidence = "Medium";
  if (isCorporate && (anchorHit || isHighVisitType)) confidence = "High";
  if (isRural || !hasAddress || (!anchorHit && !isHighVisitType && !isGrowthMetro)) confidence = "Low";

  // Trend
  const trend: MobilityTrend = isRural ? "Declining" : isGrowthMetro ? "Increasing" : "Stable";

  // Recommendation impact
  let recommendationImpact: RecommendationImpact =
    mobilityScore >= 68 ? "Positive" : mobilityScore >= 50 ? "Neutral" : "Negative";
  if (isCorporate && recommendationImpact === "Neutral" && mobilityScore >= 60) {
    recommendationImpact = "Positive";
  }

  // Signals (positives)
  const signals: string[] = [];
  if (anchorHit) signals.push(`Recognized anchor/draw nearby: ${anchorHit.replace(/\b\w/g, c => c.toUpperCase())} strengthens trade-area pull`);
  if (isMedical) signals.push("Medical/veterinary use indicates recurring customer visits");
  if (isCorporate) signals.push("Corporate-backed tenant improves location durability");
  if (isGrowthMetro) signals.push(`High-growth metro (${input.metro || "detected market"}) supports rising vehicle counts`);
  if (hasAny(text, CORRIDOR_HINTS)) signals.push("Suburban commercial corridor suggests steady vehicle traffic");
  if (hasAny(text, VISIBILITY_HINTS)) signals.push("Strong site visibility characteristics (corner/frontage indicators)");
  if (isHighVisitType) signals.push(`High-visit property type (${input.propertyType || "retail-format"}) drives daily foot traffic`);
  if (signals.length === 0) signals.push("Limited location signals detected from available data");

  // Risks (negatives)
  const risks: string[] = [];
  if (isRural) risks.push("Rural/low-density indicators reduce expected activity volume");
  if (!hasAddress) risks.push("Incomplete address limits location-level inference");
  if (!anchorHit && !isHighVisitType) risks.push("No recognizable anchor tenant or high-visit use detected");
  risks.push("PoC uses heuristic scoring until third-party mobility data is connected");

  const strength = mobilityStrengthLabel(mobilityScore);
  const summary =
    `The property shows ${strength} real-world activity signals` +
    `${isMedical ? " supported by medical use and recurring visits" : anchorHit ? ` anchored by ${anchorHit}` : ""}` +
    `${isCorporate ? " with corporate tenancy durability" : ""}` +
    `. Mobility ${mobilityScore}/100 (parking ${parkingScore}, traffic ${trafficScore}, foot traffic ${footTrafficScore}), trend ${trend.toLowerCase()}.`;

  return {
    address: input.address,
    mobilityScore,
    parkingScore,
    trafficScore,
    footTrafficScore,
    nearbyAnchorScore,
    visibilityScore,
    trend,
    confidence,
    signals,
    risks,
    recommendationImpact,
    summary,
  };
}

// ── PE scoring bridge ─────────────────────────────────────────────────────

/**
 * Quick 0–10 "Mobility / Real-World Activity" PE factor derived from listing text
 * (title + snippet). Used by peScorePro without needing a full address.
 */
export function mobilityFactorFromText(text: string): number {
  const t = text.toLowerCase();
  let factor = 3; // neutral base
  if (ANCHOR_TENANTS.some(a => t.includes(a))) factor += 3;
  if (hasAny(t, HIGH_VISIT_PROPERTY_TYPES)) factor += 2;
  if (GROWTH_METROS.some(m => t.includes(m))) factor += 1;
  if (hasAny(t, CORRIDOR_HINTS) || hasAny(t, VISIBILITY_HINTS)) factor += 1;
  if (hasAny(t, RURAL_HINTS)) factor -= 2;
  return Math.max(0, Math.min(10, factor));
}
