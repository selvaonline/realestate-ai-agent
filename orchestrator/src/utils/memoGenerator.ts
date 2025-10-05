// src/utils/memoGenerator.ts
// IC Memo Generator - Creates investment committee memos for CRE deals

interface MemoInput {
  title: string;
  url: string;
  pe?: {
    score?: number;
    tier?: string;
    factors?: any;
    signals?: any;
  };
  risk?: {
    score?: number;
    note?: string;
    factors?: any;
  };
  snippet?: string;
  price?: string;
  capRate?: string;
  noi?: string;
  location?: string;
  propertyType?: string;
}

export function generateIcMemo(input: MemoInput): string {
  const {
    title,
    url,
    pe = {},
    risk = {},
    snippet = "",
    price,
    capRate,
    noi,
    location,
    propertyType
  } = input;

  const peScore = pe.score ?? "N/A";
  const peTier = pe.tier ?? "Unknown";
  const riskScore = risk.score ?? "N/A";
  const riskNote = risk.note ?? "Market risk assessment pending";

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  // Build the memo
  const memo = `
# INVESTMENT COMMITTEE MEMORANDUM

**Date:** ${date}  
**Subject:** Commercial Real Estate Acquisition Opportunity  
**Property:** ${title}

---

## EXECUTIVE SUMMARY

This memo presents an investment opportunity for the acquisition of a commercial real estate asset identified through DealSense AI platform analysis.

**Property Details:**
- **Name:** ${title}
- **Location:** ${location || "See listing for details"}
- **Property Type:** ${propertyType || "Commercial Real Estate"}
- **Listing URL:** ${url}

**Key Metrics:**
- **PE Score:** ${peScore} (${peTier})
- **Market Risk Score:** ${riskScore}
${price ? `- **Price:** ${price}` : ""}
${capRate ? `- **Cap Rate:** ${capRate}` : ""}
${noi ? `- **NOI:** ${noi}` : ""}

---

## PROPERTY OVERVIEW

${snippet || "Detailed property information available at the listing URL."}

---

## INVESTMENT ANALYSIS

### PE Score Analysis (${peScore})

${generatePeAnalysis(pe)}

**Tier Classification:** ${peTier}

${peTier === "Premium" ? "✓ **RECOMMENDATION:** This asset meets our premium acquisition criteria." : ""}
${peTier === "Investment Grade" ? "✓ **RECOMMENDATION:** This asset meets our investment-grade criteria with acceptable risk-adjusted returns." : ""}
${peTier === "Below Threshold" ? "⚠ **CAUTION:** This asset falls below our standard investment thresholds. Additional due diligence recommended." : ""}

### Market Risk Assessment (${riskScore})

${riskNote}

${generateRiskAnalysis(risk)}

---

## DEAL STRUCTURE CONSIDERATIONS

**Recommended Next Steps:**
1. **Site Visit & Physical Inspection**
   - Schedule property tour
   - Assess physical condition
   - Verify tenant occupancy

2. **Financial Due Diligence**
   - Request rent roll and lease abstracts
   - Verify historical financials (3-5 years)
   - Analyze tenant credit quality
   - Review operating expense history

3. **Legal & Title Review**
   - Title search and survey
   - Zoning and land use verification
   - Environmental Phase I assessment
   - Review existing leases and contracts

4. **Market Analysis**
   - Comparable sales analysis
   - Submarket vacancy and absorption trends
   - Competitive property analysis
   - Economic and demographic trends

---

## FINANCIAL PROJECTIONS

${generateFinancialSection(input)}

---

## RISK FACTORS

**Key Risks to Consider:**

${generateRiskFactors(pe, risk)}

---

## RECOMMENDATION

${generateRecommendation(pe, risk)}

---

## APPENDICES

**A. Data Sources**
- DealSense AI Platform Analysis
- Listing Source: ${url}
- Market Data: FRED (10Y Treasury), BLS (Metro Unemployment)

**B. Scoring Methodology**
- PE Score: Multi-factor analysis including location quality, property type, market fundamentals, and deal structure
- Risk Score: Macro-economic indicators, labor market trends, and market-specific risk factors

---

*This memorandum is for internal use only and contains confidential information. The analysis is based on publicly available data and AI-assisted evaluation. Independent verification and professional due diligence are required before making any investment decision.*

**Prepared by:** DealSense AI Platform  
**Date Generated:** ${date}
`;

  return memo.trim();
}

