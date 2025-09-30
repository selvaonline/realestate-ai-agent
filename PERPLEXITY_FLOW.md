# Perplexity-Style Agent Flow

This document describes the Perplexity-inspired flow implemented in the RealEstate Deal Agent.

## 🎯 Overview

The agent now provides a transparent, step-by-step experience similar to Perplexity AI, showing users:
1. **What it's thinking** - Real-time reasoning steps
2. **What sources it finds** - Numbered citations [1], [2], [3]
3. **How it synthesizes answers** - Streaming text with inline citations
4. **Where information comes from** - Clean source list with links

## 🔄 Event Flow

### 1. Thinking Events
```typescript
{ kind: "thinking", runId: string, text: string, t: number }
```
**Examples:**
- "Understanding your query..."
- "Searching commercial real estate listings..."
- "Expanding search criteria..."
- "Analyzing property listings..."

### 2. Source Found Events
```typescript
{ 
  kind: "source_found", 
  runId: string, 
  source: { 
    id: number,           // Sequential: 1, 2, 3...
    title: string,        // Page title
    url: string,          // Full URL
    snippet: string       // Search result snippet
  }, 
  t: number 
}
```

### 3. Answer Streaming Events
```typescript
{ kind: "answer_chunk", runId: string, text: string, t: number }
```
**Example sequence:**
```
"Found a promising listing [1]: "
"**Crexi Multifamily Property** located at 123 Main St, Dallas, TX. "
"The asking price is $2,500,000. "
"Net Operating Income (NOI) is $200,000. "
"The cap rate is 8.00%. "
"DSCR is 1.45. "
```

### 4. Answer Complete Event
```typescript
{ kind: "answer_complete", runId: string, t: number }
```

## 🎨 UI Components

### Thinking Steps Section
- Shows active reasoning with 🔍 icon
- Displays sequentially as agent works
- Auto-hides when answer is complete

### Answer Section
- Streams text progressively
- Shows typing indicator (3 animated dots) while generating
- Supports HTML/markdown formatting
- Inline citations link to sources

### Sources Section
- Appears after answer is complete
- Numbered list matching citations [1], [2], [3]
- Each source shows:
  - Citation number
  - Clickable title
  - Domain/URL
  - Search snippet

### Timeline Details (Collapsible)
- Hidden by default for clean UX
- Power users can expand to see:
  - All events in chronological order
  - Screenshots
  - Navigation steps
  - Raw extraction data

## 🏗️ Architecture

### Backend (agent.ts)
```typescript
// 1. Emit thinking
emit(ctx, "thinking", { text: "Understanding your query..." });

// 2. Search and emit sources
for (const candidate of candidates.slice(0, 3)) {
  sourceId++;
  const source = { id: sourceId, ...candidate };
  sources.push(source);
  emit(ctx, "source_found", { source });
}

// 3. Extract and stream answer
emit(ctx, "answer_chunk", { text: `Found a promising listing [${citationNum}]: ` });
emit(ctx, "answer_chunk", { text: `**${title}** located at ${address}. ` });
emit(ctx, "answer_chunk", { text: `The asking price is $${price.toLocaleString()}. ` });

// 4. Complete
emit(ctx, "answer_complete", {});
```

### Frontend (app.ts)
```typescript
// State management
sources = signal<Source[]>([]);
answer = signal<string>('');
answerComplete = signal(false);

// Event handling
case 'thinking':
  push({ kind:'thinking', label: ev['text'], t:ev.t });
  break;
  
case 'source_found':
  this.sources.update(arr => [...arr, ev['source']]);
  break;
  
case 'answer_chunk':
  this.answer.update(curr => curr + ev['text']);
  break;
  
case 'answer_complete':
  this.answerComplete.set(true);
  break;
```

## 🎭 User Experience

### Progressive Disclosure
```
Phase 1: Thinking
  🔍 Understanding your query...
  🔍 Searching commercial real estate listings...
  
Phase 2: Sources Appear
  [1] Crexi - Multifamily Property - Dallas
  [2] LoopNet - Commercial Listing
  [3] Broker Site - Investment Opportunity
  
Phase 3: Answer Streams
  Found a promising listing [1]: **Crexi Multifamily Property**...
  [typing indicator: • • •]
  
Phase 4: Complete
  Full answer displayed
  Sources section expands with details
```

## 🎨 Design Tokens

### Colors
- Background: `#0b0f14`
- Card background: `#0f131a`
- Border: `#1d2735`
- Primary text: `#e9eef5`
- Secondary text: `#9fb0c0`
- Links: `#7ba3e8`
- Accent: `#2f5cff`

### Typography
- Body: 15px, line-height 1.7
- Thinking: 14px, secondary color
- Sources: 13-14px with hierarchy

### Animations
- Typing indicator: 3 dots bouncing, 1.4s cycle
- Smooth transitions on all state changes

## 🚀 Benefits

1. **Transparency** - Users see the agent's reasoning process
2. **Trust** - Clear source attribution builds confidence
3. **Engagement** - Streaming keeps users engaged
4. **Education** - Users learn how the agent thinks
5. **Debugging** - Developers can trace issues easily

## 📝 Future Enhancements

- [ ] Multiple property results with citations
- [ ] Follow-up questions based on answer
- [ ] Source quality indicators
- [ ] Comparative analysis across sources
- [ ] Related searches suggestion
- [ ] Export answer with sources
- [ ] Share functionality
