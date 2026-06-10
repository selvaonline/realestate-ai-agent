# Orchestrators: Neuro SAN & LangGraph.js

The same agent team runs on two engines. Flip between them live with the ⚡
toggle — the parity eval guarantees they route identically.

## Side by side

| | Neuro SAN | LangGraph.js |
|---|---|---|
| Origin | Cognizant open source (Apache 2.0) | LangChain — industry standard |
| Definition | Declarative HOCON network (`dealsense.hocon`) | Code-first graph (`specialists.ts` + `supervisor.ts`) |
| Process model | Separate Python server (:8080) | **In-process** with Express — one deploy artifact |
| Tool transport | HTTP bridge → `/api/tools/execute` | Direct registry call (durations measured) |
| Delegation | AAOSA-style, LLM-decided | ReAct supervisor with mandatory routing map |
| Conversation memory | Per-request (chat_context available) | **Checkpointed** (`MemorySaver` + `thread_id`) |
| Model config | `llm_config` in HOCON | Tiered: supervisor pro / specialists flash |
| Endpoint | `POST /api/ns/run` | `POST /api/lg/run` |

## Why run both?

- **Framework alignment**: Neuro SAN is Cognizant's own framework — the
  recommended path, and the default mode for fresh sessions.
- **Production credibility**: LangGraph.js is the documented production path
  — biggest ecosystem, checkpointing/replay, observability story.
- **Architecture proof**: running both behind one contract *demonstrates*
  the orchestrator-as-swappable-layer claim instead of asserting it.

## Neuro SAN specifics

The network is **generated** from the live tool registry:

```bash
cd neurosan && python3 generate_network.py     # writes registries/dealsense.hocon
```

- Front man `deal_advisor` (no `function.parameters` → front man by convention)
- 6 specialist LLM agents, each with an `inquiry`/`context` interface
- 20 coded tools, all bridged through one Python class
  (`coded_tools/dealsense/orchestrator_api.py`) that POSTs to
  `/api/tools/execute`

Gotchas discovered (and handled) along the way:

- Neuro SAN's type lookup expects `int`/`float` — the generator normalizes
  JSON Schema's `number`/`integer`.
- Runtime objects (ProgressJournal, origin chains) are injected into coded
  tool args — the bridge forwards only JSON-serializable, non-null values.
- Gemini rejects array params with untyped `items` — registry schemas carry
  full item properties.

## LangGraph.js specifics

Supervisor = `createReactAgent` whose tools are the six specialists; each
specialist is itself a `createReactAgent` over its registry tools.

- **Memory**: `MemorySaver` checkpointer, threaded per browser session
  (`thread_id` from `sessionStorage`). Follow-ups resolve against prior turns.
- **Model tiering**: `LG_SUPERVISOR_MODEL` (default `gemini-2.5-pro`) and
  `LG_MODEL` (default `gemini-2.5-flash`).
- **Version note**: pinned `@langchain/langgraph@^0.4` for
  `@langchain/core` 0.3 compatibility with the existing codebase.
