// src/packs/cre/summarize.ts — Compact CRE tool-result summaries for the LLM
// context window. Moved out of agentLoop.ts; returns null for unknown tools
// so the platform falls back to generic JSON truncation.

export function summarizeToolResult(toolName: string, result: any): string | null {
  switch (toolName) {
    case "search_properties": {
      const s = result.scored || [];
      return `Found ${result.rawCount} results, scored ${s.length}. Top: ${s.slice(0, 3).map((r: any) => `[PE ${r.peScore}] ${(r.title || "").slice(0, 50)}`).join("; ")}`;
    }
    case "assess_risk":
      return `Risk: ${result.riskScore}/100 — ${result.riskNote}`;
    case "run_dcf":
      return `IRR: ${result.irr}, Equity Multiple: ${result.equityMultiple}, Cash-on-Cash: ${result.cashOnCash}`;
    case "comp_analysis":
      return `${result.compCount} comps found in ${result.market}, avg PE: ${result.avgPeScore}`;
    case "market_deep_dive":
      return `${result.metro}: Risk ${result.riskScore}/100, 10Y: ${result.macro?.treasury10y}, U/E: ${result.macro?.metroUnemployment}`;
    case "analyze_property_url":
      return result.skipped ? result.reason : `${result.title} — Price: ${result.askingPrice}, Cap: ${result.capRate}`;
    case "generate_memo":
      return "IC memo generated successfully";
    case "filter_and_rank":
      return `Filtered ${result.originalCount} → ${result.filteredCount} deals`;
    case "portfolio_review":
      return `Portfolio: ${result.totalProperties} properties, avg PE: ${result.avgPeScore}`;
    case "tenant_credit_analysis":
      return `${result.tenant}: ${result.rating} (${result.ratingLabel}) — ${result.recommendation?.slice(0, 80)}`;
    case "generate_loi":
      return `LOI generated for ${result.summary?.price ? `$${(result.summary.price / 1e6).toFixed(1)}M` : 'property'} — closing: ${result.summary?.closingDate || 'TBD'}`;
    case "compliance_check":
      return `${result.compliant ? 'COMPLIANT' : `${result.violations?.length} violations`} — ${result.fundMetrics?.dealCount} deals, NAV: $${((result.fundMetrics?.nav || 0) / 1e6).toFixed(1)}M`;
    case "portfolio_var":
      return `VaR(95): ${result.var95}, Portfolio IRR: ${result.portfolioIrr}, Max Drawdown: ${result.maxDrawdown}`;
    case "risk_decomposition":
      return `Total Risk: ${result.totalRisk}/100 — ${result.recommendation?.slice(0, 60)}`;
    case "multi_asset_compare":
      return `CRE Sharpe: ${result.creReturn?.sharpe}, Risk Premium: ${result.riskPremium} — ${result.recommendation?.slice(0, 60)}`;
    case "institutional_pipeline":
      return `Pipeline: ${result.screened} screened → ${result.qualified} qualified (${result.icReady} IC-ready), pass rate: ${result.passRate}`;
    case "market_intel":
      return `${result.metro} intel gathered: construction, vacancy, rent, demographics, cap rates`;
    case "analyze_traffic_patterns":
      return `Mobility Score ${result.mobilityScore}/100, trend ${result.trend} — parking ${result.parkingScore}, traffic ${result.trafficScore}, foot traffic ${result.footTrafficScore}, anchors ${result.nearbyAnchorScore} (confidence: ${result.confidence}, impact: ${result.recommendationImpact})`;
    default:
      return null;
  }
}
