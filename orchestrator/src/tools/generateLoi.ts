// src/tools/generateLoi.ts — Letter of Intent (LOI) Generator
// Produces professional markdown LOIs for CRE property acquisitions

import type { RegisteredTool } from "../lib/agentTypes.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ── LOI Markdown Builder ────────────────────────────────────────────────────

function buildLoiMarkdown(params: {
  propertyTitle: string;
  propertyAddress: string;
  purchasePrice: number;
  buyerName: string;
  earnestMoney: number;
  earnestMoneyPct: number;
  dueDiligenceDays: number;
  closingDays: number;
  closingDate: Date;
  financingType: string;
  ltv: number;
  loanAmount: number;
  equityRequired: number;
  specialConditions?: string;
}): string {
  const today = new Date();
  const ddEndDate = new Date(today);
  ddEndDate.setDate(ddEndDate.getDate() + params.dueDiligenceDays);
  const expirationDate = addBusinessDays(today, 10);

  return `# LETTER OF INTENT

## Non-Binding Indication of Interest for Property Acquisition

---

**Date:** ${fmtDate(today)}

**Re:** Letter of Intent — Acquisition of ${params.propertyTitle}

---

## 1. PARTIES

**Buyer:** ${params.buyerName}, and/or its designated assigns (hereinafter "Buyer")

**Seller:** The current owner(s) of record of the Property described below (hereinafter "Seller")

---

## 2. PROPERTY DESCRIPTION

**Property:** ${params.propertyTitle}

**Address:** ${params.propertyAddress || "To be confirmed during due diligence"}

The Property includes all improvements, fixtures, and appurtenances situated thereon, together with all rights, privileges, and easements pertaining thereto, including any right, title, and interest of Seller in and to adjacent streets, alleys, and rights-of-way.

---

## 3. PURCHASE PRICE

The total purchase price for the Property shall be **${fmtCurrency(params.purchasePrice)}** (the "Purchase Price"), payable in cash and/or cash equivalents at Closing, subject to customary prorations and adjustments.

| Component | Amount |
|---|---|
| Purchase Price | ${fmtCurrency(params.purchasePrice)} |
| Loan Amount (${(params.ltv * 100).toFixed(0)}% LTV) | ${fmtCurrency(params.loanAmount)} |
| Equity Required | ${fmtCurrency(params.equityRequired)} |

---

## 4. EARNEST MONEY DEPOSIT

Within five (5) business days following the mutual execution of a definitive Purchase and Sale Agreement ("PSA"), Buyer shall deposit earnest money in the amount of **${fmtCurrency(params.earnestMoney)}** (${(params.earnestMoneyPct * 100).toFixed(1)}% of Purchase Price) into an escrow account held by a mutually agreed-upon title company or escrow agent (the "Escrow Agent").

The Earnest Money Deposit shall be fully refundable to Buyer during the Due Diligence Period and shall become non-refundable upon expiration of the Due Diligence Period, except in the event of Seller default or failure of any condition precedent to Closing.

---

## 5. DUE DILIGENCE PERIOD

Buyer shall have a period of **${params.dueDiligenceDays} calendar days** (the "Due Diligence Period") commencing on the effective date of the PSA, during which Buyer shall have the right to conduct, at Buyer's sole cost and expense, such inspections, investigations, and analyses of the Property as Buyer deems necessary, including but not limited to:

- Phase I and Phase II Environmental Site Assessments
- Property Condition Assessment (PCA)
- Survey and title examination
- Review of all leases, contracts, and operating statements
- Zoning and entitlement verification
- Appraisal
- Tenant estoppel certificates and SNDAs

Seller shall provide Buyer with reasonable access to the Property and all due diligence materials within five (5) business days of PSA execution. Buyer may terminate the PSA for any reason or no reason during the Due Diligence Period, in which event the Earnest Money Deposit shall be promptly returned to Buyer.

**Due Diligence Expiration:** ${fmtDate(ddEndDate)} (estimated)

---

## 6. FINANCING CONTINGENCY

Buyer intends to finance the acquisition with **${params.financingType} financing** at approximately **${(params.ltv * 100).toFixed(0)}% loan-to-value** (estimated loan amount of ${fmtCurrency(params.loanAmount)}).

Buyer shall have a period of thirty (30) days following the expiration of the Due Diligence Period to obtain a financing commitment. In the event Buyer is unable to secure financing on commercially reasonable terms, Buyer shall have the right to terminate the PSA and receive a full refund of the Earnest Money Deposit.

---

## 7. CLOSING

Closing shall occur within **${params.closingDays} calendar days** following the expiration of the Due Diligence Period, or such earlier date as the parties may mutually agree.

**Estimated Closing Date:** ${fmtDate(params.closingDate)}

At Closing, Seller shall deliver to Buyer a special warranty deed (or equivalent conveyance instrument), free and clear of all liens, encumbrances, and title defects, except for Permitted Exceptions as agreed upon by the parties.

Closing costs shall be allocated as follows:
- **Seller:** Transfer taxes, Seller's attorney fees, documentary stamps on deed, and one-half (1/2) of escrow fees
- **Buyer:** Lender's title insurance, Buyer's attorney fees, recording fees, loan origination costs, and one-half (1/2) of escrow fees
- **Prorations:** Real estate taxes, rents, CAM charges, and operating expenses shall be prorated as of the Closing date

---

## 8. REPRESENTATIONS AND WARRANTIES

Seller shall represent and warrant to Buyer as of the Closing date that:

(a) Seller has full authority to execute and perform the PSA and convey the Property;

(b) There are no pending or threatened actions, suits, or proceedings affecting the Property;

(c) All operating statements and financial information provided to Buyer are true, complete, and accurate in all material respects;

(d) The Property is in compliance with all applicable laws, codes, ordinances, and regulations;

(e) All leases and contracts have been provided to Buyer and are in full force and effect without default by any party thereto;

(f) There are no undisclosed environmental conditions affecting the Property.

---

## 9. CONFIDENTIALITY

The terms and conditions of this Letter of Intent and any subsequent PSA shall be treated as confidential by both parties and shall not be disclosed to any third party without the prior written consent of the other party, except as required by law or as necessary to consummate the transaction (e.g., disclosure to lenders, attorneys, accountants, and other professional advisors).

---

## 10. NON-BINDING NATURE

This Letter of Intent is intended as a non-binding expression of the general terms upon which Buyer is prepared to negotiate for the acquisition of the Property. **Except for this Section 10 and Section 9 (Confidentiality), which are intended to be binding upon the parties, this Letter of Intent does not constitute a binding agreement** and shall not create any obligation on the part of either party. A binding obligation shall arise only upon the execution and delivery of a mutually acceptable Purchase and Sale Agreement.${params.specialConditions ? `

---

## 11. SPECIAL CONDITIONS

${params.specialConditions}

---

## 12. EXPIRATION` : `

---

## 11. EXPIRATION`}

This Letter of Intent shall expire if not accepted by Seller within **ten (10) business days** of the date hereof (by **${fmtDate(expirationDate)}**).

---

**BUYER:**

${params.buyerName}

By: ____________________________

Name: ____________________________

Title: ____________________________

Date: ____________________________

---

**SELLER:**

By: ____________________________

Name: ____________________________

Title: ____________________________

Date: ____________________________

---

*This Letter of Intent was prepared by DealSense AI and is intended as a starting point for negotiations. It is recommended that both parties engage qualified legal counsel before executing a definitive Purchase and Sale Agreement.*
`;
}

// ── Tool ─────────────────────────────────────────────────────────────────────

export const generateLoiTool: RegisteredTool = {
  category: "document",
  estimatedDurationMs: 200,
  schema: {
    name: "generate_loi",
    description:
      "Generate a professional Letter of Intent (LOI) for a commercial real estate acquisition. Includes purchase terms, earnest money, due diligence timeline, and financing contingency.",
    parameters: {
      type: "object",
      properties: {
        propertyTitle: {
          type: "string",
          description: "Property name or title",
        },
        propertyAddress: {
          type: "string",
          description: "Property street address",
        },
        purchasePrice: {
          type: "number",
          description: "Purchase price in dollars",
        },
        buyerName: {
          type: "string",
          description: "Buyer entity name (default: DealSense Fund I, LLC)",
        },
        earnestMoneyPct: {
          type: "number",
          description: "Earnest money as a percentage of purchase price, e.g. 0.01 for 1% (default: 0.01)",
        },
        dueDiligenceDays: {
          type: "number",
          description: "Due diligence period in calendar days (default: 45)",
        },
        closingDays: {
          type: "number",
          description: "Days to close after due diligence period (default: 30)",
        },
        financingType: {
          type: "string",
          description: "Financing type, e.g. 'conventional', 'SBA 504', 'bridge', 'all cash' (default: conventional)",
        },
        ltv: {
          type: "number",
          description: "Loan-to-value ratio, e.g. 0.65 for 65% (default: 0.65)",
        },
        specialConditions: {
          type: "string",
          description: "Any special conditions or contingencies to include in the LOI",
        },
      },
      required: ["propertyTitle", "purchasePrice"],
    },
  },
  execute: async (args) => {
    const propertyTitle = args.propertyTitle as string;
    const propertyAddress = (args.propertyAddress as string) || "";
    const purchasePrice = args.purchasePrice as number;
    const buyerName = (args.buyerName as string) || "DealSense Fund I, LLC";
    const earnestMoneyPct = (args.earnestMoneyPct as number) ?? 0.01;
    const dueDiligenceDays = (args.dueDiligenceDays as number) ?? 45;
    const closingDays = (args.closingDays as number) ?? 30;
    const financingType = (args.financingType as string) || "conventional";
    const ltv = (args.ltv as number) ?? 0.65;
    const specialConditions = args.specialConditions as string | undefined;

    // ── Calculations ──────────────────────────────────────────────────────
    const earnestMoney = Math.round(purchasePrice * earnestMoneyPct);
    const loanAmount = Math.round(purchasePrice * ltv);
    const equityRequired = purchasePrice - loanAmount;

    const today = new Date();
    const closingDate = new Date(today);
    closingDate.setDate(closingDate.getDate() + dueDiligenceDays + closingDays);

    // ── Generate LOI markdown ─────────────────────────────────────────────
    const loi = buildLoiMarkdown({
      propertyTitle,
      propertyAddress,
      purchasePrice,
      buyerName,
      earnestMoney,
      earnestMoneyPct,
      dueDiligenceDays,
      closingDays,
      closingDate,
      financingType,
      ltv,
      loanAmount,
      equityRequired,
      specialConditions,
    });

    return {
      loi,
      summary: {
        price: purchasePrice,
        earnestMoney,
        equity: equityRequired,
        loanAmount,
        closingDate: fmtDate(closingDate),
        dueDiligenceDays,
      },
    };
  },
};
