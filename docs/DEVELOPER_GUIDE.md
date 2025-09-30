# Developer Guide: Perplexity-Style Flow

## Quick Start

### Running the Application

```bash
# Terminal 1: Backend (Orchestrator)
cd orchestrator
npm install
npm run dev

# Terminal 2: Frontend (UI)
cd deal-agent-ui
npm install
ng serve

# Access at http://localhost:4200
```

### Environment Variables

```bash
# orchestrator/.env
OPENAI_API_KEY=sk-...
SERPER_API_KEY=...
OPENAI_MODEL=gpt-4o-mini

# Optional browser debugging
BROWSER_HEADED=false
BROWSER_ENGINE=chromium  # or webkit
BROWSER_DEVTOOLS=false
```

## Adding New Event Types

### 1. Define Event Type

**File:** `orchestrator/src/lib/agent-events.ts`

```typescript
export type AgentEvent =
  | { kind: "your_new_event"; runId: string; yourData: string; t: number }
  | ... // existing events
```

### 2. Emit Event in Agent

**File:** `orchestrator/src/agent.ts`

```typescript
// Emit your event
emit(ctx, "your_new_event", { yourData: "some value" });
```

### 3. Update Frontend Types

**File:** `deal-agent-ui/src/app/agent.service.ts`

```typescript
export type AgentEvent =
  | { kind: '...'|'your_new_event'; runId: string; t: number; [k: string]: any };
```

### 4. Handle in UI

**File:** `deal-agent-ui/src/app/app.ts`

```typescript
onEvent(ev: AgentEvent) {
  switch (ev.kind) {
    case 'your_new_event':
      // Update UI state
      this.yourSignal.set(ev['yourData']);
      break;
    // ... other cases
  }
}
```

### 5. Add UI Template

```html
<div *ngIf="yourSignal()">
  {{ yourSignal() }}
</div>
```

## Customizing the Flow

### Change Thinking Messages

**File:** `orchestrator/src/agent.ts`

```typescript
// Customize these messages
emit(ctx, "thinking", { text: "Your custom thinking message..." });
```

### Modify Answer Synthesis

```typescript
// In the extraction loop
emit(ctx, "answer_chunk", { text: `Your custom answer format: ${data}` });
```

### Style the UI

**File:** `deal-agent-ui/src/app/app.ts` (styles section)

```typescript
styles: [`
  .answer-section {
    background: #your-color;
    border: 1px solid #your-border;
    // ... your styles
  }
`]
```

## Common Patterns

### Pattern 1: Progressive Data Loading

```typescript
// Backend
for (const item of items) {
  emit(ctx, "item_found", { item });
  // Process item...
  emit(ctx, "item_processed", { result });
}

// Frontend
case 'item_found':
  this.items.update(arr => [...arr, ev['item']]);
  break;
```

### Pattern 2: Multi-Stage Processing

```typescript
// Stage 1: Search
emit(ctx, "thinking", { text: "Stage 1: Searching..." });
const results = await search();

// Stage 2: Filter
emit(ctx, "thinking", { text: "Stage 2: Filtering..." });
const filtered = filter(results);

// Stage 3: Extract
emit(ctx, "thinking", { text: "Stage 3: Extracting..." });
const extracted = await extract(filtered);
```

### Pattern 3: Error Handling with User Feedback

```typescript
try {
  emit(ctx, "thinking", { text: "Attempting operation..." });
  await riskyOperation();
  emit(ctx, "thinking", { text: "Success!" });
} catch (e) {
  emit(ctx, "thinking", { text: "Failed, trying alternative..." });
  await fallbackOperation();
}
```

## Testing

### Test Event Emission

```typescript
// Create mock context
const events: any[] = [];
const mockCtx = {
  runId: 'test-123',
  pub: (kind: string, payload: any) => {
    events.push({ kind, ...payload });
  }
};

// Run agent
await runAgent("test query", mockCtx);

// Assert events
expect(events).toContainEqual(
  expect.objectContaining({ kind: 'thinking' })
);
```

### Test UI Event Handling

