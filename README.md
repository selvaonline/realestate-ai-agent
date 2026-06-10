# 🏢 RealEstate AI Deal Agent

An intelligent agent that finds and analyzes commercial real estate investment opportunities using a **Perplexity-style interface** with transparent reasoning, source citations, and streaming answers.

##Demo Question
Find retail centers under $20M, 8%+ cap, strong demographics, repositioning opportunity

Find retail centers under $20M, 8%+ cap, strong demographics, repositioning opportunity

Find medical office buildings or urgent care facilities, cap rate 7%+

## ✨ Features

### 🤖 Intelligent Agent Flow

- **Transparent Thinking** - See the agent's reasoning process in real-time
- **Source Citations** - Numbered references [1], [2], [3] for all information
- **Streaming Answers** - Progressive text generation with inline citations
- **Multi-Source Search** - Aggregates from LoopNet, Crexi, and broker sites

### 💬 AI Chatbot (NEW!)

- **Conversational Interface** - Ask questions about deals, scores, and analytics
- **Explainability** - "Why is the Risk Score 56?" - Get detailed breakdowns
- **Artifact Generation** - "Create an IC memo for deal #1" - Instant reports
- **Portfolio Q&A** - "How many Tier A deals?" - Query your results
- **Quick Actions** - Pre-configured prompts for common tasks
- **Context-Aware** - Knows about your current search results

👉 **See [CHATBOT_QUICK_START.md](./CHATBOT_QUICK_START.md) to get started!**

### 📊 Property Analysis

- **Automated Extraction** - Property details, pricing, NOI, cap rate
- **Financial Underwriting** - DSCR, cash flow, ROI calculations
- **Visual Confirmation** - Screenshots of source listings
- **Deal Cards** - Clean presentation of investment opportunities

### 📍 Mobility Intelligence Agent (NEW!)

A "Location Intelligence / Foot Traffic" agent that estimates real-world property
activity for investment underwriting via the `analyze_traffic_patterns` tool.

- **What it scores** — for a given address (plus optional `propertyType`, `tenant`, `metro`)
  it returns a 0–100 **Mobility Score** blended from five component scores:
  parking utilization (25%), road traffic (25%), foot traffic (25%),
  nearby anchors (15%), and visibility (10%) — plus a trend
  (Increasing/Stable/Declining), confidence (Low/Medium/High), positive signals,
  risks, and a recommendation impact (Positive/Neutral/Negative).
- **PoC scoring model** — deterministic keyword/location heuristics
  ([orchestrator/src/tools/locationIntel/scoring.ts](orchestrator/src/tools/locationIntel/scoring.ts)):
  anchor tenants (Walgreens, CVS, Starbucks, Chick-fil-A, Walmart, Target, Costco,
  Kroger, Publix, Whole Foods, hospitals) boost anchor strength; high-visit property
  types (retail, pharmacy, medical office, grocery, QSR, urgent care) boost foot
  traffic; growth metros (Dallas, Austin, Orlando, Phoenix, Atlanta, Charlotte,
  Nashville, Tampa, Raleigh, Houston, Miami) boost road traffic; NNN / corporate-backed /
  national-tenant language raises confidence; rural or unknown locations reduce it.
  No paid APIs required.
- **Future provider hooks** — drop-in interfaces for Placer.ai, SafeGraph,
  Google Places, and state DOT traffic counts live in
  [orchestrator/src/tools/locationIntel/providers/](orchestrator/src/tools/locationIntel/providers/);
  any configured provider overrides the heuristic component scores.
- **PE model integration** — the PE score now includes a 7th factor,
  **Mobility / Real-World Activity (10 pts)**: Tenant Quality 20, Market Quality 20,
  Yield/Cap Rate 15, Deal Economics 15, Execution Risk 10, Asset Fit 10, Mobility 10.
- **Agent + MCP** — the planner calls the tool automatically for retail, pharmacy,
  QSR, grocery, urgent care, and medical office queries (or anything mentioning foot
  traffic, parking, visibility, or location strength), and it's exposed through the
  MCP server for Claude Desktop / Cursor / Windsurf.
- **UI** — a "Location Intelligence" result section shows the score breakdown,
  trend, confidence, and signals; a **⚡ Mobility Enhanced** badge appears whenever
  the tool contributed to the analysis.
- **Try it** — *"Find NNN Walgreens in Texas under $5M with 6%+ cap rate and strong traffic"*
  or *"Does this veterinary hospital location have strong real-world demand signals?"*
- **Tests** — `cd orchestrator && npm test` runs the deterministic scoring unit tests.

### 🎨 Modern UI

- **Perplexity-Inspired Design** - Clean, professional, engaging
- **Progressive Disclosure** - Thinking → Sources → Answer → Deals
- **Responsive Layout** - Works on desktop and mobile
- **Dark Theme** - Easy on the eyes with blue accents

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key
- Serper API key (for web search)

### Installation

```bash
# Clone the repository
git clone https://github.com/selvaonline/realestate-ai-agent.git
cd realestate-ai-agent

# Setup backend
cd orchestrator
npm install
cp .env.example .env
# Edit .env with your API keys

# Setup frontend
cd ../deal-agent-ui
npm install
```

