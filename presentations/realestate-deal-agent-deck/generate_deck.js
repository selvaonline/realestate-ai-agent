/*
  RealEstate Deal Agent + DealSense PE Model Deck Generator
  Usage:
    1) npm init -y
    2) npm install pptxgenjs
    3) node generate_deck.js
  Output:
    RealEstate-Deal-Agent-Deck.pptx
*/

const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";
pptx.author = "Selva";
pptx.company = "RealEstate Deal Agent";

const COLORS = {
  primary: "2F5CFF",
  dark: "1A2332",
  text: "1A2332",
  muted: "5B7A9F",
  green: "10B981",
  blue: "3B82F6",
  purple: "8B5CF6",
  grayBg: "F8F9FA",
  border: "E2E8F0"
};

function headerBar(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.4,
    fill: COLORS.primary,
    line: { color: COLORS.primary }
  });
}

function addTitleSlide() {
  const slide = pptx.addSlide();
  headerBar(slide);
  slide.addText("RealEstate Deal Agent", {
    x: 0.7,
    y: 1.0,
    fontSize: 38,
    bold: true,
    color: COLORS.dark
  });
  slide.addText("DealSense PE Model and Risk Intelligence", {
    x: 0.7,
    y: 1.9,
    fontSize: 22,
    color: COLORS.muted
  });
  slide.addText("Confident, data-driven sourcing and screening for commercial real estate", {
    x: 0.7,
    y: 2.6,
    fontSize: 16,
    color: COLORS.text
  });
}

function addBulletsSlide(title, bullets, notes) {
  const slide = pptx.addSlide();
  headerBar(slide);
  slide.addText(title, {
    x: 0.7,
    y: 0.6,
    fontSize: 28,
    bold: true,
    color: COLORS.dark
  });
  const items = bullets.map((t) => ({ text: t, options: { bullet: true, fontSize: 18, color: COLORS.text, breakLine: true } }));
  slide.addText(items, { x: 0.9, y: 1.3, w: 9, h: 5 });
  if (notes) slide.addNotes(notes);
}

function addTwoColSlide(title, leftTitle, leftBullets, rightTitle, rightBullets, notes) {
  const slide = pptx.addSlide();
  headerBar(slide);
  slide.addText(title, { x: 0.7, y: 0.6, fontSize: 28, bold: true, color: COLORS.dark });

  slide.addText(leftTitle, { x: 0.7, y: 1.2, fontSize: 16, bold: true, color: COLORS.muted });
  const leftItems = leftBullets.map((t) => ({ text: t, options: { bullet: true, fontSize: 16, color: COLORS.text, breakLine: true } }));
  slide.addText(leftItems, { x: 0.7, y: 1.6, w: 4.5, h: 4.5 });

  slide.addText(rightTitle, { x: 5.4, y: 1.2, fontSize: 16, bold: true, color: COLORS.muted });
  const rightItems = rightBullets.map((t) => ({ text: t, options: { bullet: true, fontSize: 16, color: COLORS.text, breakLine: true } }));
  slide.addText(rightItems, { x: 5.4, y: 1.6, w: 4.5, h: 4.5 });

  if (notes) slide.addNotes(notes);
}

function addPlaceholderSlide(title, subtitle, boxLabel, notes) {
  const slide = pptx.addSlide();
  headerBar(slide);
  slide.addText(title, { x: 0.7, y: 0.6, fontSize: 28, bold: true, color: COLORS.dark });
  if (subtitle) slide.addText(subtitle, { x: 0.7, y: 1.1, fontSize: 16, color: COLORS.muted });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.7,
    y: 1.7,
    w: 9.2,
    h: 4.5,
    fill: COLORS.grayBg,
    line: { color: COLORS.border },
    shadow: { type: "outer", color: "999999", offset: 1.0, blur: 3.0 }
  });
  slide.addText(boxLabel || "Add Annotated Screenshot / Diagram", {
    x: 0.9,
    y: 3.7,
    fontSize: 16,
    color: COLORS.muted
  });

  if (notes) slide.addNotes(notes);
}

// Slides content
addTitleSlide();

addBulletsSlide("Executive Summary", [
  "AI-powered sourcing, ranking, and risk intelligence for CRE",
  "Faster pipeline qualification and higher-quality funnels",
  "Transparent reasoning with sources and portfolio analytics"
], "Position as a decision-support copilot for CRE teams.");

addBulletsSlide("The Problem (Institutional Context)", [
  "Disparate listing sources and unstructured data",
  "Manual research on macro/labor signals",
  "Inconsistent screening standards across teams",
  "Long time-to-conviction slows portfolio rotation"
], "Set up pain points that we directly address.");

