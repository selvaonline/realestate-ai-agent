import { DynamicTool } from "@langchain/core/tools";

/**
 * Serper.dev web search
 * Requires: SERPER_API_KEY
 */
export const webSearch = new DynamicTool({
  name: "web_search",
  description:
    "Search the web for property listings/news; returns top results with title,url,snippet.",
  func: async (query: string) => {
    const key = process.env.SERPER_API_KEY;
    if (!key) throw new Error("SERPER_API_KEY missing");

    // Bias queries toward actual detail pages when the prompt looks like a listing search
    const q = query;

    const r = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`serper error ${r.status}: ${txt}`);
    }

    // Cast JSON payload (unknown under strict TS)
    const j: any = await r.json();

    const rows = (j.organic ?? []).map((v: any) => ({
      title: v.title,
      url: v.link,
      snippet: v.snippet,
    }));

    return JSON.stringify(rows);
  },
});
