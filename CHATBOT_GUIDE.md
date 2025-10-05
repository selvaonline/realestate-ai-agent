# DealSense Chat - AI Chatbot Guide

## Overview

DealSense Chat is an intelligent AI assistant built on top of the RealEstate Deal Agent. It provides conversational access to all platform capabilities including search, scoring, risk analysis, and artifact generation.

## Features

### 1. **Query & Search**
Ask the chatbot to find properties using natural language:
- "Find medical office buildings with hospital affiliation, cap rate 6-8%"
- "Search for IOS yards in Florida"
- "Show me multifamily properties in Dallas"

### 2. **Explainability**
Get detailed explanations about scores and recommendations:
- "Why is the Risk Score 56?"
- "Explain the PE score for the top deal"
- "What factors contributed to this property's rating?"

### 3. **Artifact Generation**
Generate investment committee memos and reports:
- "Create an IC memo for deal #1"
- "Generate a memo for the Walgreens property"
- "Make an investment summary for the top 3 deals"

### 4. **Portfolio Analytics Q&A**
Ask questions about current results:
- "How many Tier A deals do we have?"
- "What's the average PE score?"
- "Which deal has the highest cap rate?"
- "Show me premium opportunities only"

## Architecture

```
UI Chat Panel  ──>  POST /chat
                        |
                        v
             OpenAI GPT-4o with tools
                        |
        ┌───────────────┴──────────────────┐
        |     Existing Agent Tools         |
        |  webSearch → peScorePro → risk   |
        |  generateIcMemo                  |
        └──────────────────────────────────┘
```

## Backend Components

### 1. Chat Route (`/orchestrator/src/routes/chat.ts`)
- **Endpoint**: `POST /chat`
- **Model**: GPT-4o (fast, cost-effective)
- **Temperature**: 0.2 (consistent, factual responses)
- **Function Calling**: Integrated with existing tools

### 2. Tool Definitions
The chatbot has access to:

#### `web_search`
Search CRE listings across multiple platforms
- **Parameters**: `query`, `maxResults`
- **Returns**: Scored and ranked results with PE and risk scores

#### `pe_score_pro`
Score properties with DealSense PE model
- **Parameters**: `rows`, `query`
- **Returns**: Scored rows with PE factors

#### `risk_blender`
Compute market risk scores
- **Parameters**: `query`, `data` (treasury rates, BLS data)
- **Returns**: Risk score and analysis note

#### `generate_ic_memo`
Create investment committee memos
- **Parameters**: `title`, `url`, `pe`, `risk`, `snippet`
- **Returns**: Formatted IC memo in markdown

#### `analyze_context`
Analyze current portfolio context
- **Parameters**: `question`
- **Returns**: Analysis based on current deals

### 3. IC Memo Generator (`/orchestrator/src/utils/memoGenerator.ts`)
Generates professional investment committee memos with:
- Executive summary
- Property overview
- PE score analysis
- Market risk assessment
- Deal structure considerations
- Financial projections
- Risk factors
- Recommendations

## Frontend Components

### Chat Panel Component (`/deal-agent-ui/src/app/chat-panel.component.ts`)
Angular standalone component with:
- **Floating chat button** (bottom-right corner)
- **Expandable chat window** (420px × 600px)
- **Message history** with user/assistant distinction
- **Quick action buttons** for common tasks
- **Typing indicators** during processing
- **Tool usage badges** showing which tools were called
- **Markdown formatting** support

### Quick Actions
Pre-configured prompts for common tasks:
1. **Explain Market Risk** - Get detailed risk factor breakdown
2. **Top Deals** - Show premium opportunities
3. **Create IC Memo** - Generate memo for top deal
4. **New Search** - Example search query

### Context Passing
The chat panel receives context from the main app:
```typescript
{
  scored: Deal[],           // Top 10 scored deals
  portfolioData: {          // Portfolio statistics
    totalDeals: number,
    avgPE: number,
    avgRisk: number,
    tierDistribution: {},
    geoDistribution: {}
  },
  query: string,            // Current search query
  sources: Source[],        // Source citations
  answer: string,           // Current answer
  riskNote: string          // Risk assessment note
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd orchestrator
npm install openai
```

The `openai` package (v4.77.0) is already added to `package.json`.

### 2. Configure API Key

Add your OpenAI API key to `.env`:

```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

### 3. Start the Backend

```bash
cd orchestrator
npm run dev
```

The chat endpoint will be available at `http://localhost:3001/chat`

### 4. Start the Frontend

```bash
cd deal-agent-ui
npm install
npx ng serve --hmr
```

The chat panel will appear in the bottom-right corner.

## Usage Examples

### Example 1: Search Query
**User**: "Find medical office buildings in Texas with cap rate above 7%"

**Chatbot**: 
- Calls `web_search` with optimized query
- Calls `pe_score_pro` to score results
- Calls `risk_blender` for market analysis
- Returns: "I found 8 medical office buildings in Texas... [1] shows a 7.2% cap rate..."

### Example 2: Score Explanation
**User**: "Why did the first property score 78 on PE?"

**Chatbot**:
- Analyzes context from `seedContext`
- Returns: "The PE score of 78 reflects strong fundamentals: prime location (15 pts), stable tenant mix (20 pts)..."

