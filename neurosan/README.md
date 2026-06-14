# DealSense × Neuro SAN — Multi-Agent Orchestration Layer

Supervisor-orchestrated multi-agent network for commercial real estate PE deal
analysis, built on [Cognizant Neuro SAN](https://github.com/cognizant-ai-lab/neuro-san)
(open source, Apache 2.0).

The existing DealSense Node orchestrator stays exactly as it is — it becomes the
**tool execution layer**. Neuro SAN becomes the **reasoning/orchestration layer**
on top of it:

```
                        ┌─────────────────────────────┐
 user ──► neuro-san ──► │  deal_advisor (front man)   │   supervisor: decomposes,
          (port 8080)   └──────────────┬──────────────┘   routes, synthesizes
            ┌─────────────┬────────────┼────────────┬──────────────┬────────────┐
            ▼             ▼            ▼            ▼              ▼            ▼
      property_scout  risk_analyst  market_    financial_   portfolio_    deal_writer
                                    analyst    modeler      manager
       search          assess_risk   get_macro  run_dcf      portfolio_rev  generate_memo
       analyze_url     score_deals   deep_dive  multi_asset  portfolio_var  generate_loi
       comp_analysis   tenant_credit market_intel  _compare  compliance
       filter_rank     risk_decomp   traffic                 pipeline
            │             │            │            │              │            │
            └─────────────┴────────────┴─────┬──────┴──────────────┴────────────┘
                                             ▼
                          plain HTTP (zero LLM tokens per tool call)
                          POST http://localhost:3001/api/tools/execute
                                             ▼
                          ┌─────────────────────────────────────┐
                          │  DealSense Node orchestrator        │
                          │  20-tool registry (registry.ts)     │
                          └─────────────────────────────────────┘
```

**Design choices:**

1. **Each agent is independently testable** — every specialist owns a clear
   tool subset, and every tool can be exercised with zero LLM involvement via
   `POST /api/tools/execute`. Two-level eval harness included (see Evals).
2. **API, not MCP, for internal tool calls** — tools execute as plain HTTP, so
   tool execution burns no tokens. MCP remains available at the edge
   (`orchestrator/src/routes/mcp.ts`) for external interoperability.
3. **Generated, not hand-written, network config** — `generate_network.py`
   builds `registries/dealsense.hocon` from the live tool registry, so the
   agent network can never drift from the backend.

## Setup (personal laptop)

Prereqs: Python 3.10+, Node 20+, and an LLM key — `OPENAI_API_KEY` (default
network model `gpt-4o`) or `GOOGLE_API_KEY` for Gemini (regenerate with
`DEALSENSE_LLM_MODEL=gemini-2.5-flash python3 generate_network.py`, and
`pip install langchain-google-genai`).

```bash
# 1. Backend tool layer
cd orchestrator && npm install && npm run dev          # serves :3001

# 2. Neuro SAN layer (new terminal)
cd neurosan
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export OPENAI_API_KEY=sk-...        # or: export GOOGLE_API_KEY=...
export PYTHONPATH=$(pwd)
export AGENT_MANIFEST_FILE=$(pwd)/registries/manifest.hocon
export AGENT_TOOL_PATH=$(pwd)/coded_tools
# optional, defaults shown:
# export DEALSENSE_API_URL=http://localhost:3001

python -m neuro_san.service.main_loop.server_main_loop   # serves :8080 (http) / :30011 (grpc)
```

Talk to it (third terminal, same env):

```bash
python -m neuro_san.client.agent_cli --http --agent dealsense
```

or raw HTTP:

```bash
curl -X POST localhost:8080/api/v1/dealsense/streaming_chat \
  -d '{"user_message": {"text": "Run a DCF on a $4.2M property with $290k NOI, 10 year hold"}}'
```

For the visual network UI, use [neuro-san-studio](https://github.com/cognizant-ai-lab/neuro-san-studio)
(`nsflow`) pointed at this manifest — great for the demo, it renders the agent
graph live as requests flow through it.

## Demo queries

- "Find NNN Walgreens properties in Florida and assess their risk" — scout → risk (multi-hop)
- "Run a DCF on a $4.2M property with $290k NOI and a 10 year hold" — financial_modeler
- "What do macro conditions mean for retail cap rates in Tampa?" — market_analyst
- "Source the top 3 medical office deals in Texas, score the risk, and draft an IC memo" — 4-agent chain ending in deal_writer

## Evals

The mentor guidance was right: evals are what gets a multi-agent system past QA.
Two levels here, mirroring "test each individually + test the orchestration":

**Level 1 — tool evals (no LLM, deterministic, fast).** Golden cases against
`POST /api/tools/execute`. Run with only the backend up:

```bash
python3 evals/run_tool_evals.py              # offline-safe cases
python3 evals/run_tool_evals.py --external   # also web-search / FRED-key cases
```

**Level 2 — agent evals (end-to-end).** Sends real queries through the front
man and asserts (a) the right specialists appeared in the chat stream
(routing) and (b) the answer contains what it must (quality). Run with both
servers up:

```bash
python3 evals/run_agent_evals.py
```

Add cases by editing `evals/tool_cases.json` / `evals/agent_cases.json`.
Neuro SAN also has its own data-driven HOCON test-case format if you want
deeper assertions later: see
[test_case_hocon_reference.md](https://github.com/cognizant-ai-lab/neuro-san/blob/main/docs/test_case_hocon_reference.md).

## Regenerating the network

When tools are added/changed in `orchestrator/src/tools/registry.ts`:

```bash
# with the backend running (pulls live schemas and refreshes tool_schemas.json):
python3 generate_network.py
```

Edit specialist groupings/instructions in `generate_network.py` (the
`SPECIALISTS` / `FRONT_MAN` constants), never in the generated hocon.

## Files

| Path | Purpose |
|---|---|
| `registries/manifest.hocon` | Networks served by neuro-san |
| `registries/dealsense.hocon` | Generated agent network (1 supervisor, 6 specialists, 20 coded tools) |
| `coded_tools/dealsense/orchestrator_api.py` | One generic CodedTool bridging all 20 tools over HTTP |
| `generate_network.py` | Regenerates the hocon from the live tool registry |
| `tool_schemas.json` | Snapshot of registry schemas (fallback when backend is down) |
| `evals/` | Two-level eval harness + golden cases |

## LLM config

The network defaults to `model_name: "gpt-4o"` (set in `generate_network.py`).
Neuro SAN also supports Anthropic (`claude-sonnet` alias + `ANTHROPIC_API_KEY`),
Azure OpenAI, Gemini, Bedrock and Ollama — see the
[hocon reference](https://github.com/cognizant-ai-lab/neuro-san/blob/main/docs/agent_hocon_reference.md)
`llm_config` section.
