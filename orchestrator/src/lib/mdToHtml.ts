// src/lib/mdToHtml.ts — minimal markdown -> HTML for agent answers
// ── Minimal markdown → HTML (final answers render via [innerHTML]) ─────────
export function mdToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    s
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  const lines = esc(md).split("\n");
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const isItem = /^\s*[*-]\s+/.test(line);
    if (inList && !isItem) { out.push("</ul>"); inList = false; }
    if (!line.trim()) continue;
    if (/^###\s+/.test(line)) out.push(`<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`);
    else if (/^##\s+/.test(line)) out.push(`<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`);
    else if (isItem) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[*-]\s+/, ""))}</li>`);
    } else out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}
