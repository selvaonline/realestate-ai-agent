// src/lib/specialistAppendix.ts — render each specialist's full finding as
// collapsible HTML sections appended below the supervisor's synthesis.
// Guarantees the user always sees the detailed per-agent output, no matter
// how tersely the supervisor LLM summarizes.
import { mdToHtml } from "./mdToHtml.js";

const pretty = (id: string) =>
  id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function buildSpecialistAppendix(
  findings: Array<{ specialist: string; content: string }>
): string {
  if (!findings.length) return "";
  const counts = new Map<string, number>();
  const sections = findings.map((f) => {
    const n = (counts.get(f.specialist) || 0) + 1;
    counts.set(f.specialist, n);
    const dup = findings.filter((x) => x.specialist === f.specialist).length > 1;
    const title = `${pretty(f.specialist)}${dup ? ` — report #${n}` : ""}`;
    return `<details class="spec-report" open>
<summary><strong>🔎 ${title}</strong></summary>
<div class="spec-report-body">${mdToHtml(f.content)}</div>
</details>`;
  });
  return `<hr/><h2>Specialist Reports</h2>\n${sections.join("\n")}`;
}