### Example 3: IC Memo Generation
**User**: "Create an IC memo for the Walgreens property"

**Chatbot**:
- Calls `generate_ic_memo` with property details
- Returns: Full formatted memo with executive summary, analysis, recommendations

### Example 4: Portfolio Analytics
**User**: "How many premium deals do we have?"

**Chatbot**:
- Analyzes `portfolioData.tierDistribution`
- Returns: "You have 3 premium opportunities (PE score ≥80): [lists properties]"

## System Prompt

The chatbot operates with this system prompt:

```
You are DealSense Chat, an analyst assistant for commercial real estate.

Capabilities:
- When the user asks to "find" or "search", call web_search with a multi-domain query 
  and then call pe_score_pro and risk_blender.
- When the user asks "why" a score or recommendation, use provided factors 
  (peFactors, peSignals, riskNote).
- When the user asks for an IC memo, format with the standard template the app uses.
- Keep answers concise and institutional; never invent prices or cap rates—if missing, 
  say "not stated".
- Use the current run's context if provided (portfolioData, scored rows); otherwise, 
  perform a new search.

Output policy:
- Cite source titles/links when making claims about a specific property.
- If a site is blocked, say "site blocked; providing scored summary only".
- Always be precise with numbers and scores.
- Format responses in clear, professional markdown.
```

## Cost Considerations

### Token Usage
- **Average query**: 500-1,500 tokens
- **With tool calls**: 2,000-4,000 tokens
- **IC memo generation**: 3,000-5,000 tokens

### Pricing (GPT-4o)
- **Input**: $2.50 per 1M tokens
- **Output**: $10.00 per 1M tokens
- **Estimated cost per query**: $0.01-0.05

### Optimization Tips
1. Use temperature 0.2 for consistency
2. Limit context to top 10 deals
3. Cache portfolio statistics
4. Implement rate limiting (recommended: 10 req/min per user)

## Safety & Best Practices

### 1. Rate Limiting
Add to `chat.ts`:
```typescript
import rateLimit from 'express-rate-limit';

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many chat requests, please try again later'
});

chatRouter.use('/chat', chatLimiter);
```

### 2. Input Validation
- Validate message array structure
- Limit message length (max 2000 chars)
- Sanitize user input

### 3. Error Handling
- Graceful degradation if OpenAI API fails
- Clear error messages to users
- Log errors for debugging

### 4. Security
- Never expose API keys in frontend
- Use environment variables
- Implement authentication (if multi-user)
- Add CORS restrictions

## Troubleshooting

### Chat button not appearing
- Check that `ChatPanelComponent` is imported in `app.ts`
- Verify `provideHttpClient()` is in `app.config.ts`
- Check browser console for errors

### "OPENAI_API_KEY not configured" error
- Add `OPENAI_API_KEY` to `.env` file
- Restart the orchestrator server
- Verify the key starts with `sk-`

### Tool calls failing
- Check that all tool functions are properly exported
- Verify SERPER_API_KEY is set for web search
- Check FRED_API_KEY and BLS_API_KEY for risk analysis

### Slow responses
- GPT-4o should respond in 2-5 seconds
- If slower, check network connectivity
- Consider implementing streaming (future enhancement)

## Future Enhancements

### 1. Streaming Responses
Implement SSE streaming for real-time responses:
```typescript
chatRouter.post('/chat/stream', async (req, res) => {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true
  });
  
  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
});
```

### 2. Conversation History
Store chat history in database for:
- Multi-turn conversations
- Context retention
- User preferences

### 3. Voice Input
Add speech-to-text for voice queries:
- Web Speech API integration
- Mobile-friendly interface

### 4. Export Conversations
Allow users to:
- Download chat transcripts
- Email conversations
- Share insights with team

### 5. Advanced Analytics
- "Compare these 3 properties"
- "Show me trends over time"
- "Generate portfolio summary report"

## API Reference

### POST /chat

**Request Body**:
```json
{
  "messages": [
    { "role": "user", "content": "Find MOB in Texas" }
  ],
  "context": {
    "scored": [...],
    "portfolioData": {...},
    "query": "medical office buildings"
  }
}
```

**Response**:
```json
{
  "role": "assistant",
  "content": "I found 5 medical office buildings...",
  "toolUsed": "web_search",
  "toolResult": {
    "scored": [...],
    "risk": {...}
  }
}
```

**Error Response**:
```json
{
  "error": "OPENAI_API_KEY not configured",
  "message": "Please add OPENAI_API_KEY to your .env file"
}
```

## Support

For issues or questions:
1. Check this guide first
2. Review error logs in browser console and server logs
3. Verify all environment variables are set
4. Check OpenAI API status: https://status.openai.com

## Demo Script

To demonstrate the chatbot:

1. **Start with a search**: "Find industrial properties in Phoenix"
2. **Ask about results**: "Which one has the best PE score?"
3. **Get explanation**: "Why did it score so high?"
4. **Generate artifact**: "Create an IC memo for the top deal"
5. **Portfolio question**: "What's the average cap rate across all deals?"

This showcases all major capabilities in a natural flow.
