# Agent Flow Diagram

## Complete Flow Visualization

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Server
    participant Agent
    participant Search
    participant Browser

    User->>UI: Enter query: "Find multifamily deals in Dallas"
    UI->>Server: POST /run {query}
    Server-->>UI: {runId}
    
    UI->>Server: GET /events/:runId (SSE)
    
    Server->>Agent: runAgent(query, ctx)
    
    Note over Agent: Phase 1: Planning
    Agent->>UI: thinking: "Understanding your query..."
    Agent->>UI: thinking: "Searching commercial real estate listings..."
    
    Note over Agent,Search: Phase 2: Search
    Agent->>Search: webSearch(detailQuery)
    Search-->>Agent: [results]
    
    loop For each result
        Agent->>UI: source_found: {id, title, url, snippet}
    end
    
    Note over Agent,Browser: Phase 3: Extraction
    Agent->>UI: thinking: "Analyzing property listings..."
    
    loop For each URL
        Agent->>Browser: browseAndExtract(url)
        Browser-->>Agent: {title, address, price, noi, capRate}
        
        alt Success
            Agent->>UI: nav: "Navigating to..."
            Agent->>UI: shot: {screenshot}
            Agent->>UI: extracted: {summary}
            
            Note over Agent: Phase 4: Answer Synthesis
            Agent->>UI: answer_chunk: "Found a promising listing [1]: "
            Agent->>UI: answer_chunk: "**Title** located at address. "
            Agent->>UI: answer_chunk: "The asking price is $X. "
            Agent->>UI: answer_chunk: "Cap rate is Y%. "
            
            Agent->>UI: answer_complete: {}
        else Failure
            Note over Agent: Try next URL
        end
    end
    
    Agent->>UI: run_finished: {ok: true}
    Server->>UI: Result cached
    
    UI->>Server: GET /result/:runId
    Server-->>UI: {plan, deals, toolResult}
    
    Note over UI: Display deals section
```

## UI State Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Thinking: User submits query
    
    Thinking --> SearchingSources: Query understood
    SearchingSources --> SourcesFound: Sources discovered
    SourcesFound --> Analyzing: Begin extraction
    
    Analyzing --> StreamingAnswer: Data extracted
    StreamingAnswer --> StreamingAnswer: More chunks
    StreamingAnswer --> AnswerComplete: All chunks sent
    
    AnswerComplete --> DisplayingSources: Show sources
    DisplayingSources --> DisplayingDeals: Show deal cards
    DisplayingDeals --> Complete: All data rendered
    
    Complete --> Idle: New query
    
    note right of Thinking
        Shows:
        🔍 Understanding...
        🔍 Searching...
    end note
    
    note right of SourcesFound
        Sources appear:
        [1] Title - URL
        [2] Title - URL
    end note
    
    note right of StreamingAnswer
        Text builds progressively
        Typing indicator shown
    end note
    
    note right of AnswerComplete
        Full answer visible
        Sources expanded
        Deals cards shown
    end note
```

## Component Hierarchy

```
AppComponent
├── Header
│   └── "RealEstate Deal Agent"
│
├── SearchInput
│   ├── Input field
│   └── Search button
│
├── PerplexitySection (if answer || sources)
│   ├── ThinkingSteps (while !answerComplete)
│   │   └── ThinkingItem[]
│   │       ├── 🔍 icon
│   │       └── Thinking text
│   │
│   ├── AnswerSection (if answer)
│   │   ├── Answer text (streaming)
│   │   └── TypingIndicator (while !answerComplete)
│   │       └── • • • (animated)
│   │
│   └── SourcesSection (if sources && answerComplete)
│       ├── "Sources" heading
│       └── SourceItem[]
│           ├── [n] Citation number
│           └── SourceContent
│               ├── Title (link)
│               └── Snippet
│
├── TimelineDetails (collapsible)
│   └── Timeline
│       └── Card[]
│           ├── Thinking cards
│           ├── Source cards
│           ├── Navigation cards
│           ├── Screenshot cards
│           └── Extraction cards
│
└── DealsSection (if deals)
    ├── "Deals" heading
    └── DealCard[]
        ├── Title
        ├── Source link
        ├── Address
        ├── Metrics (price, NOI, cap, DSCR)
        └── Screenshot
```

## Event Timeline

```
Time    Event                     UI State
────────────────────────────────────────────────────────────
T+0     run_started               Show "Setting up..."
T+1     thinking: "Understanding" Show thinking step
T+2     thinking: "Searching"     Show thinking step
T+3     source_found [1]          Add source to list
T+4     source_found [2]          Add source to list
T+5     source_found [3]          Add source to list
T+6     thinking: "Analyzing"     Show thinking step
T+7     nav: "Navigating..."      Show in timeline
T+10    shot: {screenshot}        Show screenshot
T+11    extracted: {summary}      Show in timeline
T+12    answer_chunk: "Found..."  Start streaming answer
T+13    answer_chunk: "**Title**" Continue streaming
T+14    answer_chunk: "located"   Continue streaming
T+15    answer_chunk: "price is"  Continue streaming
T+16    answer_complete           Hide typing indicator
                                  Show sources section
T+17    run_finished              Enable new search
T+18    result received           Show deal cards
```

## Data Flow

```
┌─────────────┐
│    User     │
│   Query     │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│   Server    │◄────►│  Agent Core  │
│  (Express)  │      │   (Logic)    │
└──────┬──────┘      └──────┬───────┘
       │                    │
       │ SSE Stream         │ Tool Calls
       │                    │
       ▼                    ▼
┌─────────────┐      ┌──────────────┐
│     UI      │      │    Tools     │
│  (Angular)  │      │ Search/Browse│
└─────────────┘      └──────────────┘
       │
       ▼
┌─────────────┐
│  User sees: │
│  - Thinking │
│  - Sources  │
│  - Answer   │
│  - Deals    │
└─────────────┘
```
