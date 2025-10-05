# DealSense Chat - Flow Diagrams

## 1. Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Main App (app.ts)                                         │ │
│  │  - Search interface                                        │ │
│  │  - Results display                                         │ │
│  │  - Portfolio analytics                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Chat Panel (chat-panel.component.ts)                     │ │
│  │  - Floating button                                         │ │
│  │  - Message history                                         │ │
│  │  - Quick actions                                           │ │
│  │  - Input field                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ POST /chat
                            │ { messages, context }
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Express Router (index.ts)                                 │ │
│  │  - /run (existing)                                         │ │
│  │  - /events/:runId (existing)                               │ │
│  │  - /chat (NEW)                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Chat Handler (routes/chat.ts)                             │ │
│  │  1. Receive messages + context                             │ │
│  │  2. Build system prompt                                    │ │
│  │  3. Call OpenAI with tools                                 │ │
│  │  4. Execute tool if requested                              │ │
│  │  5. Get final response                                     │ │
│  │  6. Return to frontend                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OPENAI GPT-4o                               │
│  - Analyzes user query                                           │
│  - Decides which tool(s) to call                                 │
│  - Generates natural language response                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TOOL FUNCTIONS                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ web_search   │  │ pe_score_pro │  │ risk_blender │          │
│  │ (existing)   │  │ (existing)   │  │ (existing)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │generate_ic   │  │analyze_      │                             │
│  │_memo (NEW)   │  │context (NEW) │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Chat Request Flow

```
USER TYPES: "Find medical office buildings in Texas"
    │
    ▼
┌─────────────────────────────────────────┐
│ ChatPanelComponent.sendMessage()        │
│ - Add user message to history           │
│ - Show loading indicator                │
│ - Call backend API                      │
└───────────────┬─────────────────────────┘
                │
                │ HTTP POST /chat
                │ {
                │   messages: [
                │     { role: "user", content: "Find..." }
                │   ],
                │   context: { scored, portfolioData, ... }
                │ }
                ▼
┌─────────────────────────────────────────┐
│ Backend: chatRouter.post('/chat')       │
│ 1. Validate request                     │
│ 2. Build system messages                │
│ 3. Add context if provided              │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ OpenAI API Call                         │
│ openai.chat.completions.create({        │
│   model: "gpt-4o",                      │
│   messages: [...systemMessages,         │
│              ...userMessages],          │
│   tools: [web_search, pe_score_pro,     │
│           risk_blender, ...],           │
│   tool_choice: "auto"                   │
│ })                                      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ GPT-4o Decision                         │
│ "User wants to search for properties"   │
│ → Call web_search tool                  │
│ → Then call pe_score_pro                │
│ → Then call risk_blender                │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ Tool Execution                          │
│ 1. webSearch.invoke(query)              │
│    → Returns raw search results         │
│ 2. peScorePro.invoke(rows, query)       │
│    → Returns scored results             │
│ 3. riskBlender.invoke(query, data)      │
│    → Returns risk assessment            │
└───────────────┬─────────────────────────┘
                │
                │ Tool results
                ▼
┌─────────────────────────────────────────┐
│ Second OpenAI Call                      │
│ - Send tool results back to GPT-4o      │
│ - Get natural language response         │
│ "I found 8 medical office buildings..." │
└───────────────┬─────────────────────────┘
                │
                │ Response
                ▼
┌─────────────────────────────────────────┐
│ Backend Response                        │
│ {                                       │
│   role: "assistant",                    │
│   content: "I found 8 medical...",      │
│   toolUsed: "web_search",               │
│   toolResult: { scored, risk }          │
│ }                                       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ ChatPanelComponent                      │
│ - Add assistant message to history      │
│ - Hide loading indicator                │
│ - Show tool badge if tool was used      │
│ - Scroll to bottom                      │
└─────────────────────────────────────────┘
                │
                ▼
            USER SEES RESPONSE
```

## 3. Tool Calling Decision Tree

```
                    USER QUERY
                        │
                        ▼
            ┌───────────────────────┐
            │   GPT-4o Analyzes     │
            │   Query Intent        │
            └───────────┬───────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Search       │ │ Explain      │ │ Generate     │
│ Keywords:    │ │ Keywords:    │ │ Keywords:    │
│ - find       │ │ - why        │ │ - create     │
│ - search     │ │ - explain    │ │ - generate   │
│ - show me    │ │ - how        │ │ - make       │
│ - get        │ │ - what       │ │ - write      │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ web_search   │ │ analyze_     │ │ generate_ic_ │
│ +            │ │ context      │ │ memo         │
│ pe_score_pro │ │              │ │              │
│ +            │ │              │ │              │
│ risk_blender │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘

        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Portfolio    │ │ Direct       │ │ Complex      │
│ Question:    │ │ Answer:      │ │ Multi-tool:  │
│ - how many   │ │ - greetings  │ │ - compare    │
│ - average    │ │ - thanks     │ │ - analyze    │
│ - total      │ │ - help       │ │ - summarize  │
│ - list       │ │              │ │              │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ analyze_     │ │ No tool      │ │ Multiple     │
│ context      │ │ Direct reply │ │ tool calls   │
└──────────────┘ └──────────────┘ └──────────────┘
```

