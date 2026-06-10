// how-it-works.component.ts — "How DealSense AI Agent Works" page
import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <button class="close-btn" (click)="close.emit()">&times;</button>

        <div class="modal-scroll">
          <!-- Hero -->
          <div class="hero">
            <div class="hero-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/>
                <path d="M9 21h6M10 17v4M14 17v4"/>
              </svg>
            </div>
            <h2 class="hero-title">How DealSense AI Agent Works</h2>
            <p class="hero-sub">A multi-hop reasoning engine that thinks, plans, and acts like an institutional CRE analyst.</p>
          </div>

          <!-- Architecture Diagram -->
          <div class="section">
            <h3 class="section-title">Architecture Overview</h3>
            <div class="arch-diagram">
              <div class="arch-row">
                <div class="arch-box user-box">
                  <div class="arch-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <span>Your Query</span>
                </div>
                <div class="arch-arrow">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
                <div class="arch-box llm-box">
                  <div class="arch-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg>
                  </div>
                  <span>LLM Planner</span>
                </div>
                <div class="arch-arrow">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
                <div class="arch-box tool-box">
                  <div class="arch-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                  </div>
                  <span>12 Tools</span>
                </div>
              </div>
              <div class="arch-loop">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                <span>Multi-hop reasoning loop (up to 8 iterations)</span>
              </div>
            </div>
          </div>

          <!-- Before/After -->
          <div class="section">
            <h3 class="section-title">What Changed</h3>
            <div class="comparison">
              <div class="compare-card before">
                <div class="compare-badge">Before</div>
                <div class="compare-title">Fixed Pipeline</div>
                <div class="compare-steps">
                  <div class="cstep">1. Search listings</div>
                  <div class="cstep">2. PE Score</div>
                  <div class="cstep">3. Fetch macro data</div>
                  <div class="cstep">4. Risk score</div>
                  <div class="cstep">5. Return HTML cards</div>
                </div>
                <div class="compare-note">Same steps every time, no reasoning</div>
              </div>
              <div class="compare-card after">
                <div class="compare-badge">After</div>
                <div class="compare-title">AI Agent</div>
                <div class="compare-steps">
                  <div class="cstep">1. LLM plans approach</div>
                  <div class="cstep">2. Selects relevant tools</div>
                  <div class="cstep">3. Executes & evaluates</div>
                  <div class="cstep">4. Iterates if needed</div>
                  <div class="cstep">5. Synthesizes analysis</div>
                </div>
                <div class="compare-note">Adapts to each query intelligently</div>
              </div>
            </div>
          </div>

          <!-- Tool Registry -->
          <div class="section">
            <h3 class="section-title">Tool Registry (12 Tools)</h3>
            <div class="tools-grid">
              <div class="tool-card" *ngFor="let tool of tools">
                <div class="tool-header">
                  <span class="tool-icon-badge" [style.background]="tool.color">{{ tool.icon }}</span>
                  <span class="tool-name">{{ tool.name }}</span>
                  <span class="tool-cat" [style.color]="tool.color">{{ tool.category }}</span>
                </div>
                <div class="tool-desc">{{ tool.description }}</div>
              </div>
            </div>
          </div>

          <!-- Reasoning Loop -->
          <div class="section">
            <h3 class="section-title">Multi-Hop Reasoning Loop</h3>
            <div class="loop-diagram">
              <div class="loop-step" *ngFor="let step of loopSteps; let i = index">
                <div class="loop-number">{{ i + 1 }}</div>
                <div class="loop-body">
                  <div class="loop-title">{{ step.title }}</div>
                  <div class="loop-desc">{{ step.desc }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Key Features -->
          <div class="section">
            <h3 class="section-title">Key Capabilities</h3>
            <div class="features-grid">
              <div class="feature-card" *ngFor="let f of features">
                <div class="feature-icon">{{ f.icon }}</div>
                <div class="feature-title">{{ f.title }}</div>
                <div class="feature-desc">{{ f.desc }}</div>
              </div>
            </div>
          </div>

          <!-- Session Memory -->
          <div class="section">
            <h3 class="section-title">Session Memory & Learning</h3>
            <div class="memory-info">
              <div class="memory-card">
                <div class="mem-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </div>
                <div class="mem-body">
                  <div class="mem-title">Conversation History</div>
                  <div class="mem-desc">Remembers past searches, recommendations, and follow-up questions across the entire session.</div>
                </div>
              </div>
              <div class="memory-card">
                <div class="mem-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
                </div>
                <div class="mem-body">
                  <div class="mem-title">Investment Criteria Extraction</div>
                  <div class="mem-desc">Automatically learns your preferences (property types, markets, cap rate ranges, tenant preferences) from conversation.</div>
                </div>
              </div>
              <div class="memory-card">
                <div class="mem-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                </div>
                <div class="mem-body">
                  <div class="mem-title">Portfolio Tracking</div>
                  <div class="mem-desc">Saves deals to your portfolio with PE scores, risk assessments, and market data for later review and comparison.</div>
                </div>
              </div>
              <div class="memory-card">
                <div class="mem-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M16 2v20M2 12h20"/></svg>
                </div>
                <div class="mem-body">
                  <div class="mem-title">Persistent Sessions</div>
                  <div class="mem-desc">Sessions are saved to disk and survive server restarts. Pick up exactly where you left off.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Example Query -->
          <div class="section">
            <h3 class="section-title">Example: Multi-Hop Query</h3>
            <div class="example-box">
              <div class="example-query">"Find NNN Walgreens in Texas under $5M with 6%+ cap rate"</div>
              <div class="example-hops">
                <div class="ehop">
                  <span class="ehop-n">Hop 1</span>
                  <span class="ehop-tool">search_properties</span>
                  <span class="ehop-desc">Searches CREXi, LoopNet, Brevitas for NNN Walgreens TX</span>
                </div>
                <div class="ehop">
                  <span class="ehop-n">Hop 2</span>
                  <span class="ehop-tool">assess_risk</span>
                  <span class="ehop-desc">Fetches FRED 10Y Treasury + BLS metro unemployment for Texas markets</span>
                </div>
                <div class="ehop">
                  <span class="ehop-n">Hop 3</span>
                  <span class="ehop-tool">filter_and_rank</span>
                  <span class="ehop-desc">Applies price &lt; $5M and cap rate &gt; 6% filters, ranks by PE score</span>
                </div>
                <div class="ehop">
                  <span class="ehop-n">Hop 4</span>
                  <span class="ehop-tool">analyze_traffic_patterns</span>
                  <span class="ehop-desc">Analyze Real-World Activity — Mobility Score 82/100, trend Increasing</span>
                </div>
                <div class="ehop">
                  <span class="ehop-n">Hop 5</span>
                  <span class="ehop-tool">run_dcf</span>
                  <span class="ehop-desc">Runs DCF on top 3 deals: IRR, equity multiple, cash-on-cash</span>
                </div>
                <div class="ehop final">
                  <span class="ehop-n">Hop 6</span>
                  <span class="ehop-tool">Synthesis</span>
                  <span class="ehop-desc">LLM combines all data into recommendation: Pursue / Monitor / Pass</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      animation: fade-in 0.2s ease;
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .modal {
      background: #fff;
      border-radius: 16px;
      max-width: 840px;
      width: 95%;
      max-height: 90vh;
      position: relative;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-scroll {
      padding: 40px;
      overflow-y: auto;
      max-height: 90vh;
    }
    .close-btn {
      position: absolute;
      top: 16px; right: 16px;
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #6b7280;
      z-index: 1;
      width: 36px; height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.15s;
    }
    .close-btn:hover {
      background: #f3f4f6;
    }

    /* Hero */
    .hero {
      text-align: center;
      margin-bottom: 36px;
    }
    .hero-icon {
      width: 80px; height: 80px;
      border-radius: 20px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .hero-title {
      font-size: 28px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 8px;
    }
    .hero-sub {
      font-size: 16px;
      color: #6b7280;
      margin: 0;
      max-width: 500px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* Sections */
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }

    /* Architecture Diagram */
    .arch-diagram {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
    }
    .arch-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .arch-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
    }
    .arch-icon {
      width: 32px; height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-box { background: #dbeafe; color: #1e40af; }
    .user-box .arch-icon { background: #93c5fd; color: #1e3a8a; }
    .llm-box { background: #ede9fe; color: #5b21b6; }
    .llm-box .arch-icon { background: #c4b5fd; color: #4c1d95; }
    .tool-box { background: #fef3c7; color: #92400e; }
    .tool-box .arch-icon { background: #fcd34d; color: #78350f; }
    .arch-arrow {
      color: #9ca3af;
    }
    .arch-loop {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      padding: 10px 20px;
      background: #f0fdf4;
      border: 1px dashed #86efac;
      border-radius: 8px;
      font-size: 13px;
      color: #166534;
    }

    /* Before/After Comparison */
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 640px) {
      .comparison { grid-template-columns: 1fr; }
    }
    .compare-card {
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }
    .compare-card.before {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .compare-card.after {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .compare-badge {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .before .compare-badge { color: #dc2626; }
    .after .compare-badge { color: #16a34a; }
    .compare-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 12px;
    }
    .compare-steps {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cstep {
      font-size: 13px;
      color: #4b5563;
      padding: 4px 0;
    }
    .compare-note {
      margin-top: 12px;
      font-size: 12px;
      font-style: italic;
      color: #6b7280;
    }

    /* Tools Grid */
    .tools-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    @media (max-width: 640px) {
      .tools-grid { grid-template-columns: 1fr; }
    }
    .tool-card {
      padding: 12px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: white;
    }
    .tool-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .tool-icon-badge {
      width: 24px; height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: white;
    }
    .tool-name {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }
    .tool-cat {
      font-size: 10px;
      font-weight: 500;
      margin-left: auto;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .tool-desc {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
    }

    /* Loop Diagram */
    .loop-diagram {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .loop-step {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .loop-number {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .loop-body {
      flex: 1;
      padding-top: 4px;
    }
    .loop-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    .loop-desc {
      font-size: 13px;
      color: #6b7280;
      margin-top: 2px;
    }

    /* Features Grid */
    .features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 640px) {
      .features-grid { grid-template-columns: 1fr 1fr; }
    }
    .feature-card {
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      text-align: center;
      background: white;
      transition: box-shadow 0.15s;
    }
    .feature-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .feature-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .feature-title {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .feature-desc {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
    }

    /* Memory Section */
    .memory-info {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .memory-card {
      display: flex;
      gap: 14px;
      padding: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: white;
    }
    .mem-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      background: #ede9fe;
      color: #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .mem-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    .mem-desc {
      font-size: 12px;
      color: #6b7280;
      margin-top: 2px;
      line-height: 1.4;
    }

    /* Example Box */
    .example-box {
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
    }
    .example-query {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      background: white;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      margin-bottom: 16px;
      font-style: italic;
    }
    .example-hops {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ehop {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .ehop.final {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .ehop-n {
      font-size: 11px;
      font-weight: 700;
      color: #6366f1;
      min-width: 45px;
    }
    .ehop-tool {
      font-size: 12px;
      font-weight: 600;
      color: #111827;
      font-family: 'SF Mono', 'Fira Code', monospace;
      background: #f3f4f6;
      padding: 2px 8px;
      border-radius: 4px;
      min-width: 120px;
    }
    .ehop-desc {
      font-size: 12px;
      color: #6b7280;
    }

    @media (max-width: 768px) {
      .modal { width: 100%; max-height: 100vh; border-radius: 0; }
      .modal-scroll { padding: 20px; max-height: 100vh; }
      .hero { margin-bottom: 24px; }
      .hero-icon { width: 60px; height: 60px; border-radius: 14px; }
      .hero-icon svg { width: 36px; height: 36px; }
      .hero-title { font-size: 22px; }
      .hero-sub { font-size: 14px; }
      .section { margin-bottom: 24px; }
      .section-title { font-size: 16px; }
      .arch-diagram { padding: 16px; }
      .arch-row { flex-direction: column; align-items: stretch; }
      .arch-arrow { transform: rotate(90deg); align-self: center; }
      .arch-box { justify-content: center; padding: 10px 16px; font-size: 13px; }
      .arch-loop { flex-direction: column; text-align: center; padding: 10px 12px; font-size: 12px; }
      .compare-card { padding: 14px; }
      .compare-title { font-size: 14px; }
      .cstep { font-size: 12px; }
      .tool-card { padding: 10px 12px; }
      .tool-name { font-size: 12px; }
      .tool-desc { font-size: 11px; }
      .loop-step { padding: 10px 12px; font-size: 12px; }
      .loop-num { width: 22px; height: 22px; font-size: 11px; }
      .feature-card { padding: 12px; }
      .feature-title { font-size: 13px; }
      .feature-desc { font-size: 11px; }
      .example-hops { gap: 8px; padding: 12px; }
      .ehop { flex-direction: column; gap: 2px; align-items: flex-start; }
      .ehop-num { min-width: auto; font-size: 11px; }
      .ehop-tool { min-width: auto; font-size: 11px; }
      .ehop-desc { font-size: 11px; }
      .close-btn { top: 10px; right: 10px; width: 32px; height: 32px; font-size: 24px; }
    }
    @media (max-width: 480px) {
      .modal-scroll { padding: 16px; }
      .hero-title { font-size: 18px; }
      .hero-sub { font-size: 13px; }
      .section-title { font-size: 15px; }
      .features-grid { grid-template-columns: 1fr !important; }
    }
  `]
})
export class HowItWorksComponent {
  @Output() close = new EventEmitter<void>();

  tools = [
    { name: 'search_properties', description: 'Search CRE listings across CREXi, LoopNet, Brevitas with PE scoring', icon: 'S', color: '#3b82f6', category: 'search' },
    { name: 'score_deals', description: 'Apply 6-factor PE scoring model to property listings', icon: 'P', color: '#8b5cf6', category: 'analysis' },
    { name: 'assess_risk', description: 'Compute 0-100 market risk score using FRED/BLS data', icon: 'R', color: '#ef4444', category: 'market' },
    { name: 'get_macro_data', description: 'Fetch raw FRED Treasury rates and BLS unemployment', icon: 'M', color: '#f59e0b', category: 'market' },
    { name: 'analyze_property_url', description: 'Extract property details via browser automation', icon: 'A', color: '#10b981', category: 'analysis' },
    { name: 'run_dcf', description: 'DCF analysis: IRR, equity multiple, cash flows, sensitivity', icon: 'D', color: '#6366f1', category: 'analysis' },
    { name: 'generate_memo', description: 'Generate investment committee memorandum', icon: 'G', color: '#ec4899', category: 'document' },
    { name: 'comp_analysis', description: 'Find comparable properties in same market/type', icon: 'C', color: '#14b8a6', category: 'analysis' },
    { name: 'filter_and_rank', description: 'Apply natural language filters and rank results', icon: 'F', color: '#f97316', category: 'portfolio' },
    { name: 'market_deep_dive', description: 'Comprehensive market intelligence for a metro', icon: 'I', color: '#0ea5e9', category: 'market' },
    { name: 'portfolio_review', description: 'Analyze saved portfolio for concentration and gaps', icon: 'V', color: '#84cc16', category: 'portfolio' },
    { name: 'analyze_traffic_patterns', description: 'Estimate foot traffic, parking utilization, road traffic, and nearby anchor strength for a property', icon: 'L', color: '#0d9488', category: 'location' },
  ];

  loopSteps = [
    { title: 'Build Context', desc: 'System prompt defines CRE analyst persona. Session history and investment criteria are loaded.' },
    { title: 'LLM Plans', desc: 'The LLM analyzes the user query and decides which tools to call, potentially multiple per hop.' },
    { title: 'Tool Execution', desc: 'Non-browser tools run in parallel; browser tools run sequentially to avoid resource contention.' },
    { title: 'Evaluate Results', desc: 'Tool outputs are summarized and fed back to the LLM. It decides: enough data, or another hop?' },
    { title: 'Iterate or Synthesize', desc: 'If more data is needed, loop back to step 2. Otherwise, generate the final analysis.' },
    { title: 'Final Answer', desc: 'LLM synthesizes all gathered data into a clear recommendation: Pursue / Monitor / Pass.' },
  ];

  features = [
    { icon: '🧠', title: 'Multi-Hop Reasoning', desc: 'Up to 8 reasoning iterations per query' },
    { icon: '🔧', title: '12 Specialized Tools', desc: 'Search, score, analyze, DCF, memos' },
    { icon: '📊', title: 'Live Macro Data', desc: 'FRED Treasury + BLS unemployment feeds' },
    { icon: '💾', title: 'Persistent Memory', desc: 'Sessions survive server restarts' },
    { icon: '🎯', title: 'Criteria Learning', desc: 'Extracts your preferences from chat' },
    { icon: '📈', title: 'DCF Engine', desc: 'IRR, equity multiple, sensitivity grid' },
    { icon: '📍', title: 'Mobility Intelligence', desc: 'Foot traffic, parking, road activity' },
  ];
}
