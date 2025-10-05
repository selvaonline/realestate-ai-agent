# DealSense Chat - Quick Start

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
cd orchestrator
npm install
```

### Step 2: Configure API Key
Add to `orchestrator/.env`:
```bash
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

### Step 3: Start the App
```bash
# Terminal 1 - Backend
cd orchestrator
npm run dev

# Terminal 2 - Frontend
cd deal-agent-ui
npx ng serve --hmr
```

## 💬 Using the Chat

1. **Open the app** at `http://localhost:4200`
2. **Click the "Ask AI" button** in the bottom-right corner
3. **Try these examples**:

### Example Queries

#### Search for Properties
```
Find medical office buildings with hospital affiliation, cap rate 6-8%
```

#### Explain Scores
```
Why is the Market Risk score what it is?
```

#### Generate IC Memo
```
Create an IC memo for the top deal
```

#### Portfolio Questions
```
How many premium opportunities do we have?
```

## 🎯 Quick Actions

Click any quick action button for instant results:
- 📊 **Explain Market Risk** - Get risk factor breakdown
- ⭐ **Top Deals** - Show premium opportunities
- 📝 **Create IC Memo** - Generate investment memo
- 🔍 **New Search** - Run example search

## ⚙️ What You Can Ask

### About Current Results
- "Which deal has the highest cap rate?"
- "Show me all Tier A properties"
- "What's the average PE score?"
- "List properties by risk score"

### Explanations
- "Why did this property score 78?"
- "Explain the PE factors"
- "What are the risk indicators?"
- "Break down the scoring methodology"

### New Searches
- "Find retail properties in Miami"
- "Search for industrial warehouses under $5M"
- "Show me multifamily in Texas"

### Generate Artifacts
- "Create IC memo for deal #2"
- "Generate investment summary"
- "Make a portfolio report"

## 🔧 Troubleshooting

### Chat button not showing?
- Refresh the page
- Check browser console for errors
- Verify frontend is running on port 4200

### "API key not configured" error?
- Add `OPENAI_API_KEY` to `orchestrator/.env`
- Restart the orchestrator server
- Key should start with `sk-`

### Slow responses?
- Normal response time: 2-5 seconds
- Check your internet connection
- Verify OpenAI API status

## 📚 Learn More

See [CHATBOT_GUIDE.md](./CHATBOT_GUIDE.md) for:
- Detailed architecture
- API reference
- Advanced features
- Cost optimization
- Security best practices

## 💡 Pro Tips

1. **Use context**: The chat knows about your current search results
2. **Be specific**: "Create memo for the Walgreens property" works better than "make a memo"
3. **Ask follow-ups**: The chat maintains conversation context
4. **Try quick actions**: Fastest way to common tasks

## 🎬 Demo Flow

Perfect for showing off the chatbot:

1. Run a search: "Find medical office buildings in Dallas"
2. Wait for results to load
3. Open chat and ask: "Which property has the best PE score?"
4. Follow up: "Why did it score so high?"
5. Generate artifact: "Create an IC memo for it"

This demonstrates search, analysis, explanation, and artifact generation in one flow!
