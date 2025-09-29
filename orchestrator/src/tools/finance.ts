import { DynamicTool } from "@langchain/core/tools";

export const quickUnderwrite = new DynamicTool({
  name: "quick_underwrite",
  description: "Compute cap rate & DSCR. Input: {noi:number|null, price:number|null, rate?:number, amortYears?:number, ltv?:number}",
  func: async (input: string) => {
    const { noi, price, rate = 0.055, amortYears = 30, ltv = 0.65 } = JSON.parse(input);
    const capRate = noi && price ? noi / price : null;
    const loanAmt = price ? price * ltv : null;
    let dscr: number | null = null, debtSvc: number | null = null;
    if (loanAmt && noi) {
      const mRate = rate / 12;
      const n = amortYears * 12;
      debtSvc = loanAmt * (mRate * Math.pow(1 + mRate, n)) / (Math.pow(1 + mRate, n) - 1);
      dscr = noi / debtSvc;
    }
    return JSON.stringify({ capRate, dscr, loanAmt, debtSvc });
  }
});
