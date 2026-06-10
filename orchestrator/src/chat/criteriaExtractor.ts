// src/chat/criteriaExtractor.ts — Extract investment criteria from user messages
import { getLLM, hasLLM } from "../llm.js";
import type { InvestmentCriteria } from "../lib/agentTypes.js";

/**
 * Lightweight LLM call to extract investment criteria updates from a user message.
 * Returns only the fields that were explicitly mentioned, or null if none found.
 */
export async function extractCriteriaFromMessage(
  message: string,
  existing: InvestmentCriteria
): Promise<Partial<InvestmentCriteria> | null> {
  if (!hasLLM()) return null;

  // Quick heuristic check — skip LLM call if no investment-related keywords
  const hasSignal = /cap\s*rate|irr|noi|price|million|%|yield|nnn|industrial|retail|office|medical|florida|texas|california|dallas|miami|austin|tenant|walgreens|cvs|dollar general|risk|conservative|aggressive|hold|year/i.test(message);
  if (!hasSignal) return null;

  try {
    const { client, model } = getLLM();

    const resp = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You extract commercial real estate investment criteria from user messages.
Return a JSON object with ONLY the fields explicitly mentioned. Return null if no criteria found.

Fields:
- propertyTypes: string[] (e.g. ["NNN retail", "industrial", "medical office"])
- targetMarkets: string[] (e.g. ["Texas", "Florida", "Dallas"])
- capRateMin: number (decimal, e.g. 0.06 for 6%)
- capRateMax: number (decimal)
- priceMin: number (dollars)
- priceMax: number (dollars)
- tenantPreferences: string[] (e.g. ["Walgreens", "Dollar General"])
- riskTolerance: "low" | "medium" | "high"
- holdPeriodYears: number
- targetIrr: number (decimal, e.g. 0.15 for 15%)

Current criteria: ${JSON.stringify(existing)}`
        },
        { role: "user", content: message }
      ],
      temperature: 0,
      max_tokens: 300,
    });

    const content = resp.choices[0]?.message?.content?.trim();
    if (!content || content === "null") return null;

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) return null;

    console.log("[criteriaExtractor] Extracted criteria:", JSON.stringify(parsed));
    return parsed;
  } catch (e: any) {
    console.error("[criteriaExtractor] Failed:", e.message);
    return null;
  }
}

/**
 * Merge new criteria into existing, only updating fields that are present in the update.
 */
export function mergeCriteria(
  existing: InvestmentCriteria,
  update: Partial<InvestmentCriteria>
): InvestmentCriteria {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined && value !== null) {
      (merged as any)[key] = value;
    }
  }

  merged.lastUpdated = Date.now();
  return merged;
}
