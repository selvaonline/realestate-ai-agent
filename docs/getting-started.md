# Getting Started

Run the full multi-agent stack locally. Prereqs: **Node 20+**, **Python 3.10+**, and one LLM key (`GEMINI_API_KEY`, `OPENAI_API_KEY`, or `GROQ_API_KEY`).

## 1. Backend tool layer (always required)

```bash
cd orchestrator
npm install
npm run dev          # Express on :3001 — 20-tool registry + orchestrator routes
```

Verify: `curl localhost:3001/healthz` → `{"ok":true}` and
`curl localhost:3001/api/tools/registry` lists 20 tools.

## 2. Pick your orchestrator

=== "LangGraph.js (in-process, zero extra setup)"

    Nothing to start — the LangGraph supervisor runs **inside** the Express
    process. Check it's live:

    ```bash
    curl localhost:3001/api/lg/health    # {"ok":true} if an LLM key is set
    ```

    Model tiering defaults: supervisor `gemini-2.5-pro`, specialists
    `gemini-2.5-flash`. Override with `LG_SUPERVISOR_MODEL` / `LG_MODEL`.

=== "Neuro SAN (Cognizant OSS, separate server)"

    ```bash
    cd neurosan
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt

    export GOOGLE_API_KEY=...                      # or OPENAI_API_KEY
    export PYTHONPATH=$(pwd)
    export AGENT_MANIFEST_FILE=$(pwd)/registries/manifest.hocon
    export AGENT_TOOL_PATH=$(pwd)/coded_tools

    python -m neuro_san.service.main_loop.server_main_loop   # :8080
    ```

    Verify: `curl localhost:3001/api/ns/health` → `{"ok":true}`.

## 3. Frontend

```bash
cd deal-agent-ui
npm install
npx ng serve         # http://localhost:4200
```

Fresh sessions default to **Neuro SAN** mode. The ⚡ toggle in the header
cycles Classic → Neuro SAN → LangGraph.js.

## 4. First query

Paste this into the search box and watch the network graph light up:

> Find NNN Walgreens deals in Florida, assess the risk and tenant credit of
> the best one, run a 10-year DCF on it, and draft an investment committee memo.

Expect 1–3 minutes for a full multi-specialist run. Then hit **↻ Replay** in
the network panel header to re-animate it in seconds.

## 5. Run the evals

```bash
cd neurosan
python3 evals/run_tool_evals.py                 # Tier 1: deterministic tool tests
python3 evals/run_agent_evals.py                # Tier 2: routing (Neuro SAN)
python3 evals/run_judge_evals.py --orch lg      # Tier 3: behavioral judge evals
```

!!! tip "Regenerating the Neuro SAN network"
    The agent network hocon is **generated** from the live tool registry —
    never edit it by hand. After changing tools in
    `orchestrator/src/tools/registry.ts`:

    ```bash
    cd neurosan && python3 generate_network.py
    ```
