# 🚀 DealSense Chat - Advanced Features

## Overview

This document covers the advanced chatbot features that enhance the user experience with multi-turn memory, UI drill-in actions, and voice input.

---

## 🧠 Feature 1: Multi-Turn Memory

### What It Does
- Maintains conversation history across multiple messages
- Remembers previous searches and can compare results
- Stores context (portfolio data, search results) per session
- Automatically trims old messages to keep memory efficient

### Backend Implementation

#### Session Store (`orchestrator/src/chat/sessionStore.ts`)
```typescript
// Get or create session with history
const session = getSession(sessionId, maxTurns = 16);

// Append messages
appendToSession(sessionId, { role: "user", content: "..." });
appendToSession(sessionId, { role: "assistant", content: "..." });

// Update context
updateSessionContext(sessionId, { lastSearch: {...} });
```

#### Enhanced Chat Route (`orchestrator/src/routes/chatEnhanced.ts`)
- **Endpoint**: `POST /chat/enhanced`
- **Features**:
  - Session-based conversation history
  - Context persistence
  - Automatic history trimming
  - Session statistics

### Usage Examples

#### Example 1: Compare Searches
```
User: "Find medical office buildings in Dallas"
Bot: [Returns 10 results]

User: "Now search for the same in Houston"
Bot: [Returns 10 results]

User: "Which city has better opportunities?"
Bot: "Based on our searches, Dallas has 3 premium deals vs Houston's 2..."
```

#### Example 2: Follow-Up Questions
```
User: "Show me retail properties in Texas"
Bot: [Returns results]

User: "What's the average PE score?"
Bot: "The average PE score across the 8 Texas retail properties is 72..."

User: "Which one has the lowest risk?"
Bot: "Deal #3 (7-Eleven in Austin) has the lowest risk score of 42..."
```

### Session Management

#### Create/Resume Session
```typescript
// Frontend sends sessionId (or omit for new session)
const response = await fetch('/chat/enhanced', {
  method: 'POST',
  body: JSON.stringify({
    sessionId: 'user-123',  // Optional
    user: 'Find MOB in Dallas',
    context: { scored: [...], portfolioData: {...} }
  })
});
```

#### Clear Session History
```typescript
await fetch(`/chat/session/${sessionId}`, { method: 'DELETE' });
```

---

## 🎯 Feature 2: UI Drill-In Actions

### What It Does
- Chatbot can trigger UI actions directly
- Opens cards, renders charts, exports memos
- Filters and compares deals
- Scrolls to specific properties

### Available UI Actions

#### 1. **Open Card** (`ui_open_card`)
Opens a property detail card

**Triggers**:
- "Show me deal #2"
- "Open the Walgreens property"
- "Let me see the top deal"

**Parameters**:
```typescript
{
  id?: number,      // 1-based rank
  url?: string      // Direct URL
}
```

#### 2. **Render Charts** (`ui_render_charts`)
Displays factor or portfolio charts

**Triggers**:
- "Show me the charts"
- "Visualize the portfolio"
- "Display factor breakdown for deal #1"

**Parameters**:
```typescript
{
  scope: 'deal' | 'portfolio',
  id?: number  // Required if scope is 'deal'
}
```

#### 3. **Export Memo** (`ui_export_memo`)
Exports IC memo for a deal

**Triggers**:
- "Create a memo for deal #1"
- "Export the top property"
- "Generate IC memo as PDF"

**Parameters**:
```typescript
{
  id?: number,
  url?: string,
  format: 'txt' | 'docx' | 'pdf'
}
```

#### 4. **Scroll to Deal** (`ui_scroll_to_deal`)
Scrolls viewport to a specific deal

**Triggers**:
- "Go to deal #3"
- "Show me the second property"

**Parameters**:
```typescript
{
  id: number  // 1-based rank
}
```

#### 5. **Filter Deals** (`ui_filter_deals`)
Applies filters to deal list

**Triggers**:
- "Show only premium deals"
- "Filter by Texas"
- "Show deals with PE > 80"

**Parameters**:
```typescript
{
  tier?: 'Premium' | 'Investment Grade' | 'Below Threshold',
  location?: string,
  minPE?: number,
  maxRisk?: number
}
```

