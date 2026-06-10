# API Reference

All endpoints served by the Express front door (`:3001`). The UI, the evals,
and any external client use the same surface.

## Orchestrated runs

### `POST /api/ns/run` · `POST /api/lg/run`

Start a multi-agent run (Neuro SAN / LangGraph.js).

```json
{ "query": "Find NNN Walgreens deals in Florida...", "threadId": "optional-lg-only" }
```

Returns immediately:

```json
{ "runId": "a1b2c3...", "threadId": "a1b2c3..." }
```

`threadId` (LangGraph only) keys conversation memory — reuse it across runs
for follow-up queries.

### `GET /events/:runId` (SSE)

The live event stream. Key kinds: `run_started`, `ns_hop`, `thinking`,
`tool_executing`, `tool_complete`, `agent_step`, `answer_chunk`,
`answer_complete`, `agent_done`, `run_finished`. See
[Architecture → event contract](../architecture.md#the-event-contract).

### `GET /api/ns/network` · `GET /api/lg/network`

Agent graph topology for visualization:

```json
{ "nodes": [{ "id": "deal_advisor", "type": "front_man" },
            { "id": "risk_analyst", "type": "specialist", "parent": "deal_advisor" },
            { "id": "assess_risk", "type": "tool", "parent": "risk_analyst" }],
  "edges": [{ "from": "deal_advisor", "to": "risk_analyst" }] }
```

### `GET /api/ns/health` · `GET /api/lg/health`

`{"ok": true|false}` — Neuro SAN checks the :8080 server; LangGraph checks
an LLM key is configured.

## Tool layer

### `GET /api/tools/registry`

All 20 tools with descriptions, categories, JSON-Schema parameters, and
estimated durations. Powers the UI's tool popups and the docs'
[tool reference](agents-and-tools.md).

### `POST /api/tools/execute`

Run any single tool directly — **no LLM involved**. This is the zero-token
execution path both orchestrators ride.

```json
{ "tool": "run_dcf", "args": { "purchasePrice": 4200000, "noi": 290000, "holdYears": 10 } }
```

```json
{ "ok": true, "tool": "run_dcf",
  "result": { "irr": "12.5%", "equityMultiple": "2.61x", "cashOnCash": "7.1%", "...": "..." } }
```

## Classic single-agent path (unchanged)

`POST /run`, `GET /result/:runId`, `POST /run_sync`, plus `/chat*` routes and
`/mcp` for external MCP interoperability.
