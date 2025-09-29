// src/agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { webSearch } from "./tools/search.js";
import { browseAndExtract } from "./tools/browser.js";
import { quickUnderwrite } from "./tools/finance.js";
import type { Deal } from "./lib/types.js";

/** ✅ Optional: set a PUBLIC Crexi detail URL to guarantee a demo result */
const DEMO_FALLBACK_URL = "https://www.crexi.com/properties/2164390/texas-7-eleven"; // e.g. "https://www.crexi.com/property/<id>/<slug>"

/** Detail-page patterns */
const DETAIL_PATTERNS = [
  /loopnet\.com\/Listing\//i,
  /crexi\.com\/property\//i,
  /crexi\.com\/sale\/properties\/[^/?#]+\/[^/?#]+/i,
  /crexi\.com\/lease\/properties\/[^/?#]+\/[^/?#]+/i,
];
const isDetailUrl = (u: string) => DETAIL_PATTERNS.some((rx) => rx.test(u));

const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature: 0,
});

// simple ctx for SSE
type Ctx = { runId?: string; pub?: (kind: string, payload?: Record<string, any>) => void };
const nop = () => {};
const emit = (ctx?: Ctx, kind?: string, payload?: Record<string, any>) =>
  (ctx?.pub || nop)(kind!, payload || {});

async function tryExtractOnce(url: string) {
  const extJson = await browseAndExtract.invoke(JSON.stringify({ url }));
  const ext = JSON.parse(String(extJson));
  const uwJson = await quickUnderwrite.invoke(
    JSON.stringify({ noi: ext.noi, price: ext.askingPrice })
  );
  const uw = JSON.parse(String(uwJson));
  return { ext, uw };
}