```typescript
// In your Angular test
const component = fixture.componentInstance;
component.onEvent({ 
  kind: 'thinking', 
  runId: 'test', 
  text: 'Test message',
  t: Date.now() 
});

expect(component.cards()).toContainEqual(
  expect.objectContaining({ kind: 'thinking', label: 'Test message' })
);
```

## Debugging Tips

### 1. Enable Browser Headed Mode

```bash
# .env
BROWSER_HEADED=true
BROWSER_DEVTOOLS=true
```

### 2. Log All Events

```typescript
// In server index.ts
function pub(runId: string, ev: any) {
  console.log('[EVENT]', ev.kind, ev); // Add this
  channel.get(runId)?.forEach((fn) => {
    try { fn(ev); } catch { /* ignore */ }
  });
}
```

### 3. Frontend Event Logging

```typescript
onEvent(ev: AgentEvent) {
  console.log('[UI EVENT]', ev); // Add this
  // ... rest of handler
}
```

### 4. Network Inspector

- Open DevTools → Network tab
- Filter by "events"
- Watch SSE stream in real-time

### 5. View Timeline Details

- Click "View detailed timeline" in UI
- Inspect all events chronologically
- Check for missing or malformed events

## Performance Optimization

### 1. Throttle Answer Chunks

```typescript
// Instead of emitting every small chunk
let buffer = '';
let lastEmit = Date.now();

function emitChunk(text: string) {
  buffer += text;
  if (Date.now() - lastEmit > 100) { // Throttle to 10 Hz
    emit(ctx, "answer_chunk", { text: buffer });
    buffer = '';
    lastEmit = Date.now();
  }
}

// Flush remaining
if (buffer) emit(ctx, "answer_chunk", { text: buffer });
```

### 2. Limit Source Count

```typescript
// Only emit first N sources
const MAX_SOURCES = 5;
for (const candidate of candidates.slice(0, MAX_SOURCES)) {
  // ...
}
```

### 3. Debounce UI Updates

```typescript
// Use RxJS for debouncing
import { debounceTime } from 'rxjs';

this.answerSubject
  .pipe(debounceTime(50))
  .subscribe(text => this.answer.set(text));
```

## Architecture Decisions

### Why SSE Instead of WebSockets?

- Simpler server implementation
- One-way communication sufficient
- Better with HTTP/2
- Easier to debug with curl/browser

### Why Signal-Based State?

- Angular 16+ best practice
- Automatic change detection
- Better performance than observables for this use case
- Cleaner syntax

### Why Inline Citations?

- Perplexity pattern proven effective
- Users understand [1], [2] notation
- Easy to implement and maintain
- Works with streaming text

## Troubleshooting

### Events Not Appearing in UI

1. Check SSE connection in Network tab
2. Verify `onEvent()` switch has your event type
3. Ensure event has correct `kind` property
4. Check console for errors

### Thinking Steps Not Showing

1. Verify `answerComplete()` is false
2. Check `*ngIf="!answerComplete()"` condition
3. Ensure cards include thinking events

### Sources Not Displaying

1. Check `sources()` signal has data
2. Verify `answerComplete()` is true
3. Inspect source format matches type

### Answer Not Streaming

1. Confirm `answer_chunk` events emitted
2. Check `.answer.update()` is called
3. Verify HTML binding `[innerHTML]="answer()"`

## Best Practices

✅ **DO:**
- Emit thinking steps at key decision points
- Use descriptive, user-friendly messages
- Deduplicate sources before emitting
- Stream answer in logical chunks (sentences)
- Handle errors gracefully with fallbacks

❌ **DON'T:**
- Emit too many events (causes UI lag)
- Use technical jargon in thinking messages
- Forget to call `answer_complete`
- Hardcode assumptions about data structure
- Ignore error states

## Further Reading

- [Perplexity Flow Documentation](../PERPLEXITY_FLOW.md)
- [Flow Diagrams](./FLOW_DIAGRAM.md)
- [LangChain Docs](https://js.langchain.com/)
- [Angular Signals](https://angular.io/guide/signals)
