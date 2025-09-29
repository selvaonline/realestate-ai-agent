// src/tools/search.ts
import { DynamicTool } from "@langchain/core/tools";

export const webSearch = new DynamicTool({
  name: "web_search",
  description:
    "Search the web (Serper/Google) for property listings/news; returns top results with title,url,snippet.",
  func: async (query: string) => {
    const key = process.env.SERPER_API_KEY;
    if (!key) throw new Error("SERPER_API_KEY missing");

    // Encourage listing sites for better extractor hits
    const q = `${query} site:loopnet.com OR site:crexi.com`;

    const r = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": key,
      },
      body: JSON.stringify({ q, num: 6 }),
    });

    if (!r.ok) throw new Error(`Serper error ${r.status}`);
    const j = await r.json();

    const rows = (j.organic ?? []).slice(0, 6).map((v: any) => ({
      title: v.title,
      url: v.link,
      snippet: v.snippet,
    }));

    return JSON.stringify(rows);
  },
});
