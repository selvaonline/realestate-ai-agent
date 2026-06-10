// src/bootstrap.ts — Loads the active domain pack into the platform registry.
// MUST be imported first in index.ts (right after dotenv) so the registry is
// populated before any route module or orchestrator touches it.
// Swapping verticals = swapping the pack imported here (or, later, selecting
// by env var / tenant config).
import { loadPack } from "./platform/domainPack.js";
import { crePack } from "./packs/cre/index.js";

loadPack(crePack);
