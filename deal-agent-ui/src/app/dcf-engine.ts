export interface DcfInputs {
  purchasePrice: number;
  noi: number;
  entryCapRate: number;
  ltv: number;
  interestRate: number;
  amortYears: number;
  holdYears: number;
  noiGrowth: number;
  exitCapSpread: number; // bps above entry cap
}

export interface DcfResult {
  loanAmount: number;
  equity: number;
  annualDebtService: number;
  cashFlows: number[];
  exitValue: number;
  remainingBalance: number;
  saleProceeds: number;
  cashOnCash: number;
  equityMultiple: number;
  irr: number;
  totalReturn: number;
}

const DEFAULT_INPUTS: Partial<DcfInputs> = {
  ltv: 0.65,
  interestRate: 0.055,
  amortYears: 30,
  holdYears: 5,
  noiGrowth: 0.02,
  exitCapSpread: 0.005,
};

export function computeDcf(partial: Partial<DcfInputs>): DcfResult | null {
  const price = partial.purchasePrice;
  const noi = partial.noi;
  if (!price || !noi || price <= 0 || noi <= 0) return null;

  const inp: DcfInputs = {
    purchasePrice: price,
    noi,
    entryCapRate: partial.entryCapRate || (noi / price),
    ltv: partial.ltv ?? DEFAULT_INPUTS.ltv!,
    interestRate: partial.interestRate ?? DEFAULT_INPUTS.interestRate!,
    amortYears: partial.amortYears ?? DEFAULT_INPUTS.amortYears!,
    holdYears: partial.holdYears ?? DEFAULT_INPUTS.holdYears!,
    noiGrowth: partial.noiGrowth ?? DEFAULT_INPUTS.noiGrowth!,
    exitCapSpread: partial.exitCapSpread ?? DEFAULT_INPUTS.exitCapSpread!,
  };

  const loanAmount = inp.purchasePrice * inp.ltv;
  const equity = inp.purchasePrice - loanAmount;
  const monthlyRate = inp.interestRate / 12;
  const totalPayments = inp.amortYears * 12;

  // Monthly payment (PMT formula)
  const pmt = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments))
    / (Math.pow(1 + monthlyRate, totalPayments) - 1);
  const annualDebtService = pmt * 12;

  // Annual cash flows
  const cashFlows: number[] = [];
  for (let yr = 1; yr <= inp.holdYears; yr++) {
    const yrNoi = inp.noi * Math.pow(1 + inp.noiGrowth, yr - 1);
    cashFlows.push(yrNoi - annualDebtService);
  }

  // Exit value
  const exitCapRate = inp.entryCapRate + inp.exitCapSpread;
  const exitNoi = inp.noi * Math.pow(1 + inp.noiGrowth, inp.holdYears);
  const exitValue = exitNoi / exitCapRate;

  // Remaining loan balance after hold period
  const monthsHeld = inp.holdYears * 12;
  let balance = loanAmount;
  for (let m = 0; m < monthsHeld; m++) {
    const interest = balance * monthlyRate;
    const principal = pmt - interest;
    balance -= principal;
  }
  const remainingBalance = Math.max(0, balance);
  const saleProceeds = exitValue - remainingBalance;

  const cashOnCash = cashFlows[0] / equity;
  const totalCashFromOps = cashFlows.reduce((s, c) => s + c, 0);
  const totalReturn = totalCashFromOps + saleProceeds;
  const equityMultiple = totalReturn / equity;

  // IRR via bisection
  const irr = computeIrr(equity, cashFlows, saleProceeds);

  return {
    loanAmount, equity, annualDebtService,
    cashFlows, exitValue, remainingBalance, saleProceeds,
    cashOnCash, equityMultiple, irr, totalReturn,
  };
}

function computeIrr(equity: number, cashFlows: number[], terminalValue: number): number {
  const flows = [-equity, ...cashFlows];
  flows[flows.length - 1] += terminalValue;

  let lo = -0.5, hi = 2.0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const npv = flows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + mid, t), 0);
    if (Math.abs(npv) < 0.01) return mid;
    if (npv > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function sensitivityGrid(
  base: Partial<DcfInputs>,
  capRateDeltas: number[],
  rateDeltas: number[]
): { capRate: number; interestRate: number; irr: number; equityMultiple: number }[][] {
  const baseCapRate = base.entryCapRate || (base.noi! / base.purchasePrice!);
  const baseRate = base.interestRate ?? 0.055;

  return capRateDeltas.map(cd => {
    return rateDeltas.map(rd => {
      const result = computeDcf({
        ...base,
        entryCapRate: baseCapRate + cd,
        interestRate: baseRate + rd,
      });
      return {
        capRate: baseCapRate + cd,
        interestRate: baseRate + rd,
        irr: result?.irr ?? 0,
        equityMultiple: result?.equityMultiple ?? 0,
      };
    });
  });
}
