# Before vs After: Perplexity Flow

## User Experience Comparison

### BEFORE: Traditional Agent Flow

```
┌──────────────────────────────────────┐
│  RealEstate Deal Agent               │
├──────────────────────────────────────┤
│                                      │
│  [Input: Find multifamily in Dallas] │
│  [Search Button]                     │
│                                      │
│  🔄 Running...                       │
│                                      │
│  ⚪ Setting up my desktop            │
│  ⚪ Waiting for search results       │
│  ⚪ Searching detail listings        │
│  ⚪ Navigating to loopnet.com        │
│  ⚪ Navigating to crexi.com          │
│  📸 [Screenshot]                     │
│  ✅ Extracted: {price: 2500000...}   │
│  ✅ Done                             │
│                                      │
│  --- DEALS ---                       │
│  [Deal Card with data]               │
└──────────────────────────────────────┘

❌ Problems:
- No context about what agent is thinking
- Technical status messages
- Unclear data provenance
- All-or-nothing display
- No progressive feedback
```

### AFTER: Perplexity-Style Flow

```
┌──────────────────────────────────────┐
│  RealEstate Deal Agent               │
├──────────────────────────────────────┤
│                                      │
│  [Input: Find multifamily in Dallas] │
│  [Search Button]                     │
│                                      │
│  🔍 Understanding your query...      │
│  🔍 Searching commercial real estate │
│     listings...                      │
│  🔍 Analyzing property listings...   │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Found a promising listing [1]: │ │
│  │ **Crexi Multifamily Property** │ │
│  │ located at 123 Main St, Dallas │ │
│  │ TX. The asking price is        │ │
│  │ $2,500,000. Net Operating      │ │
│  │ Income (NOI) is $200,000. The  │ │
│  │ cap rate is 8.00%. • • •       │ │
│  └────────────────────────────────┘ │
│                                      │
│  --- SOURCES ---                     │
│  [1] Crexi - Multifamily Property    │
│      Dallas, TX - 123 Main Street    │
│      crexi.com/property/...          │
│                                      │
│  [2] LoopNet - Commercial Listing    │
│      Investment opportunity in...    │
│      loopnet.com/Listing/...         │
│                                      │
│  ▸ View detailed timeline            │
│                                      │
│  --- DEALS ---                       │
│  [Deal Card with data]               │
└──────────────────────────────────────┘

✅ Benefits:
- Clear reasoning process
- User-friendly messages
- Transparent source attribution
- Progressive information reveal
- Professional presentation
```

## Code Comparison

### BEFORE: Direct Status Updates

```typescript
// agent.ts (Old)
emit(ctx, "status", { label: "Searching detail listings" });
const results = await webSearch.invoke(query);
emit(ctx, "status", { label: "Found detail candidates" });

// No source tracking
// No answer synthesis
// Jump directly to deals
```

### AFTER: Rich Event Stream

```typescript
// agent.ts (New)
emit(ctx, "thinking", { text: "Searching commercial real estate listings..." });

const results = await webSearch.invoke(query);

// Track and emit sources
for (const candidate of candidates.slice(0, 3)) {
  sourceId++;
  const source = { id: sourceId, ...candidate };
  sources.push(source);
  emit(ctx, "source_found", { source });
}

emit(ctx, "thinking", { text: "Analyzing property listings..." });

// Synthesize answer with citations
const citationNum = sourceIdx + 1;
emit(ctx, "answer_chunk", { text: `Found a promising listing [${citationNum}]: ` });
emit(ctx, "answer_chunk", { text: `**${title}** located at ${address}. ` });
emit(ctx, "answer_chunk", { text: `The asking price is $${price.toLocaleString()}. ` });
emit(ctx, "answer_complete", {});
```

## UI Component Comparison

### BEFORE: Simple Timeline

```html
<!-- Old UI -->
<div class="timeline">
  <div class="card" *ngFor="let c of cards()">
    <div *ngSwitchCase="'status'">
      <span class="chip">{{c.label}}</span>
    </div>
  </div>
</div>
```

### AFTER: Multi-Section Layout