### Running

```bash
# Terminal 1: Start backend (port 3001)
cd orchestrator
npm run dev

# Terminal 2: Start frontend (port 4200)
cd deal-agent-ui
ng serve

# Open browser
open http://localhost:4200
```

## 📖 Documentation

- **[Perplexity Flow Overview](./PERPLEXITY_FLOW.md)** - Detailed explanation of the flow
- **[Flow Diagrams](./docs/FLOW_DIAGRAM.md)** - Visual sequence and state diagrams
- **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** - How to extend and customize
- **[Before/After Comparison](./docs/BEFORE_AFTER.md)** - See the improvements

## 🎯 How It Works

### 1. **Query Understanding**

```
User: "Find multifamily deals in Dallas with cap rate > 6%"
Agent: 🔍 Understanding your query...
```

### 2. **Source Discovery**

```
Agent: 🔍 Searching commercial real estate listings...

Sources found:
[1] Crexi - Multifamily Property in Dallas
[2] LoopNet - 123 Main Street Investment
[3] Broker Site - Dallas Multifamily Portfolio
```

### 3. **Data Extraction**

```
Agent: 🔍 Analyzing property listings...
      🌐 Navigating to crexi.com...
      📸 [Screenshot captured]
```

### 4. **Answer Synthesis**

```
Found a promising listing [1]: **Crexi Multifamily Property**
located at 123 Main St, Dallas, TX. The asking price is
$2,500,000. Net Operating Income (NOI) is $200,000.
The cap rate is 8.00%. DSCR is 1.45. • • •
```

### 5. **Source Attribution**

```
Sources:
[1] Crexi - Multifamily Property Dallas
    123 Main Street, Dallas, TX investment opportunity
    https://www.crexi.com/property/...
```

## 🏗️ Architecture

```
┌─────────────┐
│   Angular   │  ← UI Layer (Perplexity-style interface)
│     UI      │
└──────┬──────┘
       │ SSE Stream
       ▼
┌─────────────┐
│   Express   │  ← API Layer (Event orchestration)
│   Server    │
└──────┬──────┘
       │ Function Calls
       ▼
┌─────────────┐
│  LangChain  │  ← Agent Layer (Decision making)
│    Agent    │
└──────┬──────┘
       │ Tool Invocations
       ▼
┌─────────────┐
│   Tools     │  ← Tool Layer (Search, Browse, Finance)
│  Layer      │
└─────────────┘
```

## 🛠️ Tech Stack

### Backend

- **Node.js + TypeScript** - Runtime and type safety
- **Express** - HTTP server
- **LangChain** - Agent orchestration
- **Playwright** - Browser automation
- **OpenAI GPT-4** - Language model
- **Serper** - Web search API

### Frontend

- **Angular 17** - Framework with signals
- **TypeScript** - Type safety
- **Server-Sent Events** - Real-time streaming
- **Responsive CSS** - Modern design

## 📊 Example Output

### Thinking Steps

```
🔍 Understanding your query...
🔍 Searching commercial real estate listings...
🔍 Analyzing property listings...
```

### Answer with Citations

```
Found a promising listing [1]: **Vista Ridge Apartments** located
at 5847 Forest Ln, Dallas, TX 75230. The asking price is $16,500,000.
Net Operating Income (NOI) is $1,251,642. The cap rate is 7.58%.
DSCR is 1.52.
```

### Sources

```
[1] Crexi - Vista Ridge Apartments
    Dallas multifamily investment opportunity...
    https://www.crexi.com/property/...
```

## 🔧 Configuration

### Environment Variables

```bash
# orchestrator/.env
OPENAI_API_KEY=sk-...          # OpenAI API key
SERPER_API_KEY=...             # Serper search API key
OPENAI_MODEL=gpt-4o-mini       # Model to use
PORT=3001                      # Server port

# Optional: Browser debugging
BROWSER_HEADED=false           # Show browser window
BROWSER_ENGINE=chromium        # chromium | webkit
BROWSER_DEVTOOLS=false         # Open DevTools
```

### Customization

See [Developer Guide](./docs/DEVELOPER_GUIDE.md) for:

- Adding new event types
- Customizing thinking messages
- Styling the UI
- Adding new tools

## 🐛 Troubleshooting

### Events not showing in UI

1. Check browser console for errors
2. Verify SSE connection in Network tab
3. Ensure backend is running on port 3001

### No search results

1. Verify `SERPER_API_KEY` is set
2. Check query format (be specific)
3. Try broader search terms

### Browser automation failing

1. Install Playwright browsers: `npx playwright install`
2. Try different engine: `BROWSER_ENGINE=webkit`
3. Enable headed mode for debugging: `BROWSER_HEADED=true`

## 🤝 Contributing

Contributions welcome! Please read our [Developer Guide](./docs/DEVELOPER_GUIDE.md) first.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Inspired by [Perplexity AI](https://www.perplexity.ai)
- Built with [LangChain](https://js.langchain.com/)
- Powered by [OpenAI GPT-4](https://openai.com/)

---

Made with ❤️ for commercial real estate investors
