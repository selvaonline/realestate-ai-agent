// src/tools/locationIntel/providers/googlePlacesProvider.ts — Google Places (placeholder)
// Future: Places API Nearby Search + popular times for anchors and visit intensity.

import type { MobilityProvider, ProviderSignals } from "./types.js";
import type { TrafficPatternInput } from "../scoring.js";

export const googlePlacesProvider: MobilityProvider = {
  name: "google-places",
  isConfigured: () => Boolean(process.env.GOOGLE_MAPS_API_KEY),
  async fetchSignals(_input: TrafficPatternInput): Promise<ProviderSignals | null> {
    if (!this.isConfigured()) return null;
    // TODO: Nearby Search (radius ~1mi) → anchor brands, ratings volume → nearbyAnchorScore/footTrafficScore
    return null;
  },
};
