# 🚀 Comet Browser Agent - 3-Phase Rollout Plan

## Executive Summary

The Comet Browser Agent transforms your RealEstate Deal Agent from **reactive** (on-demand) to **proactive** (always-on), making it behave like a junior analyst who monitors markets 24/7.

**Key Value**: Eliminates missed deals, provides historical trends, reduces analyst workload by 1-2 hours/day, and makes your product "sticky" through daily engagement.

---

## 📊 Why Comet is Worth It

### Business Impact:
- **Zero missed opportunities** - Runs searches hourly, alerts on new listings
- **Tangible ROI** - Saves 1-2 hours/day per analyst
- **Sticky product** - Daily Slack/email alerts drive recurring engagement
- **Enterprise appeal** - "Always-on" feels like Bloomberg terminals

### Technical Advantages:
- **90% of pieces already exist** - SERPER, extractors, PE/Risk scorers, webhooks
- **Low complexity** - Just orchestrates existing tools on a schedule
- **Time-series data** - Historical snapshots enable trend analysis
- **Minimal infra** - Redis + simple file storage

---

## 🎯 3-Phase Rollout Plan

### **Phase 1: MVP (Week 1-2)** - Prove the Concept
**Goal**: Get one watchlist running with Slack alerts

#### Features:
- ✅ Single hardcoded watchlist (e.g., "MOB Florida, 6-8% cap")
- ✅ Runs every hour (cron)
- ✅ Searches → Scores → Diffs → Alerts
- ✅ File-based snapshot storage (.comet/ directory)
- ✅ Slack webhook notifications
- ✅ Basic logging

#### Implementation:
```typescript
// watchlists.json (hardcoded)
[{
  "id": "mob-florida",
  "query": "medical office building Florida 6-8% cap rate",
  "minScore": 70,
  "schedule": "0 * * * *"  // hourly
}]

// Simple cron + worker
- node-cron schedules job
- Worker: search → score → diff → notify
- Store: JSON files in .comet/
- Alert: Slack webhook
```

#### Deliverables:
- [ ] `comet/scheduler.ts` - Cron scheduler
- [ ] `comet/worker.ts` - Search + score + diff logic
- [ ] `comet/store.ts` - File-based snapshots
- [ ] `integrations/slack.ts` - Slack webhook
- [ ] `watchlists.json` - Single watchlist config

#### Success Metrics:
- Runs hourly without crashes
- Sends Slack alert when new listing appears
- Diff correctly identifies new vs changed

**Effort**: 2-3 days
**Risk**: Low (all pieces exist)

---

### **Phase 2: Production (Week 3-4)** - Scale & Polish
**Goal**: Multiple watchlists, UI integration, better storage

#### Features:
- ✅ Multiple watchlists (3-5 different queries)
- ✅ Redis + BullMQ for job queue
- ✅ Postgres/SQLite for snapshots (replace files)
- ✅ UI toast notifications ("2 new MOB listings")
- ✅ Watchlist management page (view status, last run)
- ✅ Email alerts (optional, in addition to Slack)
- ✅ Error handling & retry logic

#### Implementation:
```typescript
// Architecture
Redis (BullMQ) → Worker Pool → Postgres
     ↓                ↓            ↓
Scheduler        Extractors    Snapshots
     ↓                ↓            ↓
Watchlists      PE/Risk       Diffs
                               ↓
                    Alerts (Slack/Email/SSE)
```

#### New Components:
- [ ] `comet/queue.ts` - BullMQ setup
- [ ] `comet/db.ts` - Postgres schema & queries
- [ ] `routes/watchlists.ts` - CRUD API
- [ ] `ui/watchlists-page.tsx` - Management UI
- [ ] `comet/notifier.ts` - Multi-channel alerts

