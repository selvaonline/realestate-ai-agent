// src/tools/locationIntel/providers/index.ts — provider registry
import type { MobilityProvider, ProviderSignals } from "./types.js";
import type { TrafficPatternInput } from "../scoring.js";
import { placerProvider } from "./placerProvider.js";
import { safeGraphProvider } from "./safeGraphProvider.js";
import { googlePlacesProvider } from "./googlePlacesProvider.js";
import { dotTrafficProvider } from "./dotTrafficProvider.js";

export const mobilityProviders: MobilityProvider[] = [
  placerProvider,
  safeGraphProvider,
  googlePlacesProvider,
  dotTrafficProvider,
];

export function configuredProviders(): MobilityProvider[] {
  return mobilityProviders.filter(p => p.isConfigured());
}

/** Merge signals from all configured providers (later providers win per-field). */
export async function fetchProviderSignals(input: TrafficPatternInput): Promise<ProviderSignals | null> {
  const active = configuredProviders();
  if (active.length === 0) return null;
  const results = await Promise.all(active.map(p => p.fetchSignals(input).catch(() => null)));
  const merged = results.filter(Boolean).reduce<ProviderSignals>((acc, s) => ({ ...acc, ...s }), {});
  return Object.keys(merged).length > 0 ? merged : null;
}

export type { MobilityProvider, ProviderSignals } from "./types.js";
