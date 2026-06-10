// src/tools/locationIntel/providers/placerProvider.ts — Placer.ai foot traffic (placeholder)
// Future: https://docs.placer.ai — venue visits, trade area, dwell time.

import type { MobilityProvider, ProviderSignals } from "./types.js";
import type { TrafficPatternInput } from "../scoring.js";

export const placerProvider: MobilityProvider = {
  name: "placer.ai",
  isConfigured: () => Boolean(process.env.PLACER_API_KEY),
  async fetchSignals(_input: TrafficPatternInput): Promise<ProviderSignals | null> {
    if (!this.isConfigured()) return null;
    // TODO: GET /v1/venues?address=... → map visits/day to footTrafficScore (0–100)
    return null;
  },
};
