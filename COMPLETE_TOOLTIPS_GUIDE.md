# Complete Tooltips Guide - All Metrics

## Overview
Consistent, executive-friendly hover descriptions for all DealSense metrics. Each tooltip follows the same pattern for instant comprehension.

---

## Tooltip Pattern

All tooltips follow this structure:
1. **Metric (0–100)** → what it measures
2. **How it's calculated** → key inputs
3. **What higher/lower means** → interpretation

---

## 1. 🧠 DealSense PE Score

### Standard Tooltip (2-3 sentences)
```
DealSense PE Score (1–100) rates a property's investment strength.
It blends financials (Cap Rate, NOI), location quality, asset condition, 
and lease risk into a single, comparable score — higher = more favorable 
fundamentals. (Use with the Market Risk Score for a complete deal view.)
```

### Short Hover Version
```
PE Score (1–100) summarizes a property's fundamentals — higher = stronger 
yield, credit, and market quality.
```

**Implementation:**
```html
<span class="metric-label">
  PE Score: 82/100
  <span class="info-icon" 
        title="PE Score (1–100) summarizes a property's fundamentals — higher = stronger yield, credit, and market quality.">
    ℹ️
  </span>
</span>
```

---

## 2. 📊 Market Risk Score

### Standard Tooltip (2-3 sentences)
```
Market Risk Score (0–100) gauges macroeconomic conditions that may impact 
deal pricing and performance. It blends interest-rate trends (Treasury yields) 
and labor data (BLS unemployment) into a single risk index — higher = more 
macro risk. (50 = neutral market; above 60 = tightening environment.)
```

### Short Hover Version
```
Market Risk (0–100) reflects interest-rate and employment trends — 
higher = greater macro and financing risk.
```

**Implementation:**
```html
<span class="metric-label">
  📊 Market Risk: 56/100
  <span class="info-icon" 
        title="Market Risk (0–100) reflects interest-rate and employment trends — higher = greater macro and financing risk.">
    ℹ️
  </span>
  <a id="market-risk-info-icon" class="learn-more">
    How market risk calculated?
  </a>
</span>
```

---

## 3. 🏢 Tenant Credit Score

### Standard Tooltip (2-3 sentences)
```
Tenant Credit (0–100) reflects the tenant's financial strength and lease 
guarantee quality. Investment-grade (IG) tenants score higher; franchise 
or non-IG operators score lower. (Higher = stronger credit and lower 
default risk.)
```

### Short Hover Version
```
Tenant Credit (0–100) measures tenant financial strength — 
higher = IG credit, lower default risk.
```

**Implementation:**
```html
<div class="quick-fact">
  <span class="fact-label">Tenant Credit:</span>
  <span class="fact-value">
    85/100 (IG)
    <span class="info-icon" 
          title="Tenant Credit (0–100) measures tenant financial strength — higher = IG credit, lower default risk.">
      ℹ️
    </span>
  </span>
</div>
```

---

## 4. 📜 Lease Risk Score

### Standard Tooltip (2-3 sentences)
```
Lease Risk (0–100) measures exposure from lease term, rent escalations, 
and renewal options. Shorter terms or weak escalation clauses increase 
risk; longer NNN leases reduce it. (Lower = more stable, long-term 
cash flow.)
```

### Short Hover Version
```
Lease Risk (0–100) evaluates lease term and escalations — 
lower = longer term, stronger cash flow.
```

**Implementation:**
```html
<div class="quick-fact">
  <span class="fact-label">Lease Risk:</span>
  <span class="fact-value">
    35/100 (Low)
    <span class="info-icon" 
          title="Lease Risk (0–100) evaluates lease term and escalations — lower = longer term, stronger cash flow.">
      ℹ️
    </span>
  </span>
</div>
```

---

## 5. 🧱 Asset Quality Score

### Standard Tooltip (2-3 sentences)
```
Asset Quality (0–100) evaluates property condition, build year, and 
adaptability. Newer or well-maintained Class A assets score higher; 
older or specialized assets score lower. (Higher = more resilient 
and attractive asset.)
```

### Short Hover Version
```
Asset Quality (0–100) rates property condition and age — 
higher = newer, Class A, more adaptable.
```

**Implementation:**
```html
<div class="quick-fact">
  <span class="fact-label">Asset Quality:</span>
  <span class="fact-value">
    78/100 (Class A)
    <span class="info-icon" 
          title="Asset Quality (0–100) rates property condition and age — higher = newer, Class A, more adaptable.">
      ℹ️
    </span>
  </span>
</div>
```

---

## 6. 📍 Market Quality Score

### Standard Tooltip (2-3 sentences)
```
Market Quality (0–100) reflects local fundamentals — population growth, 
vacancy, rent trends, and infrastructure access. Tier-A growth metros 
rank higher than tertiary or shrinking markets. (Higher = stronger 
location fundamentals.)
```

### Short Hover Version
```
Market Quality (0–100) measures local fundamentals — 
higher = Tier A metro, strong growth.
```

**Implementation:**
```html
<div class="quick-fact">
  <span class="fact-label">Market Quality:</span>
  <span class="fact-value">
    82/100 (Tier A)
    <span class="info-icon" 
          title="Market Quality (0–100) measures local fundamentals — higher = Tier A metro, strong growth.">
      ℹ️
    </span>
  </span>
</div>
```

---

## Complete CSS for Tooltips