function generatePeAnalysis(pe: any): string {
  if (!pe.factors && !pe.signals) {
    return "PE score analysis based on comprehensive evaluation of property fundamentals, market positioning, and investment potential.";
  }

  let analysis = "The PE score reflects:\n\n";
  
  if (pe.factors) {
    analysis += "**Key Factors:**\n";
    Object.entries(pe.factors).forEach(([key, value]) => {
      analysis += `- ${formatFactorName(key)}: ${value}\n`;
    });
    analysis += "\n";
  }

  if (pe.signals) {
    analysis += "**Investment Signals:**\n";
    Object.entries(pe.signals).forEach(([key, value]) => {
      analysis += `- ${formatFactorName(key)}: ${value}\n`;
    });
  }

  return analysis;
}

function generateRiskAnalysis(risk: any): string {
  if (!risk.factors) {
    return "Risk assessment incorporates macro-economic indicators, market-specific factors, and property-level considerations.";
  }

  let analysis = "\n**Risk Factors Analyzed:**\n";
  Object.entries(risk.factors).forEach(([key, value]) => {
    analysis += `- ${formatFactorName(key)}: ${value}\n`;
  });

  return analysis;
}

function generateFinancialSection(input: MemoInput): string {
  const { price, capRate, noi } = input;

  if (!price && !capRate && !noi) {
    return "*Financial details to be obtained during due diligence phase.*\n\n**Required Information:**\n- Purchase price and terms\n- Current NOI and historical trends\n- Cap rate analysis vs. market comparables\n- Projected cash flows (5-10 year hold)";
  }

  let section = "**Current Metrics:**\n";
  if (price) section += `- Purchase Price: ${price}\n`;
  if (capRate) section += `- Cap Rate: ${capRate}\n`;
  if (noi) section += `- Net Operating Income: ${noi}\n`;
  
  section += "\n*Detailed pro forma and sensitivity analysis to be completed during due diligence.*";
  
  return section;
}

function generateRiskFactors(pe: any, risk: any): string {
  const factors = [];

  const riskScore = risk.score ?? 50;
  const peScore = pe.score ?? 50;

  if (riskScore > 70) {
    factors.push("**Market Risk:** Elevated market risk indicators suggest caution. Monitor macro-economic trends closely.");
  }
  
  if (peScore < 50) {
    factors.push("**Property Quality:** Below-average PE score indicates potential challenges with property fundamentals or market positioning.");
  }

  if (factors.length === 0) {
    factors.push("**Standard CRE Risks:** Market volatility, tenant default, interest rate changes, property-specific issues");
    factors.push("**Liquidity Risk:** Commercial real estate is inherently illiquid; exit strategy should be clearly defined");
    factors.push("**Leverage Risk:** If using debt financing, interest rate and refinancing risks must be managed");
  }

  return factors.map(f => `- ${f}`).join("\n");
}

function generateRecommendation(pe: any, risk: any): string {
  const peScore = pe.score ?? 50;
  const riskScore = risk.score ?? 50;
  const peTier = pe.tier ?? "Unknown";

  if (peTier === "Premium" && riskScore < 60) {
    return "**PROCEED TO DUE DILIGENCE** - This opportunity exhibits strong fundamentals with manageable risk. Recommend advancing to comprehensive due diligence phase with target LOI submission within 10 business days.";
  }

  if (peTier === "Investment Grade" && riskScore < 70) {
    return "**CONDITIONAL PROCEED** - Asset meets investment criteria with acceptable risk profile. Recommend detailed due diligence with focus on risk mitigation strategies. Target LOI submission contingent on satisfactory Phase I findings.";
  }

  if (riskScore > 75) {
    return "**ELEVATED RISK - PROCEED WITH CAUTION** - Market risk indicators are elevated. Recommend additional market analysis and stress testing before proceeding. Consider risk-adjusted pricing or enhanced return requirements.";
  }

  if (peScore < 40) {
    return "**PASS** - Property fundamentals do not meet our investment criteria at this time. Recommend monitoring for material changes or significant price adjustment.";
  }

  return "**ADDITIONAL ANALYSIS REQUIRED** - Recommend supplemental analysis before making proceed/pass decision. Schedule IC discussion to review findings and determine next steps.";
}

function formatFactorName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Export a simplified version for quick summaries
export function generateQuickSummary(input: MemoInput): string {
  const { title, pe = {}, risk = {} } = input;
  const peScore = pe.score ?? "N/A";
  const peTier = pe.tier ?? "Unknown";
  const riskScore = risk.score ?? "N/A";

  return `**${title}**

PE Score: ${peScore} (${peTier})
Market Risk: ${riskScore}

${pe.tier === "Premium" ? "✓ Premium opportunity" : ""}
${pe.tier === "Investment Grade" ? "✓ Investment grade" : ""}
${pe.tier === "Below Threshold" ? "⚠ Below threshold" : ""}

${risk.note || ""}`;
}
