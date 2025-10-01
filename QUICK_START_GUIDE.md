# 🚀 Quick Start Guide - DealSense PE

## ⚡ 5-Minute Demo

### **Step 1: Verify Servers Are Running**
```bash
# Check orchestrator (backend)
curl http://localhost:3001

# Check UI (frontend)
open http://localhost:4200
```

### **Step 2: Run Your First Query**

#### **For Institutional Mode** (Current: PGIM-style)
Try these queries to see premium scoring:
```
Class A logistics Orlando
```
```
Amazon fulfillment center Phoenix $50M
```
```
Industrial warehouse Dallas investment grade tenant
```

#### **For Private Mode** (Switch to family office style)
```bash
# Edit .env file:
PE_MODE=private

# Restart orchestrator
lsof -ti:3001 | xargs kill -9 && cd orchestrator && npm run dev
```

Then try:
```
Walgreens NNN Tampa under $5M
```
```
CVS pharmacy Florida 6% cap rate
```
```
Dollar General single tenant Texas
```

---

## 🎯 What to Look For

### **1. Instant Results** (3-5 seconds)
- ✅ Thinking steps show agent progress
- ✅ Top 5 opportunities appear with scores
- ✅ Color-coded: Green (≥80), Blue (≥70), Gray (<70)

### **2. Interactive Factor Breakdowns**
On each deal card, click **"📊 Show Breakdown"**:
- Horizontal bar chart appears
- 6 factors color-coded
- See exactly what drives the score

### **3. Portfolio Analytics Charts**
Scroll to the bottom:
- **Left**: Score Distribution (Doughnut chart)
  - Premium slice (green)
  - Investment Grade slice (blue)
  - Below Threshold slice (gray)
- **Right**: Geographic Distribution (Pie chart)
  - FL, TX, CA, Other
  - Color-coded slices

### **4. Analyst Notes**
Each deal has a professional rationale:
```
Analysis: Tenant: starbucks (Investment Grade). 
Cap spread vs 10Y ≈ 1.9%. Market tier A. 
NNN lease structure. Deal size ≈ $4M.
```

---

## 🔄 Switch Between Modes

### **Current Mode Check**
Look at console logs when orchestrator starts:
```
[DealSense PE] Loaded config mode=institutional from pe-config-institutional.json
```

### **Switch to Private Mode**
```bash
# Edit .env
echo "PE_MODE=private" >> orchestrator/.env

# Restart
lsof -ti:3001 | xargs kill -9
cd orchestrator && npm run dev
```

### **Switch to Institutional Mode**
```bash
# Edit .env
echo "PE_MODE=institutional" >> orchestrator/.env

# Restart
lsof -ti:3001 | xargs kill -9
cd orchestrator && npm run dev
```

---

## 📊 Test Chart Features

### **Test 1: Factor Breakdown Charts**
1. Run query: `"Industrial flex Los Angeles"`
2. Wait for results (3-5 sec)
3. Click **"📊 Show Breakdown"** on first result
4. **Expected**: Horizontal bar chart appears showing 6 factors
5. Click button again to hide chart

### **Test 2: Portfolio Charts**
1. Run query: `"Starbucks properties Florida"`
2. Scroll to **"📊 Portfolio Analytics"** section
3. **Expected**: See 2 charts side-by-side:
   - Score Distribution (doughnut)
   - Geographic Distribution (pie)

### **Test 3: Score Color Coding**
1. Run query: `"warehouse industrial"`
2. **Expected**: See different colored scores:
   - Green (85/100) = Premium
   - Blue (72/100) = Investment Grade
   - Gray (65/100) = Below Threshold

---

## 🎨 Visual Guide

### **What You Should See**

