import OpenAI from "openai";

type LLMProvider = {
  name: string;
  client: OpenAI;
  model: string;
};

const providers: { name: string; envKey: string; baseURL: string; defaultModel: string }[] = [
  {
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
  },
  {
    name: "Gemini",
    envKey: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.5-flash",
  },
  {
    name: "Grok",
    envKey: "XAI_API_KEY",
    baseURL: "https://api.x.ai/v1",
    defaultModel: "grok-3-mini",
  },
  {
    name: "Groq (Llama)",
    envKey: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
];

let cached: LLMProvider | null = null;

/**
 * Resolves the first available LLM provider by checking env vars in priority order:
 * OpenAI → Gemini → Grok → Groq (Llama)
 *
 * All providers expose an OpenAI-compatible chat completions API,
 * so the returned `client` can be used identically to `new OpenAI()`.
 */
export function getLLM(): LLMProvider {
  if (cached) return cached;

  for (const p of providers) {
    const key = process.env[p.envKey];
    if (key) {
      const modelOverride = (p.name === "OpenAI" ? process.env.OPENAI_MODEL : undefined) || p.defaultModel;
      console.log(`[llm] ✅ Using ${p.name} (model: ${modelOverride})`);
      cached = {
        name: p.name,
        client: new OpenAI({ apiKey: key, baseURL: p.baseURL }),
        model: modelOverride,
      };
      return cached;
    }
  }

  console.error("[llm] ❌ No LLM API key found. Set one of:", providers.map(p => p.envKey).join(", "));
  throw new Error(
    `No LLM API key configured. Set one of: ${providers.map(p => p.envKey).join(", ")}`
  );
}

/** Quick check without throwing — useful for startup logging. */
export function hasLLM(): boolean {
  return providers.some(p => !!process.env[p.envKey]);
}

/** Reset cached provider (e.g. after env change via hot-reload). */
export function resetLLM(): void {
  cached = null;
}
