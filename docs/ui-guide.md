# UI Guide

Everything multi-agent is visible live in the existing DealSense Angular UI —
no separate console needed.

## Orchestrator toggle

The ⚡ pill in the header switches **Classic ↔ LangGraph.js** (teal glow =
LangGraph multi-agent mode). Persisted per browser; fresh sessions default
to LangGraph.js.

## Live agent network graph

Renders the full topology (supervisor → 6 specialists → 20 tools) and
animates in real time:

- **Amber pulse** = node currently active; **green** = visited
- **Animated dashed edges** trace the live delegation path
- **Orange badges** count invocations per node
- Header shows orchestrator badge, **hop counter**, and **elapsed timer**
- Legend names the judge-facing detail: *tool (zero-token API call)*

### ↻ Replay

After a run completes, **↻ Replay** re-animates the entire orchestration
from the recorded event log in seconds — no servers involved. Run the big
query before a demo, replay it live on stage.

## Specialist progress stepper

One step per specialist with live status (pending / spinning / ✓ done) and
**clickable tool chips** showing exactly which tools ran:

- `🔧 Search Properties ×2 · 6.3s` — count and duration
- The currently-executing chip pulses amber
- **Click any chip** → popup with the tool's description, category,
  parameter schema (from the live registry), call stats, and its execution
  path (`POST /api/tools/execute`, zero tokens)

Below the steps, a live activity line streams the latest finding verbatim.

## Answers with Specialist Reports

The final answer is a sectioned report (sourcing → risk → market → DCF →
recommendation). Beneath it, **🔎 Specialist Reports** — one expandable,
color-accented card per specialist with their complete unabridged finding.
Captured server-side, so the detail is guaranteed regardless of how the
supervisor summarizes.

## Conversation memory

Runs share a conversation thread per browser session. Follow-ups work:

1. *"Find NNN Walgreens deals in Florida and identify the best one"*
2. *"Now run a 10-year DCF on that property"* — remembers the exact address,
   skips searching, goes straight to the Financial Modeler.

## Search history

Your last 10 prompts appear as one-click pills on the home screen
(persisted). Pre-run your demo queries; they'll be waiting as pills.

## Suggested demo script

1. Home screen → point at history pills and the ⚡ multi-agent default.
2. Run the 6-part mega-query → narrate the graph lighting up, chips
   accumulating, activity line streaming.
3. While it synthesizes → open a tool chip popup (*"zero tokens — this is an
   API call, not an LLM call"*).
4. Answer lands → expand a Specialist Report.
5. Ask the follow-up (*"now check portfolio fit"*) → conversation memory.
6. **↻ Replay** the first run → close on the eval story
   ([Evals](evals.md#the-defect-the-evals-caught)).