```
┌─────────────────────────────────────────────────────┐
│  RealEstate Deal Agent                              │
│  ┌──────────────────────────────────┬─────────┐    │
│  │ Class A logistics Orlando        │ Search  │    │
│  └──────────────────────────────────┴─────────┘    │
└─────────────────────────────────────────────────────┘

🔍 Thinking Steps:
✓ Understanding your query...
✓ Searching commercial real estate listings...
✓ Analyzing deal quality with DealSense PE...

🎯 Top Investment Opportunities

┌────────────────────────────────────────────────┐
│ [1] Industrial Flex, Los Angeles               │
│ 85/100  Industrial · NNN · AMAZON · 6.2% · A  │
│ [📊 Show Breakdown]                            │
│                                                │
│ ┌─ PE Score Factor Breakdown ────────────┐   │
│ │ Tenant & Lease     ███████████ 28       │   │ ← Click to reveal
│ │ Yield Spread       ████████ 16          │   │
│ │ Market Quality     ██████████ 22        │   │
│ │ Asset Fit          ████ 8               │   │
│ │ Deal Economics     ██ 3                 │   │
│ │ Execution Risk     ████ 8               │   │
│ └─────────────────────────────────────────┘   │
│                                                │
│ Analysis: Tenant: amazon (IG). Cap spread...  │
└────────────────────────────────────────────────┘

📊 Portfolio Analytics

┌──────────────────┐  ┌──────────────────┐
│ Score Dist.      │  │ Geo Dist.        │
│                  │  │                  │
│   [Doughnut]     │  │   [Pie Chart]    │
│                  │  │                  │
└──────────────────┘  └──────────────────┘

Total Opportunities: 5
Average Score: 82/100
Premium (≥80): 3 (60%)
...
```

---

## 🐛 Troubleshooting

### **No Charts Appearing?**
```bash
# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# Check console for errors
# Open DevTools: F12 or Cmd+Option+I
```

### **Wrong Mode Loading?**
```bash
# Check .env file
cat orchestrator/.env | grep PE_MODE

# Should show:
# PE_MODE=institutional  (or private)
```

### **Servers Not Running?**
```bash
# Check ports
lsof -ti:3001  # Orchestrator
lsof -ti:4200  # UI

# Restart both
lsof -ti:3001 | xargs kill -9
lsof -ti:4200 | xargs kill -9
cd orchestrator && npm run dev &
cd deal-agent-ui && npm start &
```

---

## 📝 Next Steps

### **Customize for Your Client**

1. **Adjust Scoring Weights**
   - Edit `config/pe-config.json` (private mode)
   - Edit `config/pe-config-institutional.json` (institutional mode)

2. **Add More Markets**
   - Add cities to `marketTiers.A` or `marketTiers.B`

3. **Update Tenant List**
   - Add brands to `tenantCredit.investmentGrade`

4. **Change Chart Colors**
   - Edit `deal-agent-ui/src/app/app.ts`
   - Search for `backgroundColor` arrays

5. **Export Data**
   - Click "Share Results" button
   - Copies formatted text to clipboard

---

## 💡 Pro Tips

### **Best Queries for Demo**
- ✅ `"Class A logistics Miami"` - Shows institutional preference
- ✅ `"Walgreens NNN Florida $5M"` - Shows private investor focus
- ✅ `"Amazon fulfillment Phoenix"` - High score example
- ✅ `"warehouse industrial outdoor storage"` - Multiple results

### **Impress Institutional Clients**
1. Run in **institutional mode**
2. Use queries with: "Class A", "$50M", "investment grade", "portfolio"
3. Show **factor breakdown charts**
4. Highlight **portfolio analytics** with visual charts
5. Mention **configurable** weights and thresholds

### **Impress Private Investors**
1. Run in **private mode**
2. Use queries with: "NNN", "single tenant", "$5M", "6% cap"
3. Show how it finds **opportunistic deals**
4. Highlight **speed** (3-5 seconds)
5. Mention **white-label** (rebrand for them)

---

## ✅ Success Checklist

- [ ] Servers running (3001, 4200)
- [ ] Ran at least 1 query
- [ ] Clicked "📊 Show Breakdown" button
- [ ] Saw factor breakdown chart
- [ ] Scrolled to portfolio analytics
- [ ] Saw score distribution chart
- [ ] Saw geographic distribution chart
- [ ] Tested both private and institutional modes
- [ ] Reviewed analyst notes
- [ ] Clicked on source URLs

---

**You're ready to demo to PGIM and other institutional clients!** 🎉

**Questions? Check the full docs:**
- `COMPLETE_FEATURE_SUMMARY.md` - Full feature overview
- `PE_SCORING_MODES.md` - Mode comparison
- `CHART_FEATURES.md` - Chart implementation details
