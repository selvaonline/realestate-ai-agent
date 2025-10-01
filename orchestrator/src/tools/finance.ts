import { DynamicTool } from "@langchain/core/tools";

function round(v: number | null, d = 2) {
  if (v == null || !isFinite(v)) return null;
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}

export const quickUnderwrite = new DynamicTool({
  name: "quick_underwrite",
  description:
    "Compute cap rate & DSCR. Input: {noi:number|null, price:number|null, rate?:number, amortYears?:number, ltv?:number}",
  func: async (input: string) => {
    const { noi, price, rate = 0.055, amortYears = 30, ltv = 0.65 } = JSON.parse(input);

    // Normalize bad inputs
    const NOI = (typeof noi === "number" && isFinite(noi) && noi >= 0) ? noi : null;
    const PRICE = (typeof price === "number" && isFinite(price) && price > 0) ? price : null;
    const RATE = (typeof rate === "number" && isFinite(rate) && rate > 0) ? rate : 0.055;
    const YEARS = (typeof amortYears === "number" && isFinite(amortYears) && amortYears > 0) ? amortYears : 30;
    const LTV = (typeof ltv === "number" && isFinite(ltv) && ltv > 0 && ltv <= 1) ? ltv : 0.65;

    const capRate = (NOI && PRICE) ? round(NOI / PRICE, 6) : null;
    const loanAmt = PRICE ? round(PRICE * LTV, 2) : null;

    let dscr: number | null = null;
    let debtSvcMonthly: number | null = null;
    let debtSvcAnnual: number | null = null;

    if (loanAmt && NOI != null) {
      const mRate = RATE / 12;                 // monthly rate
      const n = YEARS * 12;                    // total months
      // Standard mortgage payment formula
      const pmt = loanAmt * (mRate * Math.pow(1 + mRate, n)) / (Math.pow(1 + mRate, n) - 1);
      debtSvcMonthly = round(pmt, 2);
      debtSvcAnnual  = round(pmt * 12, 2);

      // DSCR compares annual NOI to annual debt service
      dscr = (debtSvcAnnual && debtSvcAnnual > 0) ? round(NOI / debtSvcAnnual, 3) : null;
    }

    return JSON.stringify({
      capRate,                   // ratio (e.g., 0.065)
      dscr,                      // e.g., 1.28
      loanAmt,                   // dollars
      debtSvc: debtSvcAnnual,    // annual debt service ($/yr)
      debtSvcMonthly,            // extra: monthly payment for UI
    });
  }
});