```html
<!-- New UI -->
<div class="perplexity-section">
  <!-- Thinking Steps -->
  <div class="thinking-steps" *ngIf="!answerComplete()">
    <div class="thinking-item" *ngFor="let c of cards()">
      <ng-container *ngIf="c.kind === 'thinking'">
        <span class="thinking-icon">🔍</span>
        {{ c.label }}
      </ng-container>
    </div>
  </div>

  <!-- Streaming Answer -->
  <div class="answer-section" *ngIf="answer()">
    <div class="answer-text" [innerHTML]="answer()"></div>
    <div class="typing-indicator" *ngIf="!answerComplete()">
      <span></span><span></span><span></span>
    </div>
  </div>

  <!-- Sources List -->
  <div class="sources-section" *ngIf="sources().length && answerComplete()">
    <h3>Sources</h3>
    <div class="source-item" *ngFor="let src of sources()">
      <div class="source-num">[{{ src.id }}]</div>
      <div class="source-content">
        <a [href]="src.url">{{ src.title }}</a>
        <div class="source-snippet">{{ src.snippet }}</div>
      </div>
    </div>
  </div>
</div>

<!-- Collapsible detailed timeline -->
<details class="timeline-details">
  <summary>View detailed timeline</summary>
  <div class="timeline">...</div>
</details>
```

## State Management Comparison

### BEFORE: Simple Card List

```typescript
// Old state
export class App {
  cards = signal<Card[]>([]);
  deals = signal<any[]>([]);
  
  onEvent(ev: AgentEvent) {
    const push = (c: Card) => this.cards.update(arr => [...arr, c]);
    switch (ev.kind) {
      case 'status': push({ kind:'status', label: ev.label, t:ev.t }); break;
    }
  }
}
```

### AFTER: Rich State with Streaming

```typescript
// New state
export class App {
  cards = signal<Card[]>([]);
  deals = signal<any[]>([]);
  sources = signal<Source[]>([]);           // NEW
  answer = signal<string>('');               // NEW
  answerComplete = signal(false);            // NEW
  
  onEvent(ev: AgentEvent) {
    switch (ev.kind) {
      case 'thinking':
        push({ kind:'thinking', label: ev['text'], t:ev.t });
        break;
        
      case 'source_found':                   // NEW
        this.sources.update(arr => [...arr, ev['source']]);
        break;
        
      case 'answer_chunk':                   // NEW
        this.answer.update(curr => curr + ev['text']);
        break;
        
      case 'answer_complete':                // NEW
        this.answerComplete.set(true);
        break;
    }
  }
}
```

## Visual Design Comparison

### BEFORE: Technical Interface

```
Status Updates:
┌─────────────────────────┐
│ ⚪ Searching listings   │
│ ⚪ Opening URL          │
│ ⚪ Extracting data      │
│ 📸 Screenshot           │
│ ✅ Done                 │
└─────────────────────────┘

- Technical terminology
- No visual hierarchy
- Equal weight to all events
- No storytelling
```

### AFTER: Narrative Interface

```
Thinking Process:
  🔍 Understanding your query...
  🔍 Searching listings...
  
Answer (with animations):
┌─────────────────────────────┐
│ Found a listing [1]:        │
│ **Property Name**           │
│ The asking price is...      │
│ Cap rate is 8.00%. • • •    │
└─────────────────────────────┘

Sources:
  [1] Title → URL
      Snippet text
  [2] Title → URL
      Snippet text

- User-friendly language
- Clear visual hierarchy
- Progressive disclosure
- Engaging narrative
```

## Metrics Impact

### Before Perplexity Flow

| Metric | Value |
|--------|-------|
| User confusion | High - "What is it doing?" |
| Trust level | Medium - unclear sourcing |
| Engagement | Low - passive waiting |
| Perceived speed | Slow - feels like black box |
| Debug difficulty | Hard - sparse events |

### After Perplexity Flow

| Metric | Value |
|--------|-------|
| User confusion | Low - transparent process |
| Trust level | High - clear citations |
| Engagement | High - watching it think |
| Perceived speed | Fast - constant feedback |
| Debug difficulty | Easy - rich event log |

## Migration Path

For existing deployments:

1. ✅ **Backend events** - New events added (backward compatible)
2. ✅ **Frontend types** - Extended to include new events
3. ✅ **UI components** - New sections added, old timeline preserved
4. ✅ **Styling** - Enhanced with Perplexity theme
5. ⚠️ **No breaking changes** - Old events still work

## Summary

The Perplexity-style flow transforms the agent from a **black box** into a **glass box**, where users can see:

- **What** the agent is doing (thinking steps)
- **Where** information comes from (sources)
- **How** it synthesizes answers (streaming)
- **Why** it made decisions (transparent reasoning)

This creates a more trustworthy, engaging, and professional user experience.