addPlaceholderSlide("Product Overview", "Perplexity-style flow with sources, ranking, and analytics", "Product UI Screenshot Placeholder", "Highlight progressive disclosure and transparency.");

addBulletsSlide("How It Works (User Journey)", [
  "Enter thesis / query",
  "Agent searches, filters, scores; emits sources & ranked opportunities",
  "One-click drill-down to factors and sources",
  "Portfolio analytics summarize opportunity set"
], "Reinforce consistency and auditability.");

addPlaceholderSlide("Architecture Overview", null, "Architecture Diagram Placeholder", "Frontend (Angular) + Orchestrator (TypeScript) + Web Search + Macro Data (FRED/BLS) + PE Scorer");

addTwoColSlide(
  "DealSense PE Model (Methodology)",
  "Factors",
  ["Financials: cap rate/NOI proxies, size", "Asset/Tenancy: quality, lease type (NNN)", "Market/Location: demographics, tier", "Execution risk: clarity, data completeness"],
  "Profiles",
  ["Private vs. Institutional weighting", "Score is 1–100 for easy ranking", "Penalty for missing data to reflect confidence"],
  "Ranking aid, not a replacement for underwriting."
);

addBulletsSlide("Risk Intelligence", [
  "Macro risk score integrates Treasury curve (FRED), labor stats (BLS)",
  "Optional news/volatility signals",
  "Concise banner: score + narrative note"
], "Ground screening in market regime context.");

addPlaceholderSlide("Sources & Transparency", null, "Sources Panel Placeholder", "Numbered references, de-duplicated; portable to IC memos.");

addPlaceholderSlide("Portfolio Analytics", null, "Score + Geo Distribution Charts Placeholder", "Average score, range, tiers by threshold.");

addBulletsSlide("Live Demo (5–7 minutes)", [
  "Run realistic search",
  "Show ranked Investment Opportunities",
  "Open PE Model info, then one Deal Factors panel",
  "Scroll to Portfolio Analytics and Sources"
], "Practice once; ensure charts and sources render cleanly.");

addTwoColSlide(
  "Differentiators",
  "Product",
  ["Perplexity-style progressive reasoning with citations", "PE score tuned for institutional profiles", "Macro risk awareness in screening"],
  "Outcomes",
  ["Fast, explainable, repeatable decisions", "Reduces analyst variance", "Higher-quality meetings & memos"],
  null
);

addTwoColSlide(
  "Integration & Extensibility",
  "Near-term",
  ["Import deal lists (CSV/CRM)", "Export snapshots to IC memo templates", "API for embedding"],
  "Enterprise",
  ["SSO, RBAC, centralized logging", "Custom data connectors", "Advanced SLAs"],
  null
);

addBulletsSlide("Security, Compliance, Governance", [
  "HTTPS; isolated keys; no PII required",
  "Configurable data retention",
  "Read-only external data, clear provenance"
], "Invite InfoSec review early.");

addBulletsSlide("Implementation Plan", [
  "Wk 0–1: Pilot scope, success metrics, watchlists",
  "Wk 2–3: Access, configuration, pilot users",
  "Wk 4: Calibration (weights, risk notes)",
  "Wk 5+: Rollout, training, change management"
], "Offer low-friction 30-day pilot.");

addBulletsSlide("Measurable ROI", [
  "40–60% reduction in time-to-initial-screen",
  "More consistent ranking improves meeting yield",
  "Fewer false positives entering underwriting",
  "Faster IC prep via sources + analytics"
], "Replace bullets with pilot metrics over time.");

addBulletsSlide("Case Examples (Anonymized)", [
  "A: Single-tenant retail screen—top 5 in <2 mins",
  "B: Geography-constrained thesis—coverage + portfolio view",
  "C: Macro regime shift—risk note informs thesis"
], "Keep anonymized and specific.");

addBulletsSlide("Roadmap Highlights", [
  "Deeper tenant/lease extraction",
  "CRM/IC templates integration",
  "Regional macro packs, news sentiment",
  "Shared watchlists and collaboration"
], null);

addBulletsSlide("Next Steps", [
  "Agree pilot scope and dataset",
  "Confirm integration constraints",
  "Schedule enablement workshops",
  "Align success metrics and executive sponsor"
], "Close on a concrete start date.");

// Appendix
addTwoColSlide(
  "Appendix: PE Model Details",
  "Factors",
  ["Financials, tenancy, market/location, execution risk"],
  "Profiles",
  ["Institutional vs. private weights", "Handling missing data & confidence"],
  null
);

pptx.writeFile({ fileName: "RealEstate-Deal-Agent-Deck.pptx" }).then(() => {
  console.log("Deck generated: RealEstate-Deal-Agent-Deck.pptx");
});
