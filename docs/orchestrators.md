# Orchestrator: LangGraph.js

The multi-agent team runs on a LangGraph.js supervisor, **in-process** with
Express — one runtime, one deploy artifact. The team itself (supervisor
prompt, specialists, tool subsets) is defined by the active domain pack
(`orchestrator/src/packs/cre/specialists.ts`), so the orchestrator stays
domain-agnostic.

## Architecture

| | LangGraph.js |
|---|---|
| Definition | Domain pack data (`packs/cre/specialists.ts`) consumed by `supervisor.ts` |
| Process model | **In-process** with Express — no second runtime |
| Tool transport | Direct registry call (durations measured) |
| Delegation | ReAct supervisor with mandatory routing map |
| Conversation memory | **Checkpointed** (`MemorySaver` + `thread_id`) |
| Model config | Tiered: supervisor pro / specialists flash |
| Endpoint | `POST /api/lg/run` |

## How it works

Supervisor = `createReactAgent` whose tools are the six specialists; each
specialist is itself a `createReactAgent` over its registry tool subset.

- **Memory**: `MemorySaver` checkpointer, threaded per browser session
  (`thread_id` from `sessionStorage`). Follow-ups resolve against prior turns.
- **Model tiering**: `LG_SUPERVISOR_MODEL` (default `gemini-2.5-pro`) and
  `LG_MODEL` (default `gemini-2.5-flash`).
- **Live events**: every delegation and tool call streams over the run's SSE
  channel (`ns_hop`, `tool_executing`, `agent_step`), driving the UI's
  network panel and reasoning trace.
- **Version note**: pinned `@langchain/langgraph@^0.4` for
  `@langchain/core` 0.3 compatibility with the existing codebase.

## Swappable by design

The orchestrator consumes only two contracts:

1. The **tool registry** (`platform/registry.ts`) — tools register at
   bootstrap from the domain pack and execute as zero-token API calls.
2. The **SSE event vocabulary** — any engine that emits the same events
   drives the same UI.

A different engine (or a remote agent runtime) can be mounted behind the
same `/api/<orch>/run` + `/api/<orch>/network` contract without touching
the UI or the tools.
