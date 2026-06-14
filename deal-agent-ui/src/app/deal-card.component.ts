import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-deal-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="deal-card">
      <!-- Property image (from og:image or screenshot) -->
      <div class="deal-image" *ngIf="dealImage">
        <img [src]="dealImage" alt="Property" loading="lazy" (error)="imgError = true" />
        <div class="deal-badge">{{ index + 1 }}</div>
        <div class="source-badge">{{ sourceBadge }}</div>
        <div class="ic-badge" [style.background]="icTagBg" [style.color]="icTagColor">{{ icTag }}</div>
      </div>

      <!-- HEADER: rank + source + IC tag (when no image) -->
      <div class="deal-top-bar" *ngIf="!dealImage">
        <div class="deal-rank">{{ index + 1 }}</div>
        <div class="source-tag">{{ sourceBadge }}</div>
        <div class="ic-tag" [style.background]="icTagBg" [style.color]="icTagColor">
          {{ icTag }}
        </div>
      </div>

      <div class="deal-content">
        <h4 class="deal-title">{{ deal.title || 'Investment Property' }}</h4>
        <p class="deal-snippet" *ngIf="deal.raw?.snippet">
          {{ deal.raw.snippet | slice:0:100 }}{{ deal.raw?.snippet?.length > 100 ? '...' : '' }}
        </p>

        <!-- SCORE ROW: PE | Risk | Sharpe -->
        <div class="score-row">
          <div class="score-pill" [style.background]="peBg" [style.color]="peColor">
            <span class="score-label">PE Score</span>
            <span class="score-val">{{ peScore ?? '—' }}<span class="score-max">/100</span></span>
          </div>
          <div class="score-pill" [style.background]="riskBg" [style.color]="riskColor">
            <span class="score-label">Risk</span>
            <span class="score-val">{{ riskScore ?? '—' }}<span class="score-max">/100</span></span>
          </div>
          <div class="score-pill" [style.background]="sharpeBg" [style.color]="sharpeColor">
            <span class="score-label">Sharpe</span>
            <span class="score-val">{{ sharpeDisplay }}</span>
          </div>
        </div>

        <!-- FINANCIAL METRICS GRID -->
        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">IRR</span>
            <span class="metric-value" [class.na]="irrDisplay === 'N/A'">{{ irrDisplay }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Equity Multiple</span>
            <span class="metric-value" [class.na]="emDisplay === 'N/A'">{{ emDisplay }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Cash-on-Cash</span>
            <span class="metric-value" [class.na]="cocDisplay === 'N/A'">{{ cocDisplay }}</span>
          </div>
          <div class="metric-item" *ngIf="capRateDisplay !== '—'">
            <span class="metric-label">Cap Rate</span>
            <span class="metric-value">{{ capRateDisplay }}%</span>
          </div>
          <div class="metric-item" *ngIf="deal.askingPrice">
            <span class="metric-label">Asking Price</span>
            <span class="metric-value">{{ deal.askingPrice | currency:'USD':'symbol':'1.0-0' }}</span>
          </div>
          <div class="metric-item" *ngIf="deal.noi">
            <span class="metric-label">NOI</span>
            <span class="metric-value">{{ deal.noi | currency:'USD':'symbol':'1.0-0' }}</span>
          </div>
        </div>

        <!-- SIGNAL CHIPS -->
        <div class="signals-row" *ngIf="isNNN || marketTier !== '—' || tenantName !== '—'">
          <span class="signal-chip nnn" *ngIf="isNNN">NNN</span>
          <span class="signal-chip tier" *ngIf="marketTier !== '—'">Tier {{ marketTier }}</span>
          <span class="signal-chip tenant" *ngIf="tenantName !== '—'">{{ tenantName }}</span>
          <span class="signal-chip classification" *ngIf="peClassification" [style.color]="peColor">{{ peClassification }}</span>
        </div>

        <!-- TOGGLE: Score Breakdown -->
        <button class="toggle-details" (click)="toggleExpand()">
          {{ expanded ? 'Hide Details' : 'Show Score Breakdown' }}
          <span class="toggle-arrow">{{ expanded ? '\u25B2' : '\u25BC' }}</span>
        </button>

        <!-- DETAIL SECTION (collapsible) -->
        <div class="detail-section" *ngIf="expanded">

          <!-- PE FACTOR BREAKDOWN -->
          <div class="breakdown-block" *ngIf="peFactorBars.length && peScore">
            <div class="breakdown-title">PE Factor Breakdown</div>
            <div class="factor-bar-row" *ngFor="let f of peFactorBars">
              <div class="factor-name">{{ f.label }}</div>
              <div class="factor-track">
                <div class="factor-fill pe-fill" [style.width.%]="f.pct"></div>
              </div>
              <div class="factor-pct">{{ f.pct }}%</div>
            </div>
          </div>

          <!-- RISK DECOMPOSITION -->
          <div class="breakdown-block" *ngIf="riskFactorBars.length">
            <div class="breakdown-title">
              Risk Decomposition
              <span class="breakdown-sub">({{ deal.raw?.riskDecomp?.totalRisk ?? '—' }}/100)</span>
            </div>
            <div class="factor-bar-row" *ngFor="let r of riskFactorBars">
              <div class="factor-name">{{ r.name }}</div>
              <div class="factor-track">
                <div class="factor-fill risk-fill" [style.width.%]="r.score"></div>
              </div>
              <div class="factor-pct">{{ r.score }}</div>
            </div>
            <div class="risk-rec" *ngIf="deal.raw?.riskDecomp?.recommendation">
              {{ deal.raw.riskDecomp.recommendation }}
            </div>
          </div>

          <!-- DCF DETAILS -->
          <div class="breakdown-block" *ngIf="deal.raw?.dcf">
            <div class="breakdown-title">DCF Analysis</div>
            <div class="dcf-grid">
              <div class="dcf-item">
                <span class="dcf-label">Exit Value</span>
                <span class="dcf-val">{{ deal.raw.dcf.exitValue | currency:'USD':'symbol':'1.0-0' }}</span>
              </div>
              <div class="dcf-item">
                <span class="dcf-label">Equity</span>
                <span class="dcf-val">{{ deal.raw.dcf.equity | currency:'USD':'symbol':'1.0-0' }}</span>
              </div>
              <div class="dcf-item">
                <span class="dcf-label">Loan Amount</span>
                <span class="dcf-val">{{ deal.raw.dcf.loanAmount | currency:'USD':'symbol':'1.0-0' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="deal-footer">
          <a [href]="deal.url" target="_blank" rel="noopener" class="deal-link">
            <span>View Listing</span>
            <span class="link-arrow">\u2192</span>
          </a>
          <button class="add-to-watchlist-btn" (click)="save.emit(deal)" title="Add to Watchlist">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .deal-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .deal-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }

    /* Property image */
    .deal-image {
      position: relative; width: 100%; height: 180px;
      overflow: hidden; background: #f1f5f9;
    }
    .deal-image img { width: 100%; height: 100%; object-fit: cover; }
    .deal-badge {
      position: absolute; top: 10px; left: 10px;
      background: rgba(15,23,42,0.85); color: #38bdf8;
      width: 30px; height: 30px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px;
    }
    .source-badge {
      position: absolute; top: 10px; right: 10px;
      background: rgba(255,255,255,0.92); color: #374151;
      padding: 3px 9px; border-radius: 6px;
      font-size: 10px; font-weight: 600;
    }
    .ic-badge {
      position: absolute; bottom: 10px; left: 10px;
      padding: 3px 9px; border-radius: 6px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.3px;
    }

    /* Header bar */
    .deal-top-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 18px 0;
    }
    .deal-rank {
      width: 28px; height: 28px;
      background: #0f172a; color: #38bdf8;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px; flex-shrink: 0;
    }
    .source-tag {
      padding: 3px 8px; background: #f1f5f9; border-radius: 5px;
      font-size: 11px; font-weight: 600; color: #475569;
    }
    .ic-tag {
      margin-left: auto;
      padding: 3px 10px; border-radius: 6px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
    }

    /* Content */
    .deal-content { padding: 12px 18px 18px; }
    .deal-title {
      font-size: 15px; font-weight: 700; color: #1a2332;
      margin: 0 0 4px 0;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; line-height: 1.3;
    }
    .deal-snippet {
      font-size: 12px; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.4;
    }

    /* Score row */
    .score-row { display: flex; gap: 6px; margin-bottom: 10px; }
    .score-pill {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      padding: 8px 4px; border-radius: 10px;
    }
    .score-label {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      opacity: 0.75; letter-spacing: 0.3px;
    }
    .score-val { font-size: 16px; font-weight: 800; margin-top: 2px; }
    .score-max { font-size: 11px; font-weight: 500; opacity: 0.6; }

    /* Metrics grid */
    .metrics-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
      margin-bottom: 10px;
    }
    .metric-item { background: #f8fafc; padding: 7px 9px; border-radius: 8px; }
    .metric-label {
      display: block; font-size: 9px; color: #94a3b8;
      font-weight: 600; text-transform: uppercase;
    }
    .metric-value {
      display: block; font-size: 13px; color: #1a2332;
      font-weight: 700; margin-top: 2px;
    }
    .metric-value.na { color: #cbd5e1; font-weight: 400; font-style: italic; }

    /* Signals */
    .signals-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .signal-chip {
      padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;
    }
    .signal-chip.nnn { background: #eff6ff; color: #2563eb; }
    .signal-chip.tier { background: #f0fdf4; color: #16a34a; }
    .signal-chip.tenant { background: #f5f3ff; color: #7c3aed; }
    .signal-chip.classification { background: #f8fafc; }

    /* Toggle */
    .toggle-details {
      width: 100%; background: none; border: 1px dashed #e2e8f0; border-radius: 7px;
      padding: 6px; font-size: 11px; font-weight: 600; color: #64748b;
      cursor: pointer; margin-bottom: 10px;
      display: flex; justify-content: center; gap: 6px; align-items: center;
    }
    .toggle-details:hover { border-color: #94a3b8; color: #475569; }
    .toggle-arrow { font-size: 9px; }

    /* Detail section */
    .detail-section { border-top: 1px solid #f1f5f9; padding-top: 10px; }
    .breakdown-block { margin-bottom: 14px; }
    .breakdown-title {
      font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 8px;
    }
    .breakdown-sub { font-weight: 400; color: #94a3b8; text-transform: none; margin-left: 4px; }

    /* Factor bars */
    .factor-bar-row {
      display: grid; grid-template-columns: 100px 1fr 32px;
      align-items: center; gap: 6px; margin-bottom: 5px;
    }
    .factor-name {
      font-size: 10px; color: #64748b; font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .factor-track {
      height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;
    }
    .factor-fill {
      height: 100%; border-radius: 3px; transition: width 0.4s ease;
    }
    .pe-fill { background: linear-gradient(90deg, #3b82f6, #06b6d4); }
    .risk-fill { background: linear-gradient(90deg, #f59e0b, #ef4444); }
    .factor-pct { font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; }

    /* Risk recommendation */
    .risk-rec {
      margin-top: 6px; font-size: 11px; color: #64748b;
      background: #f8fafc; padding: 6px 8px; border-radius: 6px;
    }

    /* DCF grid */
    .dcf-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
    }
    .dcf-item { background: #f8fafc; padding: 6px 8px; border-radius: 6px; }
    .dcf-label {
      display: block; font-size: 9px; color: #94a3b8;
      font-weight: 600; text-transform: uppercase;
    }
    .dcf-val { display: block; font-size: 12px; color: #1a2332; font-weight: 600; margin-top: 2px; }

    /* Footer */
    .deal-footer { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
    .deal-link {
      display: flex; align-items: center; gap: 5px;
      padding: 8px 14px;
      background: #0f172a; color: #fff;
      text-decoration: none; font-size: 12px; font-weight: 600;
      border-radius: 8px; transition: all 0.15s;
    }
    .deal-link:hover { background: #1e293b; }
    .link-arrow { font-size: 14px; }

    .add-to-watchlist-btn {
      display: flex; align-items: center; gap: 5px;
      padding: 8px 12px;
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 8px; cursor: pointer;
      font-size: 12px; font-weight: 600; color: #475569;
      transition: all 0.15s;
    }
    .add-to-watchlist-btn:hover { background: #f0f9ff; border-color: #93c5fd; color: #2563eb; }

    @media (max-width: 768px) {
      .deal-content { padding: 10px 14px 14px; }
      .deal-title { font-size: 14px; }
      .score-row { gap: 4px; }
      .score-pill { padding: 6px 3px; }
      .score-val { font-size: 14px; }
      .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 4px; }
      .metric-item { padding: 5px 7px; }
      .metric-value { font-size: 12px; }
      .factor-bar-row { grid-template-columns: 80px 1fr 28px; }
      .deal-footer { flex-wrap: wrap; gap: 6px; }
      .dcf-grid { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class DealCardComponent {
  @Input() deal: any = {};
  @Input() index = 0;
  @Output() save = new EventEmitter<any>();

  expanded = false;
  imgError = false;
  toggleExpand() { this.expanded = !this.expanded; }

  // Property image: og:image URL or base64 screenshot
  get dealImage(): string | null {
    if (this.imgError) return null;
    if (this.deal.screenshotBase64) return 'data:image/png;base64,' + this.deal.screenshotBase64;
    return this.deal.raw?.imageUrl || null;
  }

  get sourceBadge(): string {
    const raw = this.deal.source || this.deal.url || '';
    try {
      const host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
      if (host.includes('crexi')) return 'Crexi';
      if (host.includes('loopnet')) return 'LoopNet';
      if (host.includes('brevitas')) return 'Brevitas';
      return host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
    } catch { return 'CRE'; }
  }

  // ── Score getters ──
  get peScore(): number | null {
    return this.deal.raw?.peScore ?? this.deal.peScore ?? null;
  }
  get riskScore(): number | null {
    return this.deal.raw?.riskScore ?? this.deal.riskScore ?? null;
  }

  // ── IC Readiness ──
  get icTag(): string {
    return this.deal.raw?.icTag ?? 'Watchlist';
  }
  get icTagColor(): string {
    const t = this.icTag;
    if (t === 'IC Ready') return '#059669';
    if (t === 'Under Review') return '#d97706';
    return '#6b7280';
  }
  get icTagBg(): string {
    const t = this.icTag;
    if (t === 'IC Ready') return '#ecfdf5';
    if (t === 'Under Review') return '#fffbeb';
    return '#f1f5f9';
  }

  // ── PE color coding ──
  get peColor(): string {
    const s = this.peScore;
    if (s == null) return '#64748b';
    if (s >= 70) return '#059669';
    if (s >= 40) return '#d97706';
    return '#dc2626';
  }
  get peBg(): string {
    const s = this.peScore;
    if (s == null) return '#f1f5f9';
    if (s >= 70) return '#ecfdf5';
    if (s >= 40) return '#fffbeb';
    return '#fef2f2';
  }

  // ── Risk color coding ──
  get riskColor(): string {
    const s = this.riskScore;
    if (s == null) return '#64748b';
    if (s <= 40) return '#059669';
    if (s <= 60) return '#d97706';
    return '#dc2626';
  }
  get riskBg(): string {
    const s = this.riskScore;
    if (s == null) return '#f1f5f9';
    if (s <= 40) return '#ecfdf5';
    if (s <= 60) return '#fffbeb';
    return '#fef2f2';
  }

  // ── Sharpe ──
  get sharpeDisplay(): string {
    const v = this.deal.raw?.multiAsset?.sharpe;
    return v != null ? v.toFixed(2) : 'N/A';
  }
  get sharpeColor(): string {
    const v = this.deal.raw?.multiAsset?.sharpe;
    if (v == null) return '#6b7280';
    if (v > 1.0) return '#059669';
    if (v > 0.5) return '#2563eb';
    return '#d97706';
  }
  get sharpeBg(): string {
    const v = this.deal.raw?.multiAsset?.sharpe;
    if (v == null) return '#f1f5f9';
    if (v > 1.0) return '#ecfdf5';
    if (v > 0.5) return '#eff6ff';
    return '#fffbeb';
  }

  // ── DCF metrics ──
  get irrDisplay(): string {
    const v = this.deal.raw?.dcf?.irr;
    return v != null ? (v * 100).toFixed(1) + '%' : 'N/A';
  }
  get emDisplay(): string {
    const v = this.deal.raw?.dcf?.equityMultiple;
    return v != null ? v.toFixed(2) + 'x' : 'N/A';
  }
  get cocDisplay(): string {
    const v = this.deal.raw?.dcf?.cashOnCash;
    return v != null ? (v * 100).toFixed(1) + '%' : 'N/A';
  }

  // ── Cap rate / DSCR ──
  get capRateDisplay(): string {
    const cr = this.deal.capRate || this.deal.underwrite?.capRate;
    return cr != null ? (cr * 100).toFixed(2) : '—';
  }
  get dscrDisplay(): string {
    const d = this.deal.underwrite?.dscr;
    return d != null ? d.toFixed(2) : '—';
  }

  // ── Classification ──
  get peClassification(): string {
    const s = this.peScore;
    if (s == null) return '';
    if (s >= 85) return 'Core';
    if (s >= 75) return 'Core+';
    if (s >= 60) return 'Value-add';
    return 'Opportunistic';
  }

  // ── Signals ──
  get tenantName(): string {
    return this.deal.raw?.peSignals?.tenantName ?? '—';
  }
  get isNNN(): boolean {
    return this.deal.raw?.peSignals?.nnn ?? false;
  }
  get marketTier(): string {
    return this.deal.raw?.peSignals?.tier ?? '—';
  }

  // ── PE Factor bars ──
  get peFactorBars(): Array<{ label: string; pct: number }> {
    const f = this.deal.raw?.peFactors;
    if (!f) return [];
    const total = (f.tenantLease || 0) + (f.yieldSpread || 0) +
                  (f.marketQuality || 0) + (f.assetFit || 0) +
                  (f.dealEconomics || 0) + (f.executionRisk || 0) +
                  (f.mobility || 0);
    const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
    return [
      { label: 'Tenant & Lease', pct: pct(f.tenantLease || 0) },
      { label: 'Yield Spread', pct: pct(f.yieldSpread || 0) },
      { label: 'Market Quality', pct: pct(f.marketQuality || 0) },
      { label: 'Asset Fit', pct: pct(f.assetFit || 0) },
      { label: 'Deal Economics', pct: pct(f.dealEconomics || 0) },
      { label: 'Execution Risk', pct: pct(f.executionRisk || 0) },
      { label: 'Mobility / Activity', pct: pct(f.mobility || 0) },
    ];
  }

  // ── Risk decomposition bars ──
  get riskFactorBars(): Array<{ name: string; score: number; weight: number; detail: string }> {
    return this.deal.raw?.riskDecomp?.factors ?? [];
  }
}
