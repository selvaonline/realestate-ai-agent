// src/tools/portfolioVar.ts — VaR (Value at Risk) & stress-testing tool
import type { RegisteredTool } from "../lib/agentTypes.js";
import { computeDcf } from "./dcfServer.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Z-scores for common confidence levels. */
const Z_SCORES: Record<number, number> = { 0.95: 1.645, 0.99: 2.326 };

function zScore(confidence: number): number {
  return Z_SCORES[confidence] ?? 1.645;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[]): number {
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── Scenario Definitions ────────────────────────────────────────────────────

type ScenarioKey = "rate_shock" | "noi_decline" | "vacancy_spike" | "cap_expansion";

const ALL_SCENARIOS: ScenarioKey[] = [
  "rate_shock",
  "noi_decline",
  "vacancy_spike",
  "cap_expansion",
];

interface PropertyInput {
  purchasePrice: number;
  noi: number;
  ltv?: number;
  interestRate?: number;
  title?: string;
}

// ── Tool Registration ───────────────────────────────────────────────────────

export const portfolioVarTool: RegisteredTool = {
  category: "portfolio",
  estimatedDurationMs: 500,

  schema: {
    name: "portfolio_var",
    description:
      "Compute Value at Risk (VaR) and run stress test scenarios on a CRE property or portfolio. " +
      "Stress tests include rate shock, NOI decline, vacancy spike, and cap rate expansion.",
    parameters: {
      type: "object",
      properties: {
        properties: {
          type: "array",
          description:
            "Array of property objects with {purchasePrice, noi, ltv?, interestRate?, title?}",
          items: {
            type: "object",
            properties: {
              purchasePrice: { type: "number", description: "Purchase price in dollars" },
              noi: { type: "number", description: "Annual NOI in dollars" },
              ltv: { type: "number", description: "Loan-to-value ratio (optional)" },
              interestRate: { type: "number", description: "Annual interest rate (optional)" },
              title: { type: "string", description: "Property title (optional)" },
            },
          },
        },
        confidenceLevel: {
          type: "number",
          description: "VaR confidence level (default 0.95)",
        },
        scenarios: {
          type: "array",
          description:
            'Subset of stress scenarios to run. Options: "rate_shock", "noi_decline", "vacancy_spike", "cap_expansion". Defaults to all.',
          items: { type: "string" },
        },
      },
      required: ["properties"],
    },
  },

  async execute(args, _ctx) {
    const props: PropertyInput[] = args.properties;
    const confidence: number = args.confidenceLevel ?? 0.95;
    const scenarioFilter: ScenarioKey[] =
      args.scenarios && args.scenarios.length > 0
        ? (args.scenarios as ScenarioKey[])
        : ALL_SCENARIOS;

    // ── 1. Base-case IRRs ─────────────────────────────────────────────────

    const baseResults = props.map((p) => {
      const result = computeDcf({
        purchasePrice: p.purchasePrice,
        noi: p.noi,
        ltv: p.ltv,
        interestRate: p.interestRate,
      });
      return {
        title: p.title ?? `Deal @ ${(p.noi / p.purchasePrice * 100).toFixed(1)}% cap`,
        purchasePrice: p.purchasePrice,
        baseIrr: result?.irr ?? 0,
        input: p,
      };
    });

    // ── 2. Stress each property under each scenario ───────────────────────

    type StressedIrrs = Partial<Record<ScenarioKey, number>>;

    const dealBreakdown: {
      title: string;
      baseIrr: string;
      stressedIrrs: Partial<Record<ScenarioKey, string>>;
    }[] = [];

    /** All stressed IRRs across all properties and scenarios (for VaR). */
    const allStressedIrrs: number[] = [];

    /** scenario -> weighted portfolio IRR */
    const scenarioPortfolioIrrs: Map<ScenarioKey, number> = new Map();

    for (const scenario of scenarioFilter) {
      let weightedSum = 0;
      let totalWeight = 0;

      for (const deal of baseResults) {
        const p = deal.input;
        const shocked = applyScenario(scenario, p);
        const res = computeDcf(shocked);
        const irr = res?.irr ?? 0;
        allStressedIrrs.push(irr);

        // weighted by purchasePrice
        weightedSum += irr * p.purchasePrice;
        totalWeight += p.purchasePrice;
      }

      scenarioPortfolioIrrs.set(
        scenario,
        totalWeight > 0 ? weightedSum / totalWeight : 0,
      );
    }

    // Build deal breakdown
    for (const deal of baseResults) {
      const stressedIrrs: Partial<Record<ScenarioKey, string>> = {};
      for (const scenario of scenarioFilter) {
        const shocked = applyScenario(scenario, deal.input);
        const res = computeDcf(shocked);
        stressedIrrs[scenario] = fmtPct(res?.irr ?? 0);
      }
      dealBreakdown.push({
        title: deal.title,
        baseIrr: fmtPct(deal.baseIrr),
        stressedIrrs,
      });
    }

    // ── 3. Portfolio-level base IRR (weighted average) ────────────────────

    const totalPrice = baseResults.reduce((s, d) => s + d.purchasePrice, 0);
    const portfolioIrr =
      totalPrice > 0
        ? baseResults.reduce((s, d) => s + d.baseIrr * d.purchasePrice, 0) / totalPrice
        : 0;

    // ── 4. Parametric VaR ─────────────────────────────────────────────────

    const mu = mean(allStressedIrrs);
    const sigma = stddev(allStressedIrrs);

    const var95 = mu - zScore(0.95) * sigma;
    const var99 = mu - zScore(0.99) * sigma;

    // ── 5. Stress results table ───────────────────────────────────────────

    const stressResults = scenarioFilter.map((scenario) => {
      const scenIrr = scenarioPortfolioIrrs.get(scenario) ?? 0;
      const irrDelta = scenIrr - portfolioIrr;

      // Identify worst deal in this scenario
      let worstDeal: string | undefined;
      let worstIrr = Infinity;
      for (const deal of baseResults) {
        const shocked = applyScenario(scenario, deal.input);
        const res = computeDcf(shocked);
        const irr = res?.irr ?? 0;
        if (irr < worstIrr) {
          worstIrr = irr;
          worstDeal = deal.title;
        }
      }

      return {
        scenario,
        portfolioIrr: fmtPct(scenIrr),
        irrDelta: fmtPct(irrDelta),
        worstDeal,
      };
    });

    // ── 6. Max drawdown (biggest IRR drop across any scenario) ────────────

    const maxDrawdown = stressResults.reduce(
      (worst, sr) => {
        const delta = (scenarioPortfolioIrrs.get(sr.scenario as ScenarioKey) ?? 0) - portfolioIrr;
        return delta < worst ? delta : worst;
      },
      0,
    );

    // ── Return ────────────────────────────────────────────────────────────

    return {
      portfolioIrr: fmtPct(portfolioIrr),
      var95: fmtPct(var95),
      var99: fmtPct(var99),
      maxDrawdown: fmtPct(maxDrawdown),
      stressResults,
      dealBreakdown,
    };
  },
};

// ── Scenario Application ────────────────────────────────────────────────────

function applyScenario(
  scenario: ScenarioKey,
  p: PropertyInput,
): Partial<import("./dcfServer.js").DcfInputs> {
  const base: Partial<import("./dcfServer.js").DcfInputs> = {
    purchasePrice: p.purchasePrice,
    noi: p.noi,
    ltv: p.ltv,
    interestRate: p.interestRate,
  };

  switch (scenario) {
    case "rate_shock":
      return { ...base, interestRate: (p.interestRate ?? 0.055) + 0.02 };
    case "noi_decline":
      return { ...base, noi: p.noi * 0.85 };
    case "vacancy_spike":
      return { ...base, noi: p.noi * 0.75 };
    case "cap_expansion":
      return { ...base, exitCapSpread: (0.005) + 0.01 };
    default:
      return base;
  }
}
