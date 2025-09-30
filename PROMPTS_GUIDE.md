# Search Prompts System

## Overview

The RealEstate Deal Agent includes **120 professionally crafted search prompts** that represent real queries from private equity real estate analysts. These prompts are dynamically loaded and displayed in the typing animation.

## 📁 Location

**Prompts File:** `deal-agent-ui/src/assets/search-prompts.json`

## 📊 Categories (12 Total)

| Category | Count | Description |
|----------|-------|-------------|
| **retail_nnn** | 10 | Single-tenant net lease retail (CVS, Walgreens, 7-Eleven, etc.) |
| **multifamily** | 10 | Apartments, student housing, senior living, workforce housing |
| **office** | 10 | Medical office, Class A, single-tenant, flex office |
| **industrial** | 10 | Distribution centers, warehouses, logistics, manufacturing |
| **retail_centers** | 10 | Shopping centers, power centers, strip malls, outlet malls |
| **hospitality** | 10 | Hotels, resorts, extended-stay, boutique properties |
| **specialty** | 10 | Self-storage, car washes, gas stations, fitness centers |
| **development** | 10 | Entitled land, ground-up development, mixed-use sites |
| **value_add** | 10 | Distressed assets, renovations, lease-up, repositioning |
| **core_plus** | 10 | Institutional-quality, stabilized NOI, trophy assets |
| **market_specific** | 10 | Geographic-focused (Dallas, Austin, Phoenix, etc.) |
| **alternative** | 10 | Life science, medical, SNF, dialysis, cannabis |

**Total:** 120 unique prompts

## 🎨 How It Works

### 1. File Structure

```json
{
  "categories": {
    "retail_nnn": [
      "Find single-tenant NNN retail...",
      "CVS pharmacy properties..."
    ],
    "multifamily": [
      "Garden-style apartments...",
      "Class B multifamily..."
    ]
  },
  "meta": {
    "total_prompts": 120,
    "last_updated": "2025-09-30"
  }
}
```

### 2. Loading Process

```typescript
// In app.ts constructor
this.loadPrompts();

private async loadPrompts() {
  const data = await fetch('/assets/search-prompts.json');
  this.allPrompts = Object.values(data.categories).flat(); // 120 prompts
  this.exampleQueries = this.getRandomPrompts(20);        // Random 20
  this.startTypingAnimation();
}
```

### 3. Typing Animation

- **Randomly selects 20 prompts** from the 120 available
- **Cycles through** them with typing/deleting animation
- **User can click Search** to use the currently displayed prompt
- **Refreshes on page reload** - different random selection each time

## ✏️ Adding New Prompts

### Option 1: Edit JSON Directly

```json
{
  "categories": {
    "retail_nnn": [
      "Your new prompt here",
      "Another new prompt"
    ]
  }
}
```

### Option 2: Add New Category

```json
{
  "categories": {
    "healthcare": [
      "Surgery centers ASC multi-specialty, physician-owned",
      "Urgent care clinics corporate-backed, cap rate 7-8%",
      "Dental offices DSO tenant, long-term NNN lease"
    ]
  }
}
```

### Option 3: Programmatic Generation

Create a script to generate prompts:

```typescript
// scripts/generate-prompts.ts
const tenants = ['CVS', 'Walgreens', 'Rite Aid'];
const markets = ['Dallas', 'Austin', 'Phoenix'];
const prompts = [];

for (const tenant of tenants) {
  for (const market of markets) {
    prompts.push(`${tenant} pharmacy properties in ${market}, NNN lease`);
  }
}
```

## 🎯 Prompt Best Practices

### Good Prompts Include:

✅ **Property Type** - "Medical office building" not just "office"  
✅ **Location** - "Dallas-Fort Worth" or "Sun Belt markets"  
✅ **Financial Metrics** - "cap rate 6-8%", "under $20M", "NOI $500K+"  
✅ **Tenant Quality** - "investment grade", "Fortune 500", "corporate guarantee"  
✅ **Deal Specifics** - "value-add", "stabilized", "lease-up", "distressed"  

### Examples:

**❌ Bad:**
```
"Find retail properties"
"Office buildings for sale"
```

**✅ Good:**
```
"Find single-tenant NNN retail in Dallas, 4–6% cap, price $4M–$6M"
"Medical office buildings with hospital affiliation, cap rate 6-8%"
```

## 📈 Analytics

Track which prompts users actually search:

```typescript
// In run() method
console.log('[analytics] Query:', query);
// Send to analytics service
```

## 🔄 Dynamic Updates

### Update Prompts Without Redeploying

1. Host `search-prompts.json` on a CDN
2. Update `fetch()` URL to CDN endpoint
3. Add cache-busting: `?v=${Date.now()}`
4. Prompts update instantly for all users

```typescript
const response = await fetch('https://cdn.yoursite.com/search-prompts.json?v=' + Date.now());
```

## 🎲 Randomization Strategy

**Current:** Fully random 20 prompts  
**Alternative:** Weighted by category

```typescript
private getRandomPrompts(count: number): string[] {
  const weights = {
    retail_nnn: 0.3,      // 30% chance
    multifamily: 0.2,     // 20% chance
    office: 0.15,         // 15% chance
    // ... etc
  };
  
  // Weighted random selection
  return weightedSample(this.allPrompts, count, weights);
}
```

## 🌍 Localization

Add multi-language support:

```json
{
  "en": {
    "categories": { "retail_nnn": [...] }
  },
  "es": {
    "categories": { "retail_nnn": ["Propiedades farmacia CVS..."] }
  }
}
```

## 🚀 Advanced Features

### 1. Prompt Templates

```json
{
  "templates": {
    "nnn_retail": "{tenant} {property_type} in {market}, cap rate {cap_min}-{cap_max}%"
  },
  "variables": {
    "tenant": ["CVS", "Walgreens", "7-Eleven"],
    "market": ["Dallas", "Austin", "Phoenix"]
  }
}
```

### 2. User-Generated Prompts

Allow users to save their searches:

```typescript
savePrompt(query: string) {
  const userPrompts = JSON.parse(localStorage.getItem('user_prompts') || '[]');
  userPrompts.push(query);
  localStorage.setItem('user_prompts', JSON.stringify(userPrompts));
}
```

### 3. Trending Prompts

Track most popular queries:

```json
{
  "trending": [
    { "prompt": "CVS pharmacy Dallas", "count": 1250 },
    { "prompt": "Medical office 7% cap", "count": 890 }
  ]
}
```

## 📊 Stats

```
Total Prompts:     120
Categories:        12
Avg Length:        62 characters
Coverage:          All major CRE asset classes
Update Frequency:  Monthly (recommended)
```

## 🛠️ Maintenance

**Monthly Tasks:**
- [ ] Review new market trends
- [ ] Add prompts for hot markets
- [ ] Remove outdated queries
- [ ] Update cap rate ranges
- [ ] Add new tenant types

**Quarterly Tasks:**
- [ ] Analyze which prompts users actually search
- [ ] A/B test different prompt styles
- [ ] Survey users for desired searches
- [ ] Competitive analysis (Perplexity, ChatGPT prompts)

---

**Last Updated:** 2025-09-30  
**Maintainer:** Real Estate Deal Agent Team  
**Version:** 1.0
