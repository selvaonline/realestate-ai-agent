// src/tools/locationIntel/providers/dotTrafficProvider.ts — State DOT AADT counts (placeholder)
// Future: state DOT open-data traffic counts (AADT) near the parcel → trafficScore.

import type { MobilityProvider, ProviderSignals } from "./types.js";
import type { TrafficPatternInput } from "../scoring.js";

export const dotTrafficProvider: MobilityProvider = {
  name: "dot-traffic",
  isConfigured: () => Boolean(process.env.DOT_TRAFFIC_API_URL),
  async fetchSignals(_input: TrafficPatternInput): Promise<ProviderSignals | null> {
    if (!this.isConfigured()) return null;
    // TODO: nearest count station AADT → scale to trafficScore (e.g. 30k+ AADT → 85)
    return null;
  },
};
