// src/langgraph/specialists.ts — Platform-side view of the agent team.
// The actual team definition (supervisor + specialists + prompts) lives in
// the active domain pack (src/packs/cre/specialists.ts); this module
// re-exports it for the LangGraph supervisor and keeps the generic helpers
// (topology builder, JSON-schema→zod). Mirrors the Neuro SAN network
// (neurosan/registries/dealsense.hocon) since both are generated from the
// same pack data.
import { z, ZodTypeAny } from "zod";
import { getActivePack, type SpecialistSpec } from "../platform/domainPack.js";

export type SpecialistDef = SpecialistSpec;

export { SUPERVISOR_NAME, SUPERVISOR_PROMPT, SPECIALISTS } from "../packs/cre/specialists.js";

/** Same {nodes, edges} shape the Neuro SAN proxy serves, for the UI panel.
 *  Built from the active pack, so it adapts when the pack changes. */
export function lgNetworkTopology() {
  const pack = getActivePack();
  const nodes: Array<{ id: string; type: string; parent?: string }> = [
    { id: pack.supervisorName, type: "front_man" },
  ];
  const edges: Array<{ from: string; to: string }> = [];
  for (const s of pack.specialists) {
    nodes.push({ id: s.name, type: "specialist", parent: pack.supervisorName });
    edges.push({ from: pack.supervisorName, to: s.name });
    for (const t of s.tools) {
      nodes.push({ id: t, type: "tool", parent: s.name });
      edges.push({ from: s.name, to: t });
    }
  }
  return { nodes, edges };
}

/** Convert a registry JSON-schema parameters block to a zod object (the
 * subset of JSON Schema our registry uses: string/number/boolean/array/object). */
export function jsonSchemaToZod(params: any): z.ZodObject<any> {
  const props = params?.properties || {};
  const required: string[] = params?.required || [];
  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, raw] of Object.entries<any>(props)) {
    let t = typeFor(raw);
    if (raw.description) t = t.describe(raw.description);
    // LLMs send explicit nulls for optional params; accept and strip later.
    shape[key] = required.includes(key) ? t : t.nullable().optional();
  }
  return z.object(shape);
}

function typeFor(prop: any): ZodTypeAny {
  switch (prop?.type) {
    case "string":
      return prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(prop.items ? typeFor(prop.items) : z.any());
    case "object": {
      if (prop.properties) return jsonSchemaToZod(prop);
      return z.record(z.any());
    }
    default:
      return z.any();
  }
}
