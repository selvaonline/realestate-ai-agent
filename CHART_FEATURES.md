# 📊 Visual Analytics & Chart Features

## ✨ New Features Added

### 1. **Interactive Factor Breakdown Charts**
Each scored property now has a **"📊 Show Breakdown" button** that reveals:
- **Horizontal Bar Chart** showing all 6 PE scoring factors
- **Color-coded bars** for visual hierarchy:
  - 🟢 Green: Tenant & Lease
  - 🔵 Blue: Yield Spread
  - 🟣 Purple: Market Quality
  - 🟠 Orange: Asset Fit
  - 🟡 Yellow: Deal Economics
  - ⚪ Gray: Execution Risk

### 2. **Visual Score Display**
- **Large, prominent score** (e.g., `85/100`)
- **Color-coded by tier**:
  - Green (≥80): Premium opportunities
  - Blue (≥70): Investment grade
  - Gray (<70): Below threshold

### 3. **Deal Card Enhancements**
- **Structured layout** with clear sections:
  - Property title with source number
  - Score + label (e.g., "Industrial · NNN · STARBUCKS · 6.2% Cap · A")
  - Expandable factor breakdown chart
  - Analyst rationale box
  - Clickable URL

### 4. **Technology Stack**
- **Chart.js** for professional, responsive charts
- **Angular signals** for reactive state
- **AfterViewChecked** lifecycle hook for chart initialization
- **Event-driven** chart rendering

## 🎨 Visual Design

### Chart Styling
```typescript
{
  type: 'bar',
  options: {
    indexAxis: 'y', // Horizontal bars
    responsive: true,
    plugins: {
      title: {
        text: 'PE Score Factor Breakdown',
        color: '#c9d7ff' // Light blue
      }
    },
    scales: {
      x: { max: 35 }, // Based on institutional weights (max 32)
      y: { ticks: { color: '#c9d7ff' } }
    }
  }
}
```

### Color Palette
- **Background**: `#0b0f14` (Dark navy)
- **Card background**: `#0b0f14` with `#0a0d12` for nested elements
- **Text**: `#c9d7ff` (Light blue-white)
- **Accents**: `#6b9aeb` (Blue), `#5fc88f` (Green), `#8b9db5` (Gray)
- **Borders**: Color-coded by score tier

## 📈 Portfolio Analytics (Future Enhancement)

The portfolio analytics section could also benefit from charts:

### Suggested Charts:
1. **Score Distribution** (Pie chart)
   - Premium (≥80)
   - Investment Grade (70-79)
   - Below Threshold (<70)

2. **Geographic Distribution** (Doughnut chart)
   - FL, TX, CA, Other markets
   - % of total opportunities

3. **Cap Rate Distribution** (Scatter plot)
   - X-axis: Deal size
   - Y-axis: Cap rate
   - Color: Score tier

4. **Tenant Credit Quality** (Stacked bar)
   - Investment Grade
   - Upper Mid-Market
   - Lower Mid-Market

## 🚀 Usage

1. **Run a search** at http://localhost:4200
2. **Results appear** with scores and labels
3. **Click "📊 Show Breakdown"** on any deal card
4. **View the factor chart** showing exactly how the score was calculated
5. **Toggle chart** by clicking the button again

## 🎯 Benefits

### For Analysts:
- **Transparency**: See exactly what drives each score
- **Comparability**: Visual comparison across opportunities
- **Speed**: Quickly identify strengths/weaknesses

### For Institutional Clients (PGIM):
- **Professional presentation**: Charts convey credibility
- **Data-driven**: Clear methodology, not a "black box"
- **Customizable**: Easy to adjust weights in config

### For Private Investors:
- **Educational**: Learn what makes a good deal
- **Confidence**: Understand the scoring rationale
- **Actionable**: Identify which factors to negotiate

## 🔧 Customization

### Adjust Chart Colors
Edit `app.ts` → `createFactorChart()` → `backgroundColor` array

### Change Factor Max Values
Edit chart `options.scales.x.max` based on your config weights

### Add More Charts
Use Chart.js types:
- `'pie'` for score distribution
- `'doughnut'` for geographic breakdown
- `'scatter'` for cap rate vs deal size
- `'radar'` for multi-property comparison

## 📝 Example Output

```
🎯 Top Investment Opportunities
Ranked by DealSense PE Scoring Model

┌───────────────────────────────────────────────┐
│ [1] Industrial Flex Los Angeles, CA           │
│ 85/100  Industrial · NNN · 6.2% Cap · A       │
│ [📊 Show Breakdown]                            │
│                                                │
│ ┌─ PE Score Factor Breakdown ────────────┐   │
│ │ Tenant & Lease     ███████████ 28       │   │
│ │ Yield Spread       ████████ 16          │   │
│ │ Market Quality     ██████████ 22        │   │
│ │ Asset Fit          ████ 8               │   │
│ │ Deal Economics     ██ 3                 │   │
│ │ Execution Risk     ████ 8               │   │
│ └─────────────────────────────────────────┘   │
│                                                │
│ Analysis: Tenant: amazon (Investment Grade).  │
│ Cap spread vs 10Y ≈ 1.9%. Market tier A.      │
│ Deal size ≈ $45M.                              │
│                                                │
│ https://www.crexi.com/properties/CA/...        │
└───────────────────────────────────────────────┘
```

## 🎓 Next Steps

1. **Test the charts** with a live query
2. **Tweak colors** to match your brand
3. **Add portfolio-level charts** (score distribution, geo breakdown)
4. **Export functionality** (download chart as PNG)
5. **Comparison view** (overlay multiple properties on one chart)
