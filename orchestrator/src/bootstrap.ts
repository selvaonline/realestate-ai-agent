// src/bootstrap.ts — Loads the active domain pack into the platform registry.
// MUST be imported first in index.ts (right after dotenv) so the registry is
// populated before any route module or orchestrator touches it.
//
// Select the vertical with DOMAIN_PACK (defaults to "cre"). Adding a new
// vertical = adding a pack under src/packs/ and one entry here.
import { loadPack, type DomainPack } from "./platform/domainPack.js";
import { crePack } from "./packs/cre/index.js";

const PACKS: Record<string, DomainPack> = {
  [crePack.id]: crePack,
};

const packId = process.env.DOMAIN_PACK || "cre";
const pack = PACKS[packId];
if (!pack) {
  throw new Error(
    `[platform] unknown DOMAIN_PACK "${packId}" — available: ${Object.keys(PACKS).join(", ")}`
  );
}
loadPack(pack);
