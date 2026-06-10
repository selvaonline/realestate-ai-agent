// src/tools/locationIntel/providers/safeGraphProvider.ts — SafeGraph Patterns (placeholder)
// Future: SafeGraph Places/Patterns — POI density, visit patterns, brand anchors.

import type { MobilityProvider, ProviderSignals } from "./types.js";
import type { TrafficPatternInput } from "../scoring.js";

export const safeGraphProvider: MobilityProvider = {
  name: "safegraph",
  isConfigured: () => Boolean(process.env.SAFEGRAPH_API_KEY),
  async fetchSignals(_input: TrafficPatternInput): Promise<ProviderSignals | null> {
    if (!this.isConfigured()) return null;
    // TODO: Places search around address → nearbyAnchorScore from brand POI density
    return null;
  },
};
