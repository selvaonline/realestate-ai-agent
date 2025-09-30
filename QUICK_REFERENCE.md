# 🚀 Quick Reference: Perplexity Flow

## Event Types Cheat Sheet

| Event | Purpose | Data | UI Effect |
|-------|---------|------|-----------|
| `thinking` | Show reasoning | `{text: string}` | 🔍 Thinking step appears |
| `source_found` | Track source | `{source: {id, title, url, snippet}}` | Source added to list |
| `answer_chunk` | Stream text | `{text: string}` | Text appends to answer |
| `answer_complete` | Done streaming | `{}` | Show sources, hide typing |
| `run_started` | Run begins | `{query: string}` | Show initial state |
| `run_finished` | Run ends | `{ok: boolean}` | Enable new search |

## Emit Pattern

```typescript
// 1. Thinking
emit(ctx, "thinking", { text: "Your message..." });

// 2. Sources
emit(ctx, "source_found", { 
  source: { id: 1, title: "...", url: "...", snippet: "..." } 
});

// 3. Answer
emit(ctx, "answer_chunk", { text: "Part of answer" });
emit(ctx, "answer_complete", {});
```

## UI State Signals

```typescript
sources = signal<Source[]>([]);      // Source list
answer = signal<string>('');          // Streaming text
answerComplete = signal(false);       // Synthesis done
cards = signal<Card[]>([]);          // Event timeline
deals = signal<any[]>([]);           // Final results
```

## Component Structure

```
<perplexity-section>
  <thinking-steps>       ← Shows while !answerComplete
    🔍 Thinking text
  </thinking-steps>
  
  <answer-section>       ← Shows when answer exists
    Streaming text
    • • • (typing)       ← Shows while !answerComplete
  </answer-section>
  
  <sources-section>      ← Shows when answerComplete
    [1] Source title → URL
        Snippet text
  </sources-section>
</perplexity-section>

<timeline-details>       ← Collapsible
  All events
</timeline-details>

<deals-section>          ← Shows final results
  Deal cards
</deals-section>
```

## Color Palette

```css
Background:    #0b0f14
Card BG:       #0f131a
Border:        #1d2735
Primary Text:  #e9eef5
Secondary:     #9fb0c0
Links:         #7ba3e8
Accent:        #2f5cff
Icon:          #5b7a9f
```

## Animations

```css
/* Typing Indicator */
.typing-indicator span {
  animation: typing 1.4s infinite;
}
@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-4px); }
}
```

## Common Patterns

### Pattern 1: Multi-Stage Process
```typescript
emit(ctx, "thinking", { text: "Stage 1: Searching..." });
const results = await search();

emit(ctx, "thinking", { text: "Stage 2: Filtering..." });
const filtered = filter(results);

emit(ctx, "thinking", { text: "Stage 3: Analyzing..." });
const analyzed = analyze(filtered);
```

### Pattern 2: Source Collection
```typescript
const sources: Source[] = [];
let sourceId = 0;

for (const result of results) {
  if (!sources.find(s => s.url === result.url)) {
    sourceId++;
    const source = { id: sourceId, ...result };
    sources.push(source);
    emit(ctx, "source_found", { source });
  }
}
```

### Pattern 3: Answer Streaming
```typescript
const sourceNum = findSourceIndex(url);

emit(ctx, "answer_chunk", { text: `Found listing [${sourceNum}]: ` });
emit(ctx, "answer_chunk", { text: `**${title}** at ${address}. ` });
emit(ctx, "answer_chunk", { text: `Price: $${price.toLocaleString()}. ` });
emit(ctx, "answer_complete", {});
```

## Debugging Commands

```bash
# Backend logs
cd orchestrator && npm run dev

# Frontend logs
cd deal-agent-ui && ng serve

# Browser console
# Check for SSE connection
# Filter by "events" in Network tab

# Headed browser mode
BROWSER_HEADED=true npm run dev
```

## File Locations

```
Backend Events:
  orchestrator/src/lib/agent-events.ts

Agent Logic:
  orchestrator/src/agent.ts

UI Component:
  deal-agent-ui/src/app/app.ts

Service:
  deal-agent-ui/src/app/agent.service.ts
```

## Event Flow Timeline

```
T+0   run_started        "Starting..."
T+1   thinking          🔍 "Understanding..."
T+2   thinking          🔍 "Searching..."
T+3   source_found      Add to sources[0]
T+4   source_found      Add to sources[1]
T+5   thinking          🔍 "Analyzing..."
T+6   answer_chunk      "Found listing..."
T+7   answer_chunk      "Price is..."
T+8   answer_complete   Show sources
T+9   run_finished      Enable search
```

## Testing Queries

```
Simple:
"Find multifamily deals in Dallas"

Specific:
"Find multifamily deals in Dallas with cap rate > 6%"

Direct URL:
"https://www.crexi.com/properties/2164390/texas-7-eleven"

Complex:
"Find Class A office buildings in downtown Austin under $50M"
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| No thinking steps | `answerComplete()` is true | Check event order |
| Sources not showing | Missing `answerComplete` event | Emit after streaming |
| Typing stuck | `answer_complete` not emitted | Add after last chunk |
| Timeline empty | Events not handled | Check switch cases |

## Performance Tips

```typescript
// ✅ Good: Batch sources
for (const src of sources.slice(0, 5)) { ... }

// ✅ Good: Throttle chunks
if (Date.now() - lastEmit > 100) { emit(...) }

// ❌ Bad: Emit every character
for (const char of text) { emit(...) }

// ❌ Bad: Too many sources
for (const src of allSources) { emit(...) }
```

## Keyboard Shortcuts

```
F12          Open DevTools
Cmd+Shift+C  Inspect element
Cmd+R        Refresh page
Cmd+Shift+R  Hard refresh
```

---

**💡 Pro Tip**: Keep this reference open while developing!
