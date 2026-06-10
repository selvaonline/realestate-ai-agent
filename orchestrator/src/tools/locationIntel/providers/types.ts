// src/tools/locationIntel/providers/types.ts — Future mobility data provider interface
// PoC ships with heuristics only; these hooks let real providers override component scores.

import type { TrafficPatternInput } from "../scoring.js";

/** Partial component scores / raw signals a provider can contribute (all 0–100). */
export interface ProviderSignals {
  footTrafficScore?: number;
  parkingScore?: number;
  trafficScore?: number;
  nearbyAnchorScore?: number;
  visibilityScore?: number;
  /** Raw provider metrics for transparency (visits/day, AADT counts, etc.) */
  raw?: Record<string, unknown>;
  notes?: string[];
}

export interface MobilityProvider {
  readonly name: string;
  /** True when required API keys / config are present. */
  isConfigured(): boolean;
  /** Returns null when unconfigured or no data for the location. */
  fetchSignals(input: TrafficPatternInput): Promise<ProviderSignals | null>;
}
