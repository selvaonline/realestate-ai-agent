// src/tools/trafficAnalysis.ts — analyze_traffic_patterns (Location Intelligence / Foot Traffic Agent)
// Estimates real-world property activity: foot traffic, parking, road traffic, anchors, visibility.
// PoC: deterministic heuristics (locationIntel/scoring.ts); real providers plug in via locationIntel/providers/.

import type { RegisteredTool } from "../lib/agentTypes.js";
import { scoreTrafficPatterns, computeMobilityScore, type TrafficPatternInput } from "./locationIntel/scoring.js";
import { fetchProviderSignals, configuredProviders } from "./locationIntel/providers/index.js";

export const analyzeTrafficPatternsTool: RegisteredTool = {
  category: "location",
  estimatedDurationMs: 500,
  schema: {
    name: "analyze_traffic_patterns",
    description: "Estimate foot traffic, parking utilization, road traffic, and nearby anchor strength for a property. Returns a 0-100 Mobility Score with trend, confidence, signals, and risks for investment underwriting. Call this when the user asks about foot traffic, parking, road traffic, visibility, site quality, location strength, retail activity, or nearby anchors — and for retail, pharmacy, QSR, grocery, urgent care, and medical office properties.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Property address" },
        propertyType: { type: "string", description: "Property type such as retail, medical office, pharmacy, grocery, QSR" },
        tenant: { type: "string", description: "Tenant name if available" },
        metro: { type: "string", description: "Metro or city" },
      },
      required: ["address"],
    },
  },
  execute: async (args, ctx) => {
    const input: TrafficPatternInput = {
      address: String(args.address || ""),
      propertyType: args.propertyType,
      tenant: args.tenant,
      metro: args.metro,
      query: args.query,
    };

    ctx.pub?.("thinking", { text: `Analyzing real-world activity signals for ${input.address || "property"}...` });

    // Heuristic PoC scores
    const result = scoreTrafficPatterns(input);

    // Future providers (Placer.ai, SafeGraph, Google Places, DOT) override heuristics when configured
    const providerSignals = await fetchProviderSignals(input);
    if (providerSignals) {
      Object.assign(result, {
        footTrafficScore: providerSignals.footTrafficScore ?? result.footTrafficScore,
        parkingScore: providerSignals.parkingScore ?? result.parkingScore,
        trafficScore: providerSignals.trafficScore ?? result.trafficScore,
        nearbyAnchorScore: providerSignals.nearbyAnchorScore ?? result.nearbyAnchorScore,
        visibilityScore: providerSignals.visibilityScore ?? result.visibilityScore,
      });
      result.mobilityScore = computeMobilityScore(result);
      result.signals.push(`Live mobility data: ${configuredProviders().map(p => p.name).join(", ")}`);
    }

    // Push structured result to the UI ("Location Intelligence" panel + "Mobility Enhanced" badge)
    ctx.pub?.("mobility_result", { mobility: result });

    return result;
  },
};