## 4. Context Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN APP STATE                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ deals = signal<Deal[]>([...])                          │ │
│  │ sources = signal<Source[]>([...])                      │ │
│  │ answer = signal<string>("...")                         │ │
│  │ q = signal<string>("medical office buildings")         │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ getChatContext()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  COMPUTED CONTEXT                            │
│  {                                                           │
│    scored: deals().slice(0, 10),  // Top 10                 │
│    portfolioData: {                                          │
│      totalDeals: 10,                                         │
│      avgPE: 68,                                              │
│      avgRisk: 54,                                            │
│      tierDistribution: { Premium: 2, ... },                 │
│      geoDistribution: { Texas: 5, ... }                     │
│    },                                                        │
│    query: "medical office buildings",                        │
│    sources: [...],                                           │
│    answer: "I found 10 properties...",                       │
│    riskNote: "Average market risk..."                        │
│  }                                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ [seedContext] binding
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  CHAT PANEL COMPONENT                        │
│  @Input() seedContext?: any;                                 │
│                                                              │
│  User asks: "Which deal has the highest PE?"                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ POST /chat with context
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND HANDLER                           │
│  const { messages, context } = req.body;                     │
│                                                              │
│  if (context?.scored) {                                      │
│    systemMessages.push({                                     │
│      role: "system",                                         │
│      content: `Context: Current run has                      │
│                ${context.scored.length} scored rows...`      │
│    });                                                       │
│  }                                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      GPT-4o                                  │
│  "Based on the context, the deal with the highest PE        │
│   score is [Property Name] with a score of 82..."           │
└─────────────────────────────────────────────────────────────┘
```

## 5. Quick Action Flow

```
USER CLICKS: "Explain Market Risk" button
    │
    ▼
┌─────────────────────────────────────────┐
│ sendQuickAction(action)                 │
│ - Set inputText = action.prompt         │
│ - Call sendMessage()                    │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ Prompt: "Why is the Market Risk score  │
│          what it is? Explain factors."  │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ Backend receives with context           │
│ - context.portfolioData.marketRisk      │
│ - context.riskNote                      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ GPT-4o calls analyze_context            │
│ - Examines risk factors                 │
│ - Breaks down components                │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ Response: "The Market Risk score of 54 │
│ reflects: Treasury rates at 4.5%,      │
│ metro unemployment at 3.2%..."         │
└─────────────────────────────────────────┘
```

## 6. IC Memo Generation Flow

```
USER: "Create an IC memo for the top deal"
    │
    ▼
┌─────────────────────────────────────────┐
│ GPT-4o identifies:                      │
│ - Intent: Generate IC memo              │
│ - Target: Top deal from context         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ Tool Call: generate_ic_memo             │
│ {                                       │
│   title: "Medical Office Building",     │
│   url: "https://...",                   │
│   pe: { score: 82, tier: "Premium" },  │
│   risk: { score: 48, note: "..." },    │
│   snippet: "15,000 SF medical..."       │
│ }                                       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ memoGenerator.generateIcMemo()          │
│ - Formats professional memo             │
│ - Includes all sections                 │
│ - Returns markdown                      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ GPT-4o receives memo                    │
│ - Adds context and explanation          │
│ - Returns to user                       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ User sees:                              │
│ "Here's your IC memo:                   │
│                                         │
│ # INVESTMENT COMMITTEE MEMORANDUM       │
│ **Date**: October 5, 2025              │
│ **Subject**: CRE Acquisition...         │
│ ..."                                    │
└─────────────────────────────────────────┘
```

## 7. Error Handling Flow

```
                    REQUEST
                        │
                        ▼
            ┌───────────────────────┐
            │   Validation          │
            └───────────┬───────────┘
                        │
        ┌───────────────┼───────────────┐
        │ VALID         │ INVALID       │
        ▼               ▼               
┌──────────────┐ ┌──────────────┐
│ Process      │ │ Return 400   │
│ Request      │ │ Bad Request  │
└──────┬───────┘ └──────────────┘
       │
       ▼
┌──────────────┐
│ Check API    │
│ Key          │
└──────┬───────┘
       │
       ├─ Missing ──→ Return 500 "API key not configured"
       │
       ▼
┌──────────────┐
│ Call OpenAI  │
└──────┬───────┘
       │
       ├─ Network Error ──→ Return 500 "Connection failed"
       ├─ Rate Limit ────→ Return 429 "Too many requests"
       ├─ Invalid Key ───→ Return 401 "Invalid API key"
       │
       ▼
┌──────────────┐
│ Execute Tool │
└──────┬───────┘
       │
       ├─ Tool Error ──→ Catch & return error message
       │
       ▼
┌──────────────┐
│ Success      │
│ Return 200   │
└──────────────┘
```

## 8. Message Display Flow

```
┌─────────────────────────────────────────┐
│ messages = signal<ChatMessage[]>([])    │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ *ngFor="let msg of messages()"          │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ USER MESSAGE                        │ │
│ │ ┌─────┐ ┌─────────────────────────┐ │ │
│ │ │ 👤  │ │ "Find MOB in Texas"     │ │ │
│ │ └─────┘ └─────────────────────────┘ │ │
│ │         12:34 PM                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ASSISTANT MESSAGE                   │ │
│ │ ┌─────┐ ┌─────────────────────────┐ │ │
│ │ │ 🤖  │ │ "I found 8 medical..."  │ │ │
│ │ └─────┘ └─────────────────────────┘ │ │
│ │         ┌─────────────────────────┐ │ │
│ │         │ 🔧 Web Search           │ │ │
│ │         └─────────────────────────┘ │ │
│ │         12:34 PM                    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

These diagrams illustrate the complete flow of the DealSense Chat system from user interaction to response generation.
