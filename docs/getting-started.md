# Getting Started

Run the full multi-agent stack locally. Prereqs: **Node 20+**, **Python 3.10+** (evals only), and one LLM key (`GEMINI_API_KEY`, `OPENAI_API_KEY`, or `GROQ_API_KEY`).

## 1. Backend tool layer (always required)

```bash
cd orchestrator
npm install
npm run dev          # Express on :3001 — 20-tool registry + orchestrator routes
```

Verify: `curl localhost:3001/healthz` → `{"ok":true}` and
`curl localhost:3001/api/tools/registry` lists 20 tools.

## 2. The orchestrator (zero extra setup)

Nothing to start — the LangGraph.js supervisor runs **inside** the Express
process. Check it's live:

```bash
curl localhost:3001/api/lg/health    # {"ok":true} if an LLM key is set
```

Model tiering defaults: supervisor `gemini-2.5-pro`, specialists
`gemini-2.5-flash`. Override with `LG_SUPERVISOR_MODEL` / `LG_MODEL`.

## 3. Frontend

```bash
cd deal-agent-ui
npm install
npx ng serve         # http://localhost:4200
```

Fresh sessions default to **LangGraph.js** multi-agent mode. The ⚡ toggle
in the header switches Classic ↔ LangGraph.js.

## 4. First query

Paste this into the search box and watch the network graph light up:

> Find NNN Walgreens deals in Florida, assess the risk and tenant credit of
> the best one, run a 10-year DCF on it, and draft an investment committee memo.

Expect 1–3 minutes for a full multi-specialist run. Then hit **↻ Replay** in
the network panel header to re-animate it in seconds.

## 5. Run the evals

```bash
cd orchestrator
python3 evals/run_judge_evals.py      # behavioral judge evals (routing, faithfulness, honesty...)
```
