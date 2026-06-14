// src/tools/peScorePro.test.ts — unit tests for DealSense PE signal parsing.
// Run: npm test (tsx --test)
//
// The cap/price/NNN signals parsed here feed NOI derivation (price × cap) and
// per-deal risk, so locking in the parsing contract guards the whole chain.

import { test } from "node:test";
import assert from "node:assert/strict";
import { peScorePro } from "./peScorePro.js";

type Scored = {
  title: string; url: string; snippet: string;
  peScore: number;
  peSignals: { cap: number | null; price: number | null; noi: number | null; nnn: boolean; tenantName?: string | null };
};

async function scoreRows(rows: Array<{ title: string; url: string; snippet: string }>, query = ""): Promise<Scored[]> {
  return JSON.parse(String(await peScorePro.invoke(JSON.stringify({ rows, query }))));
}

test("parses cap rate and price from a listing snippet", async () => {
  const [r] = await scoreRows([{
    title: "Walgreens NNN — Dallas, TX",
    url: "https://www.loopnet.com/Listing/walgreens-dallas/123/",
    snippet: "Offered at $5,250,000. Cap Rate: 6.25%. Absolute NNN lease, corporate guarantee.",
  }]);
  assert.equal(r.peSignals.cap, 0.0625);
  assert.equal(r.peSignals.price, 5250000);
  assert.equal(r.peSignals.nnn, true);
});

test("price × cap yields a sane NOI (the value per-deal risk relies on)", async () => {
  const [r] = await scoreRows([{
    title: "Dollar General NNN",
    url: "https://www.crexi.com/property/abc/dg",
    snippet: "Price $1,500,000 | Cap Rate: 7.00% | 15-year absolute net lease.",
  }]);
  assert.ok(r.peSignals.price && r.peSignals.cap, "price and cap must parse");
  const noi = Math.round(r.peSignals.price! * r.peSignals.cap!);
  assert.equal(noi, 105000); // 1.5M × 7%
});

test("missing financials → null cap/price, not fabricated", async () => {
  const [r] = await scoreRows([{
    title: "Retail property for sale",
    url: "https://www.loopnet.com/Listing/generic/999/",
    snippet: "Contact broker for pricing. Great location near major retailers.",
  }]);
  assert.equal(r.peSignals.cap, null);
  assert.equal(r.peSignals.price, null);
});

test("peScore is a number in 0..100", async () => {
  const [r] = await scoreRows([{
    title: "STNL CVS, 5.5% cap",
    url: "https://www.crexi.com/property/x/cvs",
    snippet: "Price $4,000,000. Cap Rate: 5.50%. NNN.",
  }]);
  assert.equal(typeof r.peScore, "number");
  assert.ok(r.peScore >= 0 && r.peScore <= 100, `out of range: ${r.peScore}`);
});

test("results are returned sorted by peScore descending", async () => {
  const out = await scoreRows([
    { title: "Weak deal", url: "https://x/1", snippet: "land for sale" },
    { title: "Strong NNN Walgreens", url: "https://x/2", snippet: "Price $5,000,000. Cap Rate: 6.50%. Absolute NNN, 15-yr corporate guarantee, Dallas TX." },
  ]);
  assert.equal(out.length, 2);
  assert.ok(out[0].peScore >= out[1].peScore, "first result should have the highest score");
});

test("empty input → empty output", async () => {
  const out = await scoreRows([]);
  assert.deepEqual(out, []);
});
