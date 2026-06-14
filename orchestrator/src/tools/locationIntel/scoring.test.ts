// src/tools/locationIntel/scoring.test.ts — unit tests for Mobility Intelligence scoring
// Run: npm test (tsx --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreTrafficPatterns,
  computeMobilityScore,
  mobilityFactorFromText,
  mobilityStrengthLabel,
  scoreNearbyAnchors,
  scoreFootTraffic,
  scoreRoadTraffic,
} from "./scoring.js";

test("computeMobilityScore applies 25/25/25/15/10 weights", () => {
  const score = computeMobilityScore({
    parkingScore: 100, trafficScore: 100, footTrafficScore: 100,
    nearbyAnchorScore: 100, visibilityScore: 100,
  });
  assert.equal(score, 100);

  const weighted = computeMobilityScore({
    parkingScore: 80, trafficScore: 60, footTrafficScore: 40,
    nearbyAnchorScore: 100, visibilityScore: 0,
  });
  // 80*.25 + 60*.25 + 40*.25 + 100*.15 + 0*.10 = 20+15+10+15+0 = 60
  assert.equal(weighted, 60);
});

test("anchor tenants raise nearbyAnchorScore", () => {
  const withAnchor = scoreNearbyAnchors("nnn walgreens pharmacy dallas tx");
  const without = scoreNearbyAnchors("vacant land parcel");
  assert.ok(withAnchor > without, `${withAnchor} should be > ${without}`);
});

test("high-visit property types raise footTrafficScore", () => {
  const qsr = scoreFootTraffic("qsr drive-thru restaurant pad");
  const office = scoreFootTraffic("suburban office building");
  assert.ok(qsr > office);
});

test("growth metros raise trafficScore moderately", () => {
  const dallas = scoreRoadTraffic("retail on main blvd dallas");
  const other = scoreRoadTraffic("retail on main blvd");
  assert.ok(dallas > other);
  assert.ok(dallas - other <= 15, "metro boost should be moderate");
});

test("all component scores stay within 0-100", () => {
  const maxed = scoreTrafficPatterns({
    address: "9100 N Central Expressway hwy corner pad site, Dallas, TX",
    propertyType: "retail pharmacy QSR grocery urgent care",
    tenant: "Walgreens CVS Starbucks Walmart hospital",
    metro: "Dallas Houston Miami",
    query: "NNN corporate-backed national tenant",
  });
  for (const k of ["mobilityScore", "parkingScore", "trafficScore", "footTrafficScore", "nearbyAnchorScore", "visibilityScore"] as const) {
    assert.ok(maxed[k] >= 0 && maxed[k] <= 100, `${k}=${maxed[k]} out of range`);
  }
});

test("corporate-backed NNN anchor yields High confidence and Positive impact", () => {
  const r = scoreTrafficPatterns({
    address: "1500 W Main St, Dallas, TX",
    propertyType: "pharmacy retail",
    tenant: "Walgreens",
    metro: "Dallas",
    query: "NNN corporate-backed",
  });
  assert.equal(r.confidence, "High");
  assert.equal(r.recommendationImpact, "Positive");
  assert.equal(r.trend, "Increasing");
  assert.ok(r.signals.length > 0);
  assert.ok(r.risks.some(x => /heuristic/i.test(x)), "PoC disclaimer risk expected");
});

test("rural/unknown locations reduce confidence", () => {
  const r = scoreTrafficPatterns({ address: "unincorporated county road parcel" });
  assert.equal(r.confidence, "Low");
  assert.equal(r.trend, "Declining");
});

test("missing/short address reduces confidence", () => {
  const r = scoreTrafficPatterns({ address: "" });
  assert.equal(r.confidence, "Low");
});

test("deterministic: same input gives same output", () => {
  const input = { address: "1100 W Chapman Ave, Orange, CA", propertyType: "Veterinary Hospital", tenant: "VCA / Mars", metro: "Orange County, CA" };
  assert.deepEqual(scoreTrafficPatterns(input), scoreTrafficPatterns(input));
});

test("demo input (VCA veterinary) yields moderate-to-strong stable result", () => {
  const r = scoreTrafficPatterns({
    address: "1100 W Chapman Ave, Orange, CA",
    propertyType: "Veterinary Hospital",
    tenant: "VCA / Mars",
    metro: "Orange County, CA",
  });
  assert.ok(r.mobilityScore >= 55, `mobility ${r.mobilityScore} should be >= 55`);
  assert.equal(r.trend, "Stable");
  assert.ok(["Medium", "High"].includes(r.confidence));
  assert.equal(r.recommendationImpact, "Positive");
  assert.ok(r.signals.some(s => /recurring/i.test(s)));
});

test("mobilityFactorFromText maps to 0-10 PE factor", () => {
  const strong = mobilityFactorFromText("NNN Walgreens pharmacy on Main Blvd Dallas TX");
  const weak = mobilityFactorFromText("rural county road land");
  assert.ok(strong >= 7, `strong=${strong}`);
  assert.ok(weak <= 3, `weak=${weak}`);
  assert.ok(strong <= 10 && weak >= 0);
});

test("mobilityStrengthLabel buckets", () => {
  assert.equal(mobilityStrengthLabel(80), "strong");
  assert.equal(mobilityStrengthLabel(60), "moderate");
  assert.equal(mobilityStrengthLabel(40), "weak");
});