#### Database Schema:
```sql
CREATE TABLE watchlists (
  id TEXT PRIMARY KEY,
  label TEXT,
  query TEXT,
  min_score INT,
  risk_max INT,
  schedule TEXT,
  last_run TIMESTAMP,
  created_at TIMESTAMP
);

CREATE TABLE snapshots (
  id SERIAL PRIMARY KEY,
  watchlist_id TEXT REFERENCES watchlists(id),
  url TEXT,
  score INT,
  risk INT,
  data JSONB,
  captured_at TIMESTAMP
);

CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  watchlist_id TEXT,
  type TEXT, -- 'new' | 'changed'
  url TEXT,
  sent_at TIMESTAMP
);
```

#### Success Metrics:
- 5 watchlists running reliably
- UI shows last run time + new count
- Alerts sent within 5 min of detection
- 99% uptime over 1 week

**Effort**: 1-2 weeks
**Risk**: Medium (new infra: Redis, Postgres)

---

### **Phase 3: Enterprise (Week 5-8)** - Advanced Features
**Goal**: Historical analytics, adaptive scheduling, feedback loop

#### Features:
- ✅ Historical trend charts (cap rate, price, volume)
- ✅ Portfolio heatmap (supply by metro/sector)
- ✅ Adaptive scheduling (run more often when market active)
- ✅ User feedback loop ("mark as relevant/spam")
- ✅ Watchlist templates (pre-built for common searches)
- ✅ Export to Excel/PDF
- ✅ Team collaboration (comments, shared watchlists)

#### Implementation:
```typescript
// Historical Analytics
- Time-series queries on snapshots table
- Chart.js visualizations
- MoM/YoY comparisons

// Adaptive Scheduling
- Track hit rate per watchlist
- Increase frequency if high activity
- Decrease if no new results

// Feedback Loop
- User marks alerts as relevant/spam
- Adjust PE/Risk thresholds
- Train custom scoring model
```

#### New Components:
- [ ] `analytics/trends.ts` - Time-series analysis
- [ ] `analytics/heatmap.ts` - Geographic visualization
- [ ] `comet/adaptive.ts` - Dynamic scheduling
- [ ] `feedback/collector.ts` - User feedback API
- [ ] `ui/analytics-dashboard.tsx` - Charts & insights

#### Success Metrics:
- Users view trend charts weekly
- Adaptive scheduling reduces noise by 30%
- Feedback improves relevance score by 20%
- 10+ active watchlists per user

**Effort**: 3-4 weeks
**Risk**: Medium-High (ML/analytics complexity)

---

## 🔧 Technical Stack

### Core Infrastructure:
- **Queue**: BullMQ + Redis (job scheduling)
- **Storage**: Postgres (snapshots, alerts, feedback)
- **Scheduler**: node-cron (triggers jobs)
- **Browser**: Playwright (extraction)
- **Notifications**: Slack, Teams, Email, SSE

### Existing Components (Reuse):
- ✅ SERPER search
- ✅ Multi-domain extractors
- ✅ PE/Risk scorers
- ✅ Slack/Teams webhooks
- ✅ SSE for UI updates

### New Dependencies:
```json
{
  "bullmq": "^5.0.0",
  "ioredis": "^5.3.0",
  "node-cron": "^3.0.3",
  "pg": "^8.11.0",
  "nodemailer": "^6.9.0"
}
```

---

## 🔒 Security & Auth (PoC-Friendly)

### Phase 1 (MVP):
**Option A**: Access Code (simplest)
```typescript
// .env
ACCESS_CODE=demo-secret-2025

// Client sends header
headers: { "x-access-code": "demo-secret-2025" }
```

**Option B**: Basic Auth
```typescript
// .env
BASIC_USER=demo
BASIC_PASS=secure123

// Browser prompts once per session
```

### Phase 2 (Production):
- Add rate limiting (60 req/min)
- Lock CORS to UI domain
- HTTPS only
- Mask API keys in logs

### Phase 3 (Enterprise):
- Auth0/Clerk for user login
- Multi-tenant isolation
- SSO (Okta/Azure AD)
- Audit logging

---

