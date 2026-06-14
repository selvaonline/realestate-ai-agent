// src/tools/riskBlender.test.ts — unit tests for the Market Risk blender.
// Run: npm test (tsx --test)
//
// These lock in the behavior that caused the "always 50" production bug: with no
// macro inputs the score must stay at the neutral baseline AND flag low signal,
// and with real inputs it must move off 50 in the right direction.

import { test } from "node:test";
import assert from "node:assert/strict";
import { riskBlender } from "./riskBlender.js";

async function score(data: Record<string, unknown>): Promise<{ riskScore: number; riskNote: string; riskFactors: Record<string, number> }> {
  return JSON.parse(String(await riskBlender.invoke(JSON.stringify({ query: "test", data }))));
}

test("no macro data → neutral 50 and flags low signal confidence", async () => {
  const r = await score({ treasury10yBps: null, curve2s10: null, cpiYoY: null, nationalUnemp: null });
  assert.equal(r.riskScore, 50);
  assert.match(r.riskNote, /low signal confidence/i);
});

test("stressed macro (high rates, hot CPI, inverted curve) → risk above 50", async () => {
  const r = await score({
    treasury10yBps: 500,         // 5.0% (bps = rate × 10000) vs 3.5% baseline
    treasury10yDeltaBps: 30,     // rising
    curve2s10: -0.010,           // inverted
    cpiYoY: 0.060,               // 6% inflation
    nationalUnemp: 0.060,        // elevated unemployment
  });
  assert.ok(r.riskScore > 50, `expected > 50, got ${r.riskScore}`);
});

test("favorable macro (low rates, tame CPI, steep curve) → risk below 50", async () => {
  const r = await score({
    treasury10yBps: 250,         // 2.5% vs 3.5% baseline
    curve2s10: 0.020,            // steep / positive
    cpiYoY: 0.010,               // 1% inflation
    nationalUnemp: 0.025,        // low unemployment
  });
  assert.ok(r.riskScore < 50, `expected < 50, got ${r.riskScore}`);
});

test("score is always clamped to 0..100", async () => {
  const extreme = await score({
    treasury10yBps: 20000,       // absurd 200%
    treasury10yDeltaBps: 500,
    curve2s10: -1,
    cpiYoY: 1,
    nationalUnemp: 1,
    news: [{ title: "bankruptcy and default and layoff" }],
  });
  assert.ok(extreme.riskScore <= 100 && extreme.riskScore >= 0, `out of range: ${extreme.riskScore}`);
  assert.equal(extreme.riskScore, 100); // saturates at the ceiling
});

test("multiple inputs disable the low-signal shrink", async () => {
  const r = await score({ treasury10yBps: 500, curve2s10: -0.01, cpiYoY: 0.06, nationalUnemp: 0.06 });
  assert.ok(!/low signal confidence/i.test(r.riskNote), "should not flag low signal with 4 inputs");
});