export async function runAgent(goal: string, ctx?: Ctx) {
  const q = (goal ?? "").trim();
  const isDirectUrl = /^https?:\/\//i.test(q);

  // ── Direct URL mode ──────────────────────────────────────────────────────────
  if (isDirectUrl) {
    emit(ctx, "status", { label: "Opening detail page" });
    try {
      emit(ctx, "nav", { url: q, label: "Navigating" });
      const { ext, uw } = await tryExtractOnce(q);

      const blocked = ext?.blocked || /access denied/i.test(ext?.title || "");
      const meaningful =
        !!ext?.title || !!ext?.address || ext?.askingPrice != null || ext?.noi != null || ext?.capRate != null;

      if (!blocked && meaningful) {
        emit(ctx, "shot", { label: "Detail page", b64: ext.screenshotBase64 || null });
        emit(ctx, "extracted", {
          summary: { title: ext.title, address: ext.address, price: ext.askingPrice, noi: ext.noi, cap: ext.capRate ?? uw.capRate },
        });

        return {
          plan: `Direct extraction from: ${q}`,
          deals: [
            {
              title: ext.title,
              url: ext.finalUrl || q,
              source: new URL(ext.finalUrl || q).hostname,
              address: ext.address,
              askingPrice: ext.askingPrice,
              noi: ext.noi,
              capRate: ext.capRate ?? uw.capRate,
              screenshotBase64: ext.screenshotBase64,
              underwrite: uw,
              raw: { plan: "Direct URL", directUrl: true, autoDrilled: ext.autoDrilled ?? false },
            },
          ],
          toolResult: null,
        };
      }

      emit(ctx, "status", { label: "Blocked or no data on page" });
      return { plan: `Direct extraction from: ${q}`, deals: [], toolResult: null };
    } catch (e) {
      console.error("[agent] Direct URL extraction failed:", e);
      return { plan: `Failed to extract from: ${q}`, deals: [], toolResult: null };
    }
  }

  // ── Plan text for UI ─────────────────────────────────────────────────────────
  emit(ctx, "status", { label: "Setting up my desktop" });
  emit(ctx, "wait", { label: "Waiting for search results" });

  const sys =
    "You are a CRE deal scout. Given a goal, propose 2-3 concise web search queries for public sale listings (LoopNet/Crexi/brokers). Return them as a short bullet list.";
  const planMsg = await llm.invoke([
    { role: "system", content: sys },
    { role: "user", content: q },
  ]);
  const plan =
    typeof planMsg.content === "string" ? planMsg.content : JSON.stringify(planMsg.content);

  const deals: Deal[] = [];

  // ── Search: detail-first → nudge → general ───────────────────────────────────
  const detailQuery =
    `${q} (` +
    `(site:loopnet.com inurl:/Listing/) OR ` +
    `(site:crexi.com inurl:/property/) OR ` +
    `(site:crexi.com inurl:/sale/properties/) OR ` +
    `(site:crexi.com inurl:/lease/properties/)` +
    `)`;
  emit(ctx, "status", { label: "Searching detail listings" });
  const detail = (JSON.parse(String(await webSearch.invoke(detailQuery))) as Array<{ title: string; url: string; snippet: string }>) || [];
  let candidates = detail.filter((r) => r?.url && isDetailUrl(r.url));

  if (!candidates.length) {
    const nudgeQuery =
      `${q} Dallas multifamily ` +
      `(("cap rate" OR NOI) AND (site:loopnet.com inurl:/Listing/ OR site:crexi.com inurl:/property/))`;
    emit(ctx, "status", { label: "Broadening search" });
    const nudge = (JSON.parse(String(await webSearch.invoke(nudgeQuery))) as Array<{ title: string; url: string; snippet: string }>) || [];
    candidates = nudge.filter((r) => r?.url && isDetailUrl(r.url));
  }

  if (!candidates.length) {
    const generalQuery = `${q} multifamily "cap rate" "for sale"`;
    emit(ctx, "status", { label: "General search" });
    const general = (JSON.parse(String(await webSearch.invoke(generalQuery))) as Array<{ title: string; url: string; snippet: string }>) || [];
    candidates = general.filter((r) => r?.url && isDetailUrl(r.url));
  }

  emit(ctx, "status", {
    label: candidates.length ? "Found detail candidates" : "No detail candidates; will use fallback",
    note: candidates.slice(0, 3).map((c) => c.url).join("\n"),
  });

  // ── Try first few detail URLs ────────────────────────────────────────────────
  const urls = candidates.map((c) => c.url).slice(0, 6);
  const tried: string[] = [];
  for (const url of urls) {
    tried.push(url);
    emit(ctx, "nav", { url, label: "Navigating" });
    try {
      const { ext, uw } = await tryExtractOnce(url);
      const blocked = ext?.blocked || /access denied/i.test(ext?.title || "");
      const meaningful =
        !!ext?.title || !!ext?.address || ext?.askingPrice != null || ext?.noi != null || ext?.capRate != null;

      if (blocked || !meaningful) {
        emit(ctx, "status", { label: "Skipping blocked or empty page" });
        continue;
      }

      emit(ctx, "shot", { label: "Detail page", b64: ext.screenshotBase64 || null });
      emit(ctx, "extracted", {
        summary: { title: ext.title, address: ext.address, price: ext.askingPrice, noi: ext.noi, cap: ext.capRate ?? uw.capRate },
      });

      deals.push({
        title: ext.title,
        url: ext.finalUrl || url,
        source: new URL(ext.finalUrl || url).hostname,
        address: ext.address,
        askingPrice: ext.askingPrice,
        noi: ext.noi,
        capRate: ext.capRate ?? uw.capRate,
        screenshotBase64: ext.screenshotBase64,
        underwrite: uw,
        raw: { plan, tried, autoDrilled: ext.autoDrilled ?? false },
      });
      break; // stop after first success
    } catch (e) {
      console.warn("[agent] extract failed:", url, e);
    }
  }

  // ── Demo fallback (detail URL strongly recommended) ──────────────────────────
  if (deals.length === 0 && DEMO_FALLBACK_URL) {
    emit(ctx, "fallback", { label: "Using fallback listing" });
    const { ext, uw } = await tryExtractOnce(DEMO_FALLBACK_URL);
    const blocked = ext?.blocked || /access denied/i.test(ext?.title || "");
    const meaningful =
      !!ext?.title || !!ext?.address || ext?.askingPrice != null || !!ext?.noi || !!ext?.capRate;

    if (!blocked && meaningful) {
      emit(ctx, "shot", { label: "Fallback detail", b64: ext.screenshotBase64 || null });
      emit(ctx, "extracted", {
        summary: { title: ext.title, address: ext.address, price: ext.askingPrice, noi: ext.noi, cap: ext.capRate ?? uw.capRate },
      });

      deals.push({
        title: ext.title,
        url: ext.finalUrl || DEMO_FALLBACK_URL,
        source: new URL(ext.finalUrl || DEMO_FALLBACK_URL).hostname,
        address: ext.address,
        askingPrice: ext.askingPrice,
        noi: ext.noi,
        capRate: ext.capRate ?? uw.capRate,
        screenshotBase64: ext.screenshotBase64,
        underwrite: uw,
        raw: { plan, fallback: true, autoDrilled: ext.autoDrilled ?? false },
      });
    }
  }

  return { plan, deals, toolResult: null };
}