## 📈 Effort vs Impact Matrix

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Background search & diff | ⭐⭐ | 🔥🔥🔥 | P0 |
| Slack/Teams notifications | ⭐ | 🔥🔥🔥 | P0 |
| UI toast ("new results") | ⭐⭐ | 🔥🔥 | P1 |
| Multiple watchlists | ⭐⭐ | 🔥🔥 | P1 |
| Postgres storage | ⭐⭐ | 🔥 | P1 |
| Historical trend charts | ⭐⭐⭐ | 💎💎 | P2 |
| Adaptive scheduling | ⭐⭐⭐ | 💎 | P2 |
| Feedback loop | ⭐⭐⭐ | 💎 | P2 |

---

## 🎯 Success Criteria

### Phase 1 (MVP):
- [ ] 1 watchlist runs hourly for 1 week
- [ ] Sends Slack alert on new listing
- [ ] Zero false positives
- [ ] Diff accuracy > 95%

### Phase 2 (Production):
- [ ] 5+ watchlists running reliably
- [ ] UI shows real-time status
- [ ] 99% uptime
- [ ] < 5 min alert latency

### Phase 3 (Enterprise):
- [ ] 10+ active watchlists per user
- [ ] Historical charts viewed weekly
- [ ] 30% noise reduction via adaptive scheduling
- [ ] 20% relevance improvement via feedback

---

## 💡 Quick Wins (Immediate Value)

### Week 1:
- **Proactive alerts**: "2 new Walgreens NNN deals ≥ 70 PE Score"
- **Demo appeal**: Clients love "always-on" agents

### Week 3:
- **Historical trendlines**: "Cap rates in FL MOB listings up 20 bps MoM"
- **UI feels alive**: "MOB Florida — 2 new · 1 updated"

### Week 6:
- **Portfolio heatmap**: Live supply map by metro/sector
- **Tangible ROI**: Saves 1-2 hours/day per analyst

---

## 🚀 Deployment Strategy

### Phase 1 (MVP):
1. Deploy to staging with single watchlist
2. Test for 3 days
3. Add 2nd watchlist
4. Demo to internal team
5. Deploy to production

### Phase 2 (Production):
1. Set up Redis + Postgres
2. Migrate file snapshots to DB
3. Deploy queue workers
4. Add UI components
5. Beta test with 3-5 users

### Phase 3 (Enterprise):
1. Build analytics dashboard
2. Implement adaptive scheduling
3. Add feedback collection
4. Scale to 50+ users
5. Enterprise sales ready

---

## 📊 Cost Estimate

### Infrastructure (Monthly):
- **Redis**: $10-30 (Upstash/Redis Cloud)
- **Postgres**: $25-50 (Supabase/Render)
- **Compute**: $20-50 (Render/Railway)
- **Total**: ~$55-130/month

### Development Time:
- **Phase 1**: 2-3 days (1 developer)
- **Phase 2**: 1-2 weeks (1 developer)
- **Phase 3**: 3-4 weeks (1-2 developers)
- **Total**: 6-8 weeks

---

## ✅ Recommendation

**Start with Phase 1 MVP** (2-3 days):
- Proves the concept with minimal investment
- Gets Slack alerts working immediately
- Validates user interest before scaling
- Low risk, high learning

**Then decide**:
- If users love it → Phase 2 (production-ready)
- If lukewarm → iterate on features first
- If not valuable → pivot to other priorities

---

## 🎓 Learning Resources

### BullMQ (Job Queue):
- Docs: https://docs.bullmq.io/
- Tutorial: https://blog.logrocket.com/bullmq-task-queue-node/

### Node-Cron (Scheduler):
- Docs: https://www.npmjs.com/package/node-cron
- Cron syntax: https://crontab.guru/

### Diff Algorithms:
- Simple: URL-based dedup
- Advanced: Levenshtein distance for text changes

---

## 📝 Next Steps

1. **Review this roadmap** with your team
2. **Prioritize Phase 1 features** based on user feedback
3. **Set up development environment** (Redis, Postgres)
4. **Build MVP** (2-3 days)
5. **Demo to users** and gather feedback
6. **Iterate** based on results

---

**Status**: Ready to implement
**Estimated Timeline**: 6-8 weeks (all 3 phases)
**Recommended Start**: Phase 1 MVP (2-3 days)

🚀 **This upgrade transforms your product from demo to enterprise platform!**
