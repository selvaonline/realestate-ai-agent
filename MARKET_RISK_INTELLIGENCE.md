# Market Risk Intelligence

Real-time market data integration that combines PE scoring with macro/labor risk analysis for smarter investment decisions.

## 🎯 Overview

The RealEstate Deal Agent now augments its DealSense PE scoring with real-time market risk intelligence:

- **Treasury Rates** (10-Year UST via FRED) - interest rate risk
- **Labor Markets** (Metro unemployment via BLS) - local economic conditions  
- **Risk Score** (0-100) - blended macro/labor risk with analyst notes

This provides investable context even when site extraction fails, delivering:
- **PE Score** - Deal quality from search signals
- **Risk Score** - Market/macro environment context
- **Combined Intelligence** - Know what to buy AND when market conditions are favorable

## 🏗️ Architecture

### 1. Market Data Fetchers (`src/infra/market.ts`)

**FRED 10-Year Treasury (DGS10)**
```typescript
const tenY = await fred10Y(process.env.FRED_API_KEY);
// Returns: { seriesId, date, value: 0.043 (4.3%) }
```

**BLS Metro Unemployment**
```typescript
const bls = await blsMetroUnemp("LAUMT481910000000003", process.env.BLS_API_KEY);
// Returns: { seriesId, latestRate: 3.3, yoyDelta: +0.2, period: "August 2025" }
```

**Smart Caching**
- FRED: 12-hour cache
- BLS: 24-hour cache
- Graceful degradation if keys missing

### 2. Risk Blender Tool (`src/tools/riskBlender.ts`)

Combines multiple signals into a 0-100 Risk Score:

**Inputs:**
- `treasury10yBps` - 10Y Treasury in basis points (e.g., 430 = 4.30%)
- `bls` - Metro unemployment data
- `news` (optional) - Tenant/market news for sentiment analysis

**Scoring Logic:**
```typescript
// Base: 50 (neutral)
// Rates: +20 if 10Y >> 3.5%, -10 if <<
// Labor: +10 if unemployment rising, -5 if falling
// News: ±12 based on negative/positive headlines
```

**Output:**
```json
{
  "riskScore": 58,
  "riskFactors": { "rate": 8, "labor": 1, "news": 0 },
  "riskNote": "10Y ≈ 4.30% (rate +8) · U/E 3.3% (August 2025), ΔYoY +0.2pp (labor +1)"
}
```

### 3. Agent Integration (`src/agent.ts`)

The agent now:
1. **Fetches market data** after PE scoring
2. **Infers metro** from query/results
3. **Computes risk score** for market context
4. **Displays both scores** in UI: PE Score + Risk Score

## 📊 UI Display

### Market Risk Context Banner
```
┌────────────────────────────────────────────────┐
│ 📊 Market Risk Context: 58/100                 │
│ 10Y ≈ 4.30% (rate +8) · U/E 3.3% (August      │
│ 2025), ΔYoY +0.2pp (labor +1)                  │
└────────────────────────────────────────────────┘
```

### Property Cards
```
[1] Costco Shadow Anchored Strip Center
┌──────────────┬──────────────┐
│ PE Score     │ Market Risk  │
│ 94/100       │ 58/100       │
│ Premium      │              │
└──────────────┴──────────────┘
```

## 🔧 Setup

### 1. Get API Keys (Free)

**FRED (Federal Reserve Economic Data)**
1. Visit https://fred.stlouisfed.org/
2. Create free account
3. Request API key (instant)
4. Add to `.env`: `FRED_API_KEY=your_key`

**BLS (Bureau of Labor Statistics)**
1. Visit https://www.bls.gov/developers/
2. Register for free API key
3. Add to `.env`: `BLS_API_KEY=your_key`

### 2. Configure `.env`

```bash
# Market Risk Intelligence (optional - graceful degradation)
FRED_API_KEY=abcd1234...
BLS_API_KEY=xyz789...
```

### 3. Run

```bash
cd orchestrator
npm run dev
```

The agent will:
- ✅ Use market data if keys present
- ✅ Degrade gracefully if keys missing (returns null values)
- ✅ Cache data (12-24h TTL) to minimize API calls

## 📍 Metro Coverage

Currently supports major CRE markets:
- **Texas**: Dallas, Houston, Austin, San Antonio
- **Florida**: Miami, Orlando, Tampa, Jacksonville
- **Southeast**: Atlanta, Charlotte, Raleigh, Nashville
- **Southwest**: Phoenix

Add more metros in `market.ts`:
```typescript
if (/denver|aurora/i.test(text)) return "LAUMT080199000000003"; // Denver-Aurora-Lakewood, CO
```

Full BLS series IDs: https://www.bls.gov/lau/

## 🎯 Value Proposition

### Without Market Risk Intelligence
```
Search → PE Score → "This deal looks good at 94/100"
(But is the market timing right?)
```

### With Market Risk Intelligence
```
Search → PE Score + Risk Score → 
"94/100 deal quality (Premium)
Risk 58/100 - rates elevated at 4.30%, labor stable
→ Strong asset, monitor rate sensitivity"
```

### Real-World Use Case

**Scenario**: NNN retail, 6.5% cap, strong tenant
- **PE Score**: 94/100 (Premium deal quality)
- **Risk Score**: 62/100 (Elevated rate risk)
- **Insight**: "Great asset, but financing costs high. Consider all-cash or wait for rate cuts."

**Scenario**: Multifamily, Miami
- **PE Score**: 78/100 (Investment Grade)
- **Risk Score**: 48/100 (Low rate risk, strong labor)
- **Insight**: "Solid deal in favorable market environment. Go time."

## 🔬 Why This Matters

1. **Context Beyond Listings**: Even when CREXI blocks extraction, you get macro context
2. **Timing Intelligence**: Know when market conditions favor deployment
3. **Risk-Adjusted Returns**: Combine deal quality (PE) with environment (Risk)
4. **Institutional-Grade Analysis**: PGIM/Blackstone teams use this methodology
5. **Defensible Decisions**: "We passed because rates/labor trends suggested waiting"

## 🚀 Future Enhancements

- [ ] **News integration** - Scrape tenant/market news for sentiment
- [ ] **Cap rate surveys** - Quarterly CBRE/JLL data for market comps
- [ ] **Climate risk** - NOAA/First Street flood/heat data
- [ ] **Supply pipeline** - Construction permits for supply risk
- [ ] **Per-deal risk** - Compute risk score per property (tenant-specific news)

## 🎓 Technical Notes

**API Limits:**
- FRED: 120 requests/minute (free tier)
- BLS: 500 requests/day (free tier), 50/day without registration

**Caching Strategy:**
- Global in-memory cache (process lifetime)
- 12h for rates (daily updates sufficient)
- 24h for labor (monthly BLS releases)
- Clear cache: Restart server

**Error Handling:**
- Missing keys → null values, no crash
- API failures → cached data or null
- Network timeouts → graceful fallback

## 📖 References

- FRED API Docs: https://fred.stlouisfed.org/docs/api/fred/
- BLS API Guide: https://www.bls.gov/developers/api_signature_v2.htm
- DealSense PE Model: See `PE_SCORING_IMPLEMENTATION.md`

---

**Last Updated**: 2025-10-01  
**Status**: Production Ready ✅