```css
/* Info icon styling */
.info-icon {
  cursor: help;
  font-size: 13px;
  color: #9ca3af;
  margin-left: 4px;
  transition: color 0.2s;
  display: inline-block;
  vertical-align: middle;
}

.info-icon:hover {
  color: #3b82f6;
}

/* Native browser tooltip enhancement */
[title] {
  position: relative;
}

/* Custom tooltip (optional advanced implementation) */
.tooltip-wrapper {
  position: relative;
  display: inline-block;
}

.tooltip-content {
  visibility: hidden;
  position: absolute;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #1f2937;
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  max-width: 280px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  white-space: normal;
  text-align: left;
}

.tooltip-content::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: #1f2937 transparent transparent transparent;
}

.tooltip-wrapper:hover .tooltip-content {
  visibility: visible;
  opacity: 1;
}

/* Metric label styling */
.metric-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: #1f2937;
}

.fact-label {
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
}

.fact-value {
  color: #1a2332;
  font-weight: 500;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

---

## Quick Facts Row - Complete Example

```html
<div class="quick-facts" style="display:flex; gap:16px; flex-wrap:wrap; margin:12px 0; padding:12px; background:#f8fafc; border-radius:8px; font-size:12px;">
  
  <!-- Tenant Credit -->
  <div class="quick-fact">
    <span class="fact-label">Tenant Credit:</span>
    <span class="fact-value">
      85/100 (IG)
      <span class="info-icon" 
            title="Tenant Credit (0–100) measures tenant financial strength — higher = IG credit, lower default risk.">
        ℹ️
      </span>
    </span>
  </div>
  
  <!-- Lease Risk -->
  <div class="quick-fact">
    <span class="fact-label">Lease Risk:</span>
    <span class="fact-value">
      35/100 (Low)
      <span class="info-icon" 
            title="Lease Risk (0–100) evaluates lease term and escalations — lower = longer term, stronger cash flow.">
        ℹ️
      </span>
    </span>
  </div>
  
  <!-- Asset Quality -->
  <div class="quick-fact">
    <span class="fact-label">Asset Quality:</span>
    <span class="fact-value">
      78/100 (Class A)
      <span class="info-icon" 
            title="Asset Quality (0–100) rates property condition and age — higher = newer, Class A, more adaptable.">
        ℹ️
      </span>
    </span>
  </div>
  
  <!-- Market Quality -->
  <div class="quick-fact">
    <span class="fact-label">Market Quality:</span>
    <span class="fact-value">
      82/100 (Tier A)
      <span class="info-icon" 
            title="Market Quality (0–100) measures local fundamentals — higher = Tier A metro, strong growth.">
        ℹ️
      </span>
    </span>
  </div>
  
  <!-- Classification -->
  <div class="quick-fact">
    <span class="fact-label">Classification:</span>
    <span class="fact-value" style="color:#059669; font-weight:600;">
      Core
    </span>
  </div>
  
</div>
```

---

## Consistency Benefits

### For Users
- ✅ **Predictable format** - Same structure for all metrics
- ✅ **Quick comprehension** - Know what to expect
- ✅ **No jargon** - Executive-friendly language
- ✅ **Instant context** - Hover for explanation

### For Developers
- ✅ **Reusable pattern** - Copy/paste for new metrics
- ✅ **Easy maintenance** - Update one, update all
- ✅ **Consistent styling** - Same CSS for all tooltips

### For Business
- ✅ **Professional** - Matches institutional standards
- ✅ **Trustworthy** - Clear explanations build confidence
- ✅ **Scalable** - Easy to add new metrics

---

## Tooltip Comparison Table

| Metric | Score Range | Higher Means | Lower Means |
|--------|-------------|--------------|-------------|
| **PE Score** | 1–100 | Stronger fundamentals | Weaker fundamentals |
| **Market Risk** | 0–100 | More macro risk | Less macro risk |
| **Tenant Credit** | 0–100 | Stronger credit (IG) | Weaker credit (non-IG) |
| **Lease Risk** | 0–100 | More exposure | More stability |
| **Asset Quality** | 0–100 | Better condition | Older/specialized |
| **Market Quality** | 0–100 | Tier A metro | Tertiary market |

---

## Mobile Considerations

### Touch Devices
On mobile, tooltips should:
1. **Tap to show** (not hover)
2. **Tap outside to dismiss**
3. **Larger touch targets** (min 44x44px)

**Implementation:**
```javascript
// Add touch support
document.querySelectorAll('.info-icon').forEach(icon => {
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    // Show tooltip
    const tooltip = icon.getAttribute('title');
    alert(tooltip); // Or show custom modal
  });
});
```

---

## Accessibility

### Screen Readers
```html
<span class="info-icon" 
      title="PE Score (1–100) summarizes fundamentals"
      aria-label="Information about PE Score"
      role="button"
      tabindex="0">
  ℹ️
</span>
```

### Keyboard Navigation
```javascript
// Allow keyboard access
icon.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    // Show tooltip
  }
});
```

---

## Testing Checklist

- [ ] All tooltips appear on hover
- [ ] Tooltips are readable (not cut off)
- [ ] Consistent formatting across all metrics
- [ ] Mobile tap works (no hover on touch)
- [ ] Tooltips dismiss properly
- [ ] Screen reader announces content
- [ ] Keyboard navigation works
- [ ] No layout shift when tooltip appears

---

**Generated by RealEstate Deal Agent Enhancement Team**
*Version: 4.0 | Date: 2025-10-04*
*Status: Complete Tooltip Suite ✅*
