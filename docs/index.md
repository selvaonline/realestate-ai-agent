# DealSense Multi-Agent

**A supervisor-orchestrated multi-agent system for commercial real estate private equity analysis** — one team of six specialist agents over twenty deterministic tools, defined as a swappable domain pack on a generic agent platform.

<div class="grid cards" markdown>

-   :material-account-supervisor:{ .lg .middle } **One supervisor, six specialists**

    ---

    A `deal_advisor` front man decomposes every request and delegates to
    Property Scout, Risk Analyst, Market Analyst, Financial Modeler,
    Portfolio Manager, and Deal Writer — each independently testable.

-   :material-swap-horizontal:{ .lg .middle } **Platform + domain pack**

    ---

    The orchestration core is domain-agnostic; the CRE team (tools, prompts,
    specialists) ships as a **domain pack** loaded at bootstrap. New vertical
    = new pack, zero core changes.

-   :material-flash:{ .lg .middle } **Zero-token tool calls**

    ---

    Tools execute as plain API calls (`POST /api/tools/execute`), not LLM
    round-trips. PE scoring, DCF math, tenant credit — deterministic and free.

-   :material-check-decagram:{ .lg .middle } **Judge-grade evals**

    ---

    Behavioral judge evals assert routing, faithfulness, completeness,
    honesty, and resilience against the live SSE event stream — the same
    contract the UI consumes.

</div>

## Why this architecture

Multi-agent systems usually demo well and die in QA. This project is built
around the two properties that change that:

1. **Every unit is testable in isolation.** Each tool is a pure API call you
   can golden-test with no LLM. Each specialist has a fixed tool subset and
   system prompt. The supervisor's routing is asserted by evals, not vibes.
2. **The orchestrator is a commodity.** The real IP — the tool registry, PE
   scoring model, and UI — lives behind an Express front door. The LangGraph.js
   supervisor plugs into an SSE event contract; any engine that emits the same
   events can replace it without touching the UI or the tools.

```mermaid
flowchart LR
    UI[Angular UI] --> EX[Express :3001]
    EX -->|/api/lg/run| LG[LangGraph.js<br/>in-process supervisor]
    LG -->|direct call| T[20-tool registry<br/>from the domain pack]
```

## Where to next

<div class="grid cards" markdown>

-   **[Getting Started](getting-started.md)** — run the full stack on your laptop in ~10 minutes.
-   **[Architecture](architecture.md)** — the layered design, event contract, and design decisions.
-   **[Orchestrator](orchestrators.md)** — the LangGraph.js supervisor and the swappable-engine contract.
-   **[Agents & Tools](reference/agents-and-tools.md)** — every specialist and all 20 tools, generated from the live registry.
-   **[Evals](evals.md)** — the three-tier eval pyramid, and the defect the evals caught.
-   **[UI Guide](ui-guide.md)** — the live agent network graph, replay, conversation memory, and more.

</div>