#### 6. **Compare Deals** (`ui_compare_deals`)
Opens side-by-side comparison

**Triggers**:
- "Compare deal #1 and #3"
- "Show me a comparison of the top 3"

**Parameters**:
```typescript
{
  ids: number[]  // Array of 1-based ranks
}
```

### Backend Implementation

#### UI Events SSE (`orchestrator/src/routes/uiEvents.ts`)
```typescript
// Server-Sent Events endpoint
GET /ui/events

// Emit events from chat handler
emitUI('open-card', { id: 2 });
emitUI('render-charts', { scope: 'portfolio' });
```

#### Tool Definitions (`orchestrator/src/chat/tools.ts`)
```typescript
// UI action tools for OpenAI function calling
export const uiActionTools = [
  { name: "ui_open_card", ... },
  { name: "ui_render_charts", ... },
  // ... more tools
];
```

### Frontend Implementation

#### UI Actions Listener (`deal-agent-ui/src/app/chat-ui-actions.component.ts`)
```typescript
<app-chat-ui-actions
  (openCard)="handleOpenCard($event)"
  (renderCharts)="handleRenderCharts($event)"
  (exportMemo)="handleExportMemo($event)"
  (scrollToDeal)="handleScrollToDeal($event)"
  (filterDeals)="handleFilterDeals($event)"
  (compareDeals)="handleCompareDeals($event)">
</app-chat-ui-actions>
```

#### Event Handlers
```typescript
handleOpenCard(data: { id?: number; url?: string }) {
  // Find and open the deal card
  const deal = this.deals()[data.id - 1]; // Convert to 0-based
  this.selectedDeal.set(deal);
  this.showModal.set(true);
}

handleRenderCharts(data: { scope: string; id?: number }) {
  if (data.scope === 'portfolio') {
    this.showPortfolioCharts.set(true);
  } else {
    const deal = this.deals()[data.id - 1];
    this.showDealCharts.set(deal);
  }
}
```

---

## 🎙️ Feature 3: Voice Input

### What It Does
- Converts speech to text using Web Speech API
- Hands-free query input
- Real-time transcription
- Visual recording indicator

### Browser Support
- ✅ Chrome/Edge (webkitSpeechRecognition)
- ✅ Safari (SpeechRecognition)
- ❌ Firefox (not yet supported)

### Frontend Implementation

#### Voice Input Component (`deal-agent-ui/src/app/voice-input.component.ts`)
```typescript
<app-voice-input (result)="onVoiceResult($event)"></app-voice-input>
```

#### Integration in Chat Panel
```typescript
onVoiceResult(text: string) {
  this.inputText = text;
  // Optionally auto-send
  // this.sendMessage();
}
```

### Features
- **Recording Indicator**: Red pulsing button while listening
- **Auto-Stop**: Stops after speech ends
- **Error Handling**: Handles permission denials, no speech, etc.
- **Fallback**: Hides button if not supported

### Usage
1. Click the 🎙️ Voice button
2. Speak your query clearly
3. Text appears in input field
4. Edit if needed, then send

---

## 🔄 Complete User Flow Examples

### Example 1: Voice → Search → Drill-In
```
1. User clicks 🎙️ Voice button
2. User says: "Find medical office buildings in Dallas"
3. Text appears in chat input
4. User clicks Send
5. Bot searches and returns 10 results
6. User types: "Show me deal #2"
7. Bot calls ui_open_card
8. UI opens detail card for deal #2
```

### Example 2: Multi-Turn with Memory
```
1. User: "Find retail in Texas"
2. Bot: [Returns 8 results]
3. User: "What's the average cap rate?"
4. Bot: "7.2% across the 8 properties"
5. User: "Now search Florida"
6. Bot: [Returns 10 results]
7. User: "Which state is better?"
8. Bot: "Texas has higher average PE (74 vs 68) but Florida has lower risk..."
```

### Example 3: Complex Workflow
```
1. User: "Find MOB with hospital affiliation"
2. Bot: [Returns results]
3. User: "Show only premium deals"
4. Bot: Calls ui_filter_deals with tier='Premium'
5. UI filters list to 3 premium deals
6. User: "Compare the top 2"
7. Bot: Calls ui_compare_deals with ids=[1,2]
8. UI opens comparison view
9. User: "Create a memo for the first one"
10. Bot: Calls ui_export_memo with id=1
11. UI downloads IC memo
```

