# Tooltips & Popups Guide - DealSense PE & Market Risk

## Overview
This guide provides the enhanced popup content and tooltip text for the DealSense PE Model and Market Risk Score. These are designed for institutional-grade presentation with quick scanability and technical credibility.

---

## 1. DealSense PE Model

### Full Popup (Modal)

**File:** `deal-agent-ui/pe-model-popup-enhanced.html`

**Key Features:**
- 🧠 Professional header with icon
- Green callout box with purpose statement
- Four key factor categories (Financial, Location, Asset, Lease/Risk)
- Specific weighting percentages (Financial ≈ 30%, Location ≈ 25%, Asset ≈ 25%, Lease/Risk ≈ 20%)
- Score interpretation table with color coding
- Use cases for analysts
- Yellow disclaimer box

**Score Interpretation Table:**

| Score | Classification | Meaning |
|-------|---------------|---------|
| 80–100 (Green) | Core / Core+ | Strong fundamentals, attractive yield, low risk |
| 60–79 (Blue) | Value-Add | Solid deal, moderate risk, potential upside |
| 40–59 (Yellow) | Opportunistic | Higher risk, needs repositioning or short lease term |
| 0–39 (Red) | Watch / Decline | Weak fundamentals or incomplete data |

---

### Tooltip Version (Hover Text)

**Standard Tooltip (2-3 sentences):**
```
DealSense PE Score (1–100) rates a property's investment strength.
It blends financials (Cap Rate, NOI), location quality, asset condition, 
and lease risk into a single, comparable score — higher = more favorable 
fundamentals. (Use with the Market Risk Score for a complete deal view.)
```

**Short Tooltip (1 sentence):**
```
PE Score (1–100) summarizes a property's fundamentals — higher = stronger 
yield, credit, and market quality.
```

**Implementation:**
```html
<!-- In deal card header -->
<span class="pe-score-label">
  PE Score: 82/100
  <span class="info-icon" 
        title="PE Score (1–100) summarizes a property's fundamentals — higher = stronger yield, credit, and market quality.">
    ℹ️
  </span>
</span>
```

Or with clickable icon:
```html
<span class="pe-score-label">
  PE Score: 82/100
  <button class="info-btn" (click)="showPeModelInfo.set(true)">
    <span class="tooltip">
      DealSense PE Score (1–100) rates a property's investment strength.
      Higher = more favorable fundamentals.
    </span>
    ℹ️
  </button>
</span>
```

---

## 2. Market Risk Score

### Full Popup (Modal)

**File:** `deal-agent-ui/market-risk-popup-enhanced.html`

**Key Features:**
- 📊 Professional header with icon
- Blue callout box with purpose statement
- Detailed input explanations (Treasury, Labor, Signal Confidence)
- Specific weighting percentages (Treasury ≈ 40%, Labor ≈ 30%, News ≈ 20%, Quality ≈ 10%)
- Score interpretation table with color coding
- Use cases for analysts
- Yellow baseline callout (50 = neutral)

**Score Interpretation Table:**

| Score | Meaning | Macro Signal |
|-------|---------|--------------|
| 0–39 (Green) | Low risk | Favorable rates, strong labor |
| 40–59 (Yellow) | Moderate | Balanced environment |
| 60–79 (Orange) | Elevated | Rates rising or labor weakening |
| 80–100 (Red) | High | Macro stress / tight credit |

---

### Tooltip Version (Hover Text)

**Standard Tooltip (2-3 sentences):**
```
Market Risk Score (0–100) gauges macro conditions affecting deal performance.
It blends Treasury yields, labor market data, and sentiment into a single 
score — higher = more macro risk. (Baseline: 50 = neutral)
```

**Short Tooltip (1 sentence):**
```
Market Risk (0–100) reflects macro conditions — higher = elevated rates 
or labor stress.
```

**Implementation:**
```html
<!-- In market risk banner -->
<div class="market-risk-banner">
  📊 Market Risk: 56/100
  <span class="info-icon" 
        title="Market Risk (0–100) reflects macro conditions — higher = elevated rates or labor stress.">
    ℹ️
  </span>
  <a id="market-risk-info-icon" class="learn-more">
    How market risk calculated?
  </a>
</div>
```

---

## 3. Implementation Checklist

### Phase 1: Replace Popup Content
- [ ] Replace PE Model popup (lines 172-190 in `app.ts`)
  - Use content from `pe-model-popup-enhanced.html`
