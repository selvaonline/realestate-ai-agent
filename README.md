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