---

## 🛠️ Setup Instructions

### Backend Setup

1. **Install Dependencies** (already done)
   ```bash
   cd orchestrator
   npm install
   ```

2. **Start Server**
   ```bash
   npm run dev
   ```

3. **Verify Endpoints**
   - `POST /chat/enhanced` - Enhanced chat with memory
   - `GET /ui/events` - SSE for UI actions
   - `DELETE /chat/session/:id` - Clear session

### Frontend Setup

1. **Import Components** in `app.ts`
   ```typescript
   import { VoiceInputComponent } from './voice-input.component';
   import { ChatUIActionsComponent } from './chat-ui-actions.component';
   ```

2. **Add to Template**
   ```html
   <app-chat-ui-actions
     (openCard)="handleOpenCard($event)"
     (renderCharts)="handleRenderCharts($event)"
     ...>
   </app-chat-ui-actions>
   ```

3. **Update Chat Panel** to use `/chat/enhanced`

---

## 📊 Performance & Scalability

### Session Storage
- **Current**: In-memory Map (single instance)
- **Production**: Use Redis for multi-instance deployments
- **TTL**: 24 hours (configurable)
- **Cleanup**: Automatic hourly cleanup

### SSE Connections
- **Heartbeat**: Every 30 seconds
- **Auto-Reconnect**: 5-second delay on disconnect
- **Scalability**: Use Redis pub/sub for multi-instance

### Memory Management
- **History Limit**: 16 turns (32 messages)
- **Context Size**: Max 4000 characters
- **Auto-Trim**: Keeps last N*2 messages

---

## 🔒 Security Considerations

### Session IDs
- Use secure random IDs (crypto.randomBytes)
- Don't expose sensitive data in session context
- Implement rate limiting per session

### Voice Input
- Requires microphone permission
- No audio is sent to backend (client-side only)
- Transcription happens in browser

### UI Actions
- Validate all action parameters
- Check user permissions before executing
- Log all UI actions for audit

---

## 🧪 Testing

### Test Multi-Turn Memory
```bash
# Session 1
curl -X POST http://localhost:3001/chat/enhanced \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-1","user":"Find MOB in Dallas"}'

# Session 1 (continued)
curl -X POST http://localhost:3001/chat/enhanced \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-1","user":"What was the average PE?"}'
```

### Test UI Actions
```bash
# Connect to SSE stream
curl -N http://localhost:3001/ui/events

# In another terminal, trigger action via chat
curl -X POST http://localhost:3001/chat/enhanced \
  -H "Content-Type: application/json" \
  -d '{"user":"Show me deal #2"}'
```

### Test Voice Input
1. Open app in Chrome
2. Click 🎙️ button
3. Allow microphone permission
4. Speak: "Find retail properties in Texas"
5. Verify text appears in input

---

## 📈 Future Enhancements

### Phase 1 (Current)
- ✅ Multi-turn memory
- ✅ UI drill-in actions
- ✅ Voice input

### Phase 2 (Planned)
- [ ] Redis session persistence
- [ ] Voice output (text-to-speech)
- [ ] Team mentions (@user)
- [ ] Slack/Teams integration
- [ ] Session export/import

### Phase 3 (Future)
- [ ] Multi-language support
- [ ] Custom voice commands
- [ ] Keyboard shortcuts
- [ ] Mobile app integration

---

## 🎓 Best Practices

### For Users
1. **Use Voice for Speed**: Faster than typing for long queries
2. **Leverage Memory**: Ask follow-up questions without repeating context
3. **Use UI Actions**: "Show me deal #2" is faster than scrolling
4. **Clear Sessions**: Start fresh when switching topics

### For Developers
1. **Monitor Session Count**: Track active sessions
2. **Implement Rate Limiting**: Prevent abuse
3. **Log UI Actions**: Audit trail for debugging
4. **Test Voice in Chrome**: Best browser support
5. **Handle SSE Reconnects**: Network interruptions

---

**Status**: ✅ Fully Implemented
**Version**: 2.0.0
**Date**: October 5, 2025