- [ ] Replace Market Risk popup (lines 191-213 in `app.ts`)
  - Use content from `market-risk-popup-enhanced.html`

### Phase 2: Add Tooltips
- [ ] Add tooltip to PE Score badges in deal cards
  - Use short version for hover
  - Keep clickable icon for full popup
- [ ] Add tooltip to Market Risk banner
  - Use short version for hover
  - Keep "How market risk calculated?" link for full popup

### Phase 3: CSS for Tooltips
```css
.info-icon {
  cursor: help;
  font-size: 14px;
  color: #6b7280;
  margin-left: 4px;
  transition: color 0.2s;
}

.info-icon:hover {
  color: #3b82f6;
}

.tooltip {
  display: none;
  position: absolute;
  background: #1f2937;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  max-width: 250px;
  z-index: 1000;
  line-height: 1.4;
}

.info-btn:hover .tooltip {
  display: block;
}
```

---

## 4. Placement Strategy

### Deal Cards
```
┌─────────────────────────────────────────────────────────┐
│ 1  Walgreens NNN - Dallas, TX                           │
│    PE 82/100 → Core ℹ️  Risk 56/100 → Moderate ℹ️      │
│    ↑ Hover shows tooltip                                │
│    ↑ Click ℹ️ opens full popup                         │
└─────────────────────────────────────────────────────────┘
```

### Market Risk Banner
```
┌─────────────────────────────────────────────────────────┐
│ 📊 Market Risk: 56/100 ℹ️ · How market risk calculated?│
│    ↑ Hover shows tooltip                                │
│    ↑ Click link opens full popup                        │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Content Comparison

### Before vs After

**PE Model - Before:**
```
"The DealSense Proprietary Equity (PE) Model is a sophisticated 
algorithm designed to evaluate commercial real estate investment 
opportunities by analyzing a wide range of factors..."
```

**PE Model - After:**
```
"The DealSense Private Equity (PE) Model scores each property on 
a 1–100 scale, indicating its overall investment appeal. 
A higher score = stronger fundamentals and better strategic fit."
```

**Improvements:**
- ✅ More concise (50% shorter intro)
- ✅ Scannable sections with bold headers
- ✅ Specific weighting percentages
- ✅ Color-coded score table
- ✅ Institutional language (Core/Core+/Value-Add/Opportunistic)

---

## 6. User Experience Flow

### First-Time User
1. Sees PE Score badge: "82/100 → Core ℹ️"
2. Hovers over ℹ️ → Sees tooltip: "PE Score (1–100) summarizes fundamentals..."
3. Clicks ℹ️ → Opens full popup with detailed explanation
4. Reads table, understands 80+ = Core
5. Closes popup, now confident in score meaning

### Returning User
1. Sees PE Score: "82/100 → Core"
2. Already knows Core = strong fundamentals
3. No need to open popup
4. Focuses on deal details

---

## 7. Business Value

### For Analysts
- **Quick Reference**: Tooltip provides instant context
- **Deep Dive**: Full popup for training or verification
- **Consistency**: Same explanation across all deals

### For Executives
- **Trust**: Professional, institutional-grade explanations
- **Transparency**: Clear methodology and weighting
- **Comparability**: Standardized scoring across portfolio

### For Demos
- **Credibility**: Shows technical rigor
- **Explainability**: Every score has clear meaning
- **Professionalism**: Matches PGIM/Blackstone standards

---

## 8. Testing Checklist

- [ ] Tooltip appears on hover (both PE and Risk)
- [ ] Tooltip text is readable and concise
- [ ] Full popup opens on click
- [ ] Popup content is scannable (headers, tables, bullets)
- [ ] Score table colors match badge colors
- [ ] Mobile responsive (popup scrolls on small screens)
- [ ] Close button (×) works on both popups
- [ ] Background overlay dims content behind popup

---

## 9. Future Enhancements

### Phase 2
- [ ] Add "Learn More" links to external resources
- [ ] Include video explainer (1-2 min)
- [ ] Add "Example Calculation" section

### Phase 3
- [ ] Interactive score calculator
- [ ] Historical score trends
- [ ] Benchmark comparisons

---

**Generated by RealEstate Deal Agent Enhancement Team**
*Version: 3.0 | Date: 2025-10-04*
*Status: Ready for Implementation ✅*
