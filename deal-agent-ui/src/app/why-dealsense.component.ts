// why-dealsense.component.ts — "Why DealSense Agent?" writeup page
import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-why-dealsense',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <button class="close-btn" (click)="close.emit()">&times;</button>

        <div class="modal-scroll">
          <!-- Hero -->
          <div class="hero">
            <div class="hero-badge">AI Agent for CRE Investment</div>
            <h1 class="hero-title">From deal spreadsheets to<br>investment thesis in 30 seconds</h1>
            <p class="hero-sub">
              I built DealSense — an AI agent that automates the most time-consuming part of
              commercial real estate deal evaluation for Private Equity and institutional investors.
            </p>
          </div>

          <!-- Problem -->
          <div class="section">
            <div class="section-label problem-label">THE PROBLEM</div>
            <h2 class="section-title">CRE analysts are drowning in manual research</h2>
            <p class="section-text">
              Private equity CRE teams evaluate <strong>20-80 deals per month</strong>. Each property requires
              pulling data from <strong>5+ disconnected sources</strong> — CREXi and LoopNet for listings, FRED for
              Treasury rates and yield curves, BLS for metro unemployment, broker decks for comps, and Excel
              models for DCF analysis.
            </p>
            <div class="stats-row">
              <div class="stat-card">
                <div class="stat-number">3-6 hrs</div>
                <div class="stat-label">Per deal for initial screening</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">5+</div>
                <div class="stat-label">Disconnected data sources</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">60%</div>
                <div class="stat-label">Time on data gathering, not analysis</div>
              </div>
            </div>
            <p class="section-text">
              That's <strong>3-6 hours per property</strong> before writing a single paragraph of investment analysis.
              Most of that time isn't spent on judgment calls — it's copying numbers between tabs, reformatting broker
              PDFs, and re-running the same DCF template with different assumptions. The actual alpha — market insight,
              risk assessment, portfolio fit — gets squeezed into whatever time is left.
            </p>
          </div>

          <!-- Solution -->
          <div class="section">
            <div class="section-label solution-label">THE SOLUTION</div>
            <h2 class="section-title">An AI agent that thinks like an institutional analyst</h2>
            <p class="section-text">
              DealSense is a <strong>multi-hop reasoning agent with 11 specialized tools</strong> that an analyst
              accesses through natural language. The agent decides which tools to call based on the query,
              combines results across sources, and produces a verified institutional-grade synthesis.
            </p>
            <p class="section-text">
              It doesn't just search and return listings. It <strong>searches, scores, assesses macro risk,
              runs DCF analysis, finds comps, and synthesizes</strong> — exactly how a senior analyst would
              approach a new market or property.
            </p>
            <div class="workflow-box">
              <div class="workflow-title">Required multi-step workflow (minimum 3 tools per query)</div>
              <div class="workflow-steps">
                <div class="wf-step">
                  <div class="wf-num">1</div>
                  <div class="wf-text"><strong>Search</strong> — 5 CRE marketplaces with deduplication</div>
                </div>
                <div class="wf-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
                <div class="wf-step">
                  <div class="wf-num">2</div>
                  <div class="wf-text"><strong>Score</strong> — 6-factor PE model (100-point scale)</div>
                </div>
                <div class="wf-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
                <div class="wf-step">
                  <div class="wf-num">3</div>
                  <div class="wf-text"><strong>Risk</strong> — Live FRED + BLS macro context</div>
                </div>
                <div class="wf-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
                <div class="wf-step">
                  <div class="wf-num">4</div>
                  <div class="wf-text"><strong>Synthesize</strong> — Actionable recommendation</div>
                </div>
              </div>
            </div>
          </div>

          <!-- What it returns -->
          <div class="section">
            <div class="section-label returns-label">WHAT IT RETURNS</div>
            <h2 class="section-title">Institutional-grade analysis, not just listings</h2>
            <div class="returns-grid">
              <div class="return-item">
                <div class="return-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
                </div>
                <div class="return-text">
                  <strong>PE-Scored Deal Rankings</strong>
                  <span>6-factor scoring: Tenant Quality (25pts), Yield vs Benchmark (20pts), Market Quality (20pts), Asset Fit (15pts), Deal Economics (10pts), Execution Risk (10pts)</span>
                </div>
              </div>
              <div class="return-item">
                <div class="return-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div class="return-text">
                  <strong>Market Risk Score (0-100)</strong>
                  <span>Live FRED data: 10Y Treasury, yield curve, CPI YoY, national + metro unemployment from BLS</span>
                </div>
              </div>
              <div class="return-item">
                <div class="return-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                </div>
                <div class="return-text">
                  <strong>DCF Analysis</strong>
                  <span>Levered IRR, equity multiple, cash-on-cash, annual cash flows, exit valuation with sensitivity grid</span>
                </div>
              </div>
              <div class="return-item">
                <div class="return-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div class="return-text">
                  <strong>Comparable Properties</strong>
                  <span>Same-market, same-type comps with PE scores for relative valuation benchmarking</span>
                </div>
              </div>
              <div class="return-item">
                <div class="return-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div class="return-text">
                  <strong>IC Memorandum</strong>
                  <span>12-section Investment Committee memo with executive summary, risk factors, and Pursue/Monitor/Pass recommendation</span>
                </div>
              </div>
              <div class="return-item">
                <div class="return-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <div class="return-text">
                  <strong>Macro Context</strong>
                  <span>9 economic indicators: Treasury rates, yield curve shape, CPI, unemployment — updated in real time from FRED & BLS</span>
                </div>
              </div>
            </div>
            <p class="section-text callout-text">
              Every recommendation traces back to a data source. The agent never invents cap rates, prices, or financial data.
            </p>
          </div>

          <!-- Data Sources -->
          <div class="section">
            <div class="section-label data-label">DATA SOURCES</div>
            <h2 class="section-title">5 live integrations, no stale data</h2>
            <div class="data-grid">
              <div class="data-item">
                <div class="data-name">CREXi + LoopNet + Brevitas + 2 more</div>
                <div class="data-desc">5 CRE marketplaces with dedup + anti-bot extraction</div>
              </div>
              <div class="data-item">
                <div class="data-name">FRED (Federal Reserve)</div>
                <div class="data-desc">4 series: 10Y Treasury, 2s10 spread, CPI, unemployment</div>
              </div>
              <div class="data-item">
                <div class="data-name">BLS (Bureau of Labor Statistics)</div>
                <div class="data-desc">Metro unemployment for 12 US markets + YoY delta</div>
              </div>
              <div class="data-item">
                <div class="data-name">Dual Search Engine</div>
                <div class="data-desc">Serper API (primary) + Playwright browser fallback</div>
              </div>
              <div class="data-item">
                <div class="data-name">Headless Browser</div>
                <div class="data-desc">WebKit + Chromium with stealth, lease term extraction</div>
              </div>
            </div>
          </div>

          <!-- Engineering -->
          <div class="section">
            <div class="section-label eng-label">THE ENGINEERING</div>
            <h2 class="section-title">Built for institutional reliability</h2>
            <div class="eng-grid">
              <div class="eng-item">
                <div class="eng-label-text">Agentic Loop</div>
                <div class="eng-value">Multi-hop reasoning with 8-hop max depth, parallel tool execution, forced multi-tool analysis</div>
              </div>
              <div class="eng-item">
                <div class="eng-label-text">PE Scoring</div>
                <div class="eng-value">6-factor 100-point model with dual modes (private equity vs institutional), 35 tenant credit tiers, 35+ market tiers</div>
              </div>
              <div class="eng-item">
                <div class="eng-label-text">Risk Model</div>
                <div class="eng-value">6-factor blended scoring: Treasury level, rate trend, curve shape, CPI, labor market, sentiment — with data quality scaling</div>
              </div>
              <div class="eng-item">
                <div class="eng-label-text">MCP Server</div>
                <div class="eng-value">All 11 tools exposed via Model Context Protocol at reagent.selvaonline.com/mcp — plug into Claude, Cursor, or any MCP client</div>
              </div>
              <div class="eng-item">
                <div class="eng-label-text">Browser Automation</div>
                <div class="eng-value">Dual WebKit/Chromium engine with stealth plugin, Bright Data proxy support, anti-bot detection bypass</div>
              </div>
              <div class="eng-item">
                <div class="eng-label-text">Session Memory</div>
                <div class="eng-value">File-based persistence with 16-turn history, portfolio tracking, investment criteria extraction across conversations</div>
              </div>
              <div class="eng-item">
                <div class="eng-label-text">Infrastructure</div>
                <div class="eng-value">AWS CDK — ECS Fargate + ALB + CloudFront + S3, Docker multi-platform builds, Playwright in production</div>
              </div>
              <div class="eng-item">
                <div class="eng-label-text">LLM Cascade</div>
                <div class="eng-value">4-provider fallback: OpenAI (GPT-4o) -> Gemini -> Grok -> Groq, with OpenAI-compatible function calling across all providers</div>
              </div>
            </div>
          </div>

          <!-- Performance -->
          <div class="section">
            <div class="section-label perf-label">PERFORMANCE</div>
            <h2 class="section-title">30 seconds vs 3 hours</h2>
            <div class="perf-comparison">
              <div class="perf-col perf-before">
                <div class="perf-header">Before DealSense</div>
                <div class="perf-list">
                  <div class="perf-row"><span class="perf-time">45 min</span> Search 5 marketplace sites</div>
                  <div class="perf-row"><span class="perf-time">30 min</span> Pull FRED/BLS macro data</div>
                  <div class="perf-row"><span class="perf-time">60 min</span> Build Excel DCF model</div>
                  <div class="perf-row"><span class="perf-time">45 min</span> Find and analyze comps</div>
                  <div class="perf-row"><span class="perf-time">60 min</span> Write IC memo</div>
                  <div class="perf-total">4+ hours per property</div>
                </div>
              </div>
              <div class="perf-vs">vs</div>
              <div class="perf-col perf-after">
                <div class="perf-header">With DealSense</div>
                <div class="perf-list">
                  <div class="perf-row"><span class="perf-time">5s</span> Search + PE score across 5 marketplaces</div>
                  <div class="perf-row"><span class="perf-time">3s</span> Live FRED + BLS risk assessment</div>
                  <div class="perf-row"><span class="perf-time">&lt;1s</span> DCF with sensitivity grid</div>
                  <div class="perf-row"><span class="perf-time">8s</span> Comp analysis with scoring</div>
                  <div class="perf-row"><span class="perf-time">&lt;1s</span> IC memo generation</div>
                  <div class="perf-total perf-total-fast">~30 seconds total</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Stack -->
          <div class="section section-last">
            <div class="section-label stack-label">STACK</div>
            <div class="stack-tags">
              <span class="tag">TypeScript</span>
              <span class="tag">Angular 20</span>
              <span class="tag">Node.js</span>
              <span class="tag">Express</span>
              <span class="tag">OpenAI Function Calling</span>
              <span class="tag">Playwright</span>
              <span class="tag">FRED API</span>
              <span class="tag">BLS API</span>
              <span class="tag">MCP SDK</span>
              <span class="tag">AWS CDK</span>
              <span class="tag">ECS Fargate</span>
              <span class="tag">CloudFront</span>
              <span class="tag">Docker</span>
            </div>
            <div class="built-by">
              Built by <a href="https://www.linkedin.com/in/selvaonline/" target="_blank" rel="noopener">Selvakumar Murugesan</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    .modal {
      background: #ffffff; border-radius: 14px;
      max-width: 800px; width: 100%; max-height: 90vh;
      position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      display: flex; flex-direction: column;
    }
    .modal-scroll {
      overflow-y: auto; padding: 40px 48px;
      scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;
    }
    .close-btn {
      position: absolute; top: 12px; right: 16px;
      background: none; border: none; color: #64748b;
      font-size: 28px; cursor: pointer; z-index: 10;
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      border-radius: 8px;
    }
    .close-btn:hover { background: #f1f5f9; color: #0f172a; }

    /* Hero */
    .hero { text-align: center; margin-bottom: 40px; }
    .hero-badge {
      display: inline-block; padding: 4px 14px; border-radius: 20px;
      background: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 600;
      letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 16px;
    }
    .hero-title {
      font-size: 32px; font-weight: 800; color: #0f172a;
      line-height: 1.2; margin: 0 0 16px;
    }
    .hero-sub {
      font-size: 16px; color: #475569; line-height: 1.6;
      max-width: 600px; margin: 0 auto;
    }

    /* Section */
    .section { margin-bottom: 36px; }
    .section-last { margin-bottom: 0; }
    .section-label {
      display: inline-block; padding: 3px 10px; border-radius: 4px;
      font-size: 11px; font-weight: 700; letter-spacing: 1px;
      text-transform: uppercase; margin-bottom: 12px;
    }
    .problem-label { background: #fef2f2; color: #dc2626; }
    .solution-label { background: #f0fdf4; color: #16a34a; }
    .returns-label { background: #eff6ff; color: #2563eb; }
    .data-label { background: #faf5ff; color: #7c3aed; }
    .eng-label { background: #fefce8; color: #ca8a04; }
    .perf-label { background: #ecfdf5; color: #059669; }
    .stack-label { background: #f1f5f9; color: #475569; }

    .section-title {
      font-size: 22px; font-weight: 700; color: #0f172a;
      margin: 0 0 12px; line-height: 1.3;
    }
    .section-text {
      font-size: 15px; color: #475569; line-height: 1.7; margin: 0 0 16px;
    }
    .callout-text {
      background: #f8fafc; border-left: 3px solid #2563eb;
      padding: 12px 16px; border-radius: 0 8px 8px 0;
      font-style: italic; color: #334155;
    }

    /* Stats Row */
    .stats-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
      margin: 20px 0;
    }
    .stat-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 16px; text-align: center;
    }
    .stat-number {
      font-size: 28px; font-weight: 800; color: #dc2626;
      line-height: 1;
    }
    .stat-label {
      font-size: 12px; color: #64748b; margin-top: 6px; line-height: 1.3;
    }

    /* Workflow */
    .workflow-box {
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;
      padding: 20px; margin-top: 16px;
    }
    .workflow-title {
      font-size: 13px; font-weight: 600; color: #166534;
      margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .workflow-steps {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .wf-step {
      display: flex; align-items: center; gap: 8px;
      background: #ffffff; border-radius: 8px; padding: 8px 12px;
      border: 1px solid #dcfce7;
    }
    .wf-num {
      width: 24px; height: 24px; border-radius: 50%;
      background: #16a34a; color: white; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .wf-text { font-size: 13px; color: #1e293b; }
    .wf-arrow { color: #86efac; flex-shrink: 0; }

    /* Returns Grid */
    .returns-grid { display: flex; flex-direction: column; gap: 14px; margin: 16px 0; }
    .return-item {
      display: flex; gap: 14px; align-items: flex-start;
      padding: 14px; background: #f8fafc; border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .return-icon {
      flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px;
      background: #eff6ff; color: #2563eb;
      display: flex; align-items: center; justify-content: center;
    }
    .return-text { display: flex; flex-direction: column; gap: 4px; }
    .return-text strong { font-size: 14px; color: #0f172a; }
    .return-text span { font-size: 13px; color: #64748b; line-height: 1.5; }

    /* Data Grid */
    .data-grid { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .data-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; background: #faf5ff; border-radius: 8px;
      border: 1px solid #e9d5ff; gap: 16px;
    }
    .data-name { font-size: 14px; font-weight: 600; color: #0f172a; white-space: nowrap; }
    .data-desc { font-size: 13px; color: #64748b; text-align: right; }

    /* Engineering Grid */
    .eng-grid { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .eng-item {
      display: flex; gap: 16px; padding: 12px 16px;
      background: #fffbeb; border-radius: 8px; border: 1px solid #fde68a;
    }
    .eng-label-text {
      font-size: 12px; font-weight: 700; color: #92400e;
      text-transform: uppercase; letter-spacing: 0.5px;
      min-width: 120px; flex-shrink: 0; padding-top: 2px;
    }
    .eng-value { font-size: 13px; color: #475569; line-height: 1.5; }

    /* Performance Comparison */
    .perf-comparison {
      display: flex; align-items: stretch; gap: 16px; margin-top: 16px;
    }
    .perf-col { flex: 1; border-radius: 10px; padding: 20px; }
    .perf-before { background: #fef2f2; border: 1px solid #fecaca; }
    .perf-after { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .perf-header {
      font-size: 14px; font-weight: 700; margin-bottom: 14px;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .perf-before .perf-header { color: #dc2626; }
    .perf-after .perf-header { color: #16a34a; }
    .perf-vs {
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 700; color: #94a3b8;
      flex-shrink: 0;
    }
    .perf-list { display: flex; flex-direction: column; gap: 8px; }
    .perf-row {
      font-size: 13px; color: #475569; display: flex; gap: 10px; align-items: baseline;
    }
    .perf-time {
      font-weight: 700; font-size: 14px; min-width: 50px;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .perf-before .perf-time { color: #dc2626; }
    .perf-after .perf-time { color: #16a34a; }
    .perf-total {
      margin-top: 12px; padding-top: 12px; border-top: 1px solid;
      font-size: 16px; font-weight: 800;
    }
    .perf-before .perf-total { color: #dc2626; border-color: #fecaca; }
    .perf-total-fast { color: #16a34a !important; border-color: #bbf7d0 !important; }

    /* Stack */
    .stack-tags {
      display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;
    }
    .tag {
      padding: 5px 12px; border-radius: 6px; font-size: 13px;
      background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;
      font-weight: 500;
    }
    .built-by {
      margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;
      font-size: 14px; color: #64748b; text-align: center;
    }
    .built-by a {
      color: #2563eb; text-decoration: none; font-weight: 600;
    }
    .built-by a:hover { text-decoration: underline; }

    /* Mobile */
    @media (max-width: 768px) {
      .modal-scroll { padding: 24px 20px; }
      .hero-title { font-size: 24px; }
      .hero-sub { font-size: 14px; }
      .section-title { font-size: 18px; }
      .stats-row { grid-template-columns: 1fr; gap: 10px; }
      .stat-number { font-size: 22px; }
      .workflow-steps { flex-direction: column; align-items: stretch; }
      .wf-arrow { display: none; }
      .data-item { flex-direction: column; text-align: left; gap: 4px; }
      .data-desc { text-align: left; }
      .eng-item { flex-direction: column; gap: 4px; }
      .eng-label-text { min-width: auto; }
      .perf-comparison { flex-direction: column; }
      .perf-vs { padding: 4px 0; }
    }
  `]
})
export class WhyDealsenseComponent {
  @Output() close = new EventEmitter<void>();
}
