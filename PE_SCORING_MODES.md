# DealSense PE Scoring Modes

This Real Estate Deal Agent supports **two scoring modes** to match different investor profiles:

## 🏢 Private Mode (Default)
**Target Audience**: Family offices, private investors, small PE funds (<$500M AUM)

### Characteristics
- **Deal Size**: $1M - $50M sweet spot
- **Strategy**: Opportunistic, value-add, net-lease retail
- **Weights**:
  - Tenant & Lease Quality: 25%
  - Yield vs Benchmark: 20%
  - Market Quality: 20%
  - Asset Fit: 15%
  - Deal Economics: 10%
  - Execution Risk: 10%

### DSCR Assumptions
- LTV: 65%
- Rate: 5.5%
- Min DSCR: 1.20x

### Example Queries
- `"Walgreens NNN in Tampa"`
- `"7-Eleven ground lease Texas under $5M"`
- `"Dollar General single tenant Florida"`

---

## 🏦 Institutional Mode
**Target Audience**: PGIM Real Estate, Blackstone, Brookfield, large pension funds

### Characteristics
- **Deal Size**: $20M - $200M preferred range
- **Strategy**: Core/Core+, institutional-grade tenants, portfolio scale
- **Weights**:
  - Tenant & Lease Quality: **32%** ⬆️ (heavier emphasis on credit quality)
  - Market Quality: **28%** ⬆️ (demographics, growth, institutional comps)
  - Yield vs Benchmark: 20%
  - Asset Fit: 10%
  - Deal Economics: 5%
  - Execution Risk: 5%

### DSCR Assumptions
- LTV: **55%** (more conservative)
- Rate: 5.5%
- Min DSCR: **1.30x** (stricter)

### Deal Size Logic
- **Penalty** for deals < $20M (too small for institutional mandate)
- **Bonus** for deals $20M - $200M (sweet spot)
- **Neutral** for deals > $200M (may require syndication)

### Example Queries
- `"Class A logistics Orlando"`
- `"Distribution center portfolio Dallas"`
- `"Industrial outdoor storage Florida"`
- `"FedEx distribution hub Phoenix"`

---

## 🔀 How to Switch Modes

### In `.env` file:
```bash
# Private mode (default)
PE_MODE=private

# Institutional mode
PE_MODE=institutional
```

### On command line:
```bash
# Run in institutional mode
PE_MODE=institutional npm run dev

# Run in private mode (or omit for default)
PE_MODE=private npm run dev
```

---

## 📊 Scoring Differences Example

**Query**: "Starbucks NNN Tampa"

### Private Mode Output:
```
Score: 78/100
Label: Retail · NNN · STARBUCKS · 6.2% Cap · A
Analysis: Tenant: starbucks (Investment Grade). Cap spread vs 10Y ≈ 1.9%. 
Market tier A. NNN lease structure.
```

### Institutional Mode Output:
```
Score: 82/100
Label: Retail · NNN · STARBUCKS · 6.2% Cap · A
Analysis: Tenant: starbucks (Investment Grade). Cap spread vs 10Y ≈ 1.9%. 
Market tier A. NNN lease structure. Deal size ≈ $4M.

⚠️ Note: Deal size below institutional minimum ($20M) - score adjusted down.
```

---

## 🎯 When to Use Each Mode

### Use **Private Mode** when:
- Targeting individual investors or family offices
- Deal sizes < $20M
- Opportunistic/value-add strategies
- Broader geographic flexibility
- Higher yield tolerance (6-8% caps)

### Use **Institutional Mode** when:
- Presenting to PGIM, Blackstone, etc.
- Deal sizes $20M+
- Core/Core+ strategies only
- Tier A/B markets preferred
- Investment-grade tenants required
- Institutional cap rate expectations (5-6.5%)

---

## 📈 Future Enhancements

Both modes can be enhanced with:
- **Live Treasury rates** (FRED API)
- **Quarterly cap rate surveys** (CBRE, JLL, Cushman & Wakefield)
- **Demographics enrichment** (Census, BLS, Moody's Analytics)
- **Credit ratings** (S&P, Moody's tenant mapping)
- **ESG scoring** (energy efficiency, LEED certification)

These can be added to `pe-config.json` or `pe-config-institutional.json` without code changes.
