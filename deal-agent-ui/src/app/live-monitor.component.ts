import { Component, Input, Output, EventEmitter, OnDestroy, signal, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DealDelta = {
  url: string;
  title: string;
  peDelta: number | null;
  riskDelta: number | null;
  priceDelta: number | null;
  capRateDelta: number | null;
  isNew: boolean;
  isRemoved: boolean;
};

@Component({
  selector: 'app-live-monitor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Toggle Bar -->
    <div class="monitor-bar">
      <div class="monitor-left">
        <button class="monitor-toggle" [class.active]="enabled()" (click)="toggle()">
          <span class="monitor-pulse" *ngIf="enabled()"></span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          {{ enabled() ? 'Live Monitoring' : 'Enable Live Monitor' }}
        </button>
        <span class="monitor-info" *ngIf="enabled()">
          Auto-refreshes every {{ intervalMin }}m · Last: {{ lastRefreshLabel() }}
        </span>
        <span class="monitor-next" *ngIf="enabled() && countdown() > 0">
          Next in {{ countdown() }}s
        </span>
      </div>
      <span class="monitor-badge" *ngIf="deltas().length">
        {{ deltas().length }} change{{ deltas().length > 1 ? 's' : '' }} detected
      </span>
    </div>

    <!-- Change Indicators -->
    <div class="delta-panel" *ngIf="deltas().length">
      <div class="delta-item" *ngFor="let d of deltas()" [class.delta-new]="d.isNew" [class.delta-removed]="d.isRemoved">
        <div class="delta-title">
          <span class="delta-status" *ngIf="d.isNew">NEW</span>
          <span class="delta-status removed" *ngIf="d.isRemoved">REMOVED</span>
          {{ truncate(d.title, 40) }}
        </div>
        <div class="delta-metrics" *ngIf="!d.isNew && !d.isRemoved">
          <span class="delta-metric" *ngIf="d.peDelta !== null" [class.up]="d.peDelta > 0" [class.down]="d.peDelta < 0">
            <span class="delta-arrow">{{ d.peDelta > 0 ? '▲' : '▼' }}</span>
            PE {{ d.peDelta > 0 ? '+' : '' }}{{ d.peDelta }}
          </span>
          <span class="delta-metric" *ngIf="d.riskDelta !== null" [class.up]="d.riskDelta < 0" [class.down]="d.riskDelta > 0">
            <span class="delta-arrow">{{ d.riskDelta > 0 ? '▲' : '▼' }}</span>
            Risk {{ d.riskDelta > 0 ? '+' : '' }}{{ d.riskDelta }}
          </span>
          <span class="delta-metric" *ngIf="d.priceDelta !== null" [class.up]="d.priceDelta < 0" [class.down]="d.priceDelta > 0">
            <span class="delta-arrow">{{ d.priceDelta > 0 ? '▲' : '▼' }}</span>
            Price {{ d.priceDelta > 0 ? '+' : '' }}{{ formatPriceDelta(d.priceDelta) }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .monitor-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: #fff; border: 1px solid #e2e6ed;
      border-radius: 10px; margin: 14px 0;
    }
    .monitor-left { display: flex; align-items: center; gap: 12px; }
    .monitor-toggle {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 600;
      background: #f1f5f9; border: 1px solid #d1d5db; color: #374151;
      transition: all 0.2s;
    }
    .monitor-toggle.active {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      border-color: #0f172a; color: #fff;
    }
    .monitor-toggle:hover { opacity: 0.9; }
    .monitor-pulse {
      width: 8px; height: 8px; background: #10b981; border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
      50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(16,185,129,0); }
    }
    .monitor-info { font-size: 12px; color: #64748b; }
    .monitor-next { font-size: 12px; color: #0ea5e9; font-weight: 600; }
    .monitor-badge {
      background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700;
      padding: 4px 12px; border-radius: 6px;
    }

    .delta-panel {
      display: flex; flex-direction: column; gap: 6px;
      padding: 12px 0;
    }
    .delta-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a;
      border-radius: 8px; font-size: 13px;
    }
    .delta-item.delta-new { background: #ecfdf5; border-color: #6ee7b7; }
    .delta-item.delta-removed { background: #fef2f2; border-color: #fca5a5; opacity: 0.7; }
    .delta-title { font-weight: 600; color: #0f172a; display: flex; align-items: center; gap: 8px; }
    .delta-status {
      background: #10b981; color: #fff; font-size: 10px; font-weight: 800;
      padding: 2px 6px; border-radius: 3px; letter-spacing: 0.5px;
    }
    .delta-status.removed { background: #ef4444; }
    .delta-metrics { display: flex; gap: 12px; }
    .delta-metric {
      font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 3px;
      padding: 3px 8px; border-radius: 4px; background: #f1f5f9;
    }
    .delta-metric.up { color: #059669; background: #ecfdf5; }
    .delta-metric.down { color: #dc2626; background: #fef2f2; }
    .delta-arrow { font-size: 10px; }
  `]
})
export class LiveMonitorComponent implements OnDestroy, OnChanges {
  @Input() sources: any[] = [];
  @Input() intervalMin = 5;
  @Input() busy = false;
  @Output() refresh = new EventEmitter<void>();

  enabled = signal(false);
  countdown = signal(0);
  lastRefresh = signal<Date | null>(null);
  deltas = signal<DealDelta[]>([]);

  private previousSnapshot: Map<string, any> = new Map();
  private timer: any = null;
  private countdownTimer: any = null;

  ngOnChanges() {
    if (this.sources?.length && this.enabled()) {
      this.computeDeltas();
    }
  }

  toggle() {
    if (this.enabled()) {
      this.enabled.set(false);
      this.stopTimers();
    } else {
      this.enabled.set(true);
      this.takeSnapshot();
      this.startTimer();
    }
  }

  private takeSnapshot() {
    this.previousSnapshot.clear();
    for (const s of this.sources) {
      this.previousSnapshot.set(s.url, {
        score: s.score ?? s.underwrite?.peScore,
        riskScore: s.riskScore ?? s.underwrite?.riskScore,
        askingPrice: s.askingPrice,
        capRate: s.capRate ?? s.underwrite?.capRate,
        title: s.title,
      });
    }
    this.lastRefresh.set(new Date());
  }

  private computeDeltas() {
    if (!this.previousSnapshot.size) {
      this.takeSnapshot();
      return;
    }

    const deltas: DealDelta[] = [];
    const currentUrls = new Set<string>();

    for (const s of this.sources) {
      currentUrls.add(s.url);
      const prev = this.previousSnapshot.get(s.url);

      if (!prev) {
        deltas.push({ url: s.url, title: s.title, peDelta: null, riskDelta: null, priceDelta: null, capRateDelta: null, isNew: true, isRemoved: false });
        continue;
      }

      const curPe = s.score ?? s.underwrite?.peScore;
      const curRisk = s.riskScore ?? s.underwrite?.riskScore;
      const curPrice = s.askingPrice;

      const peDelta = (curPe != null && prev.score != null) ? Math.round(curPe - prev.score) : null;
      const riskDelta = (curRisk != null && prev.riskScore != null) ? Math.round(curRisk - prev.riskScore) : null;
      const priceDelta = (curPrice != null && prev.askingPrice != null) ? curPrice - prev.askingPrice : null;

      if ((peDelta && peDelta !== 0) || (riskDelta && riskDelta !== 0) || (priceDelta && priceDelta !== 0)) {
        deltas.push({ url: s.url, title: s.title, peDelta: peDelta === 0 ? null : peDelta, riskDelta: riskDelta === 0 ? null : riskDelta, priceDelta: priceDelta === 0 ? null : priceDelta, capRateDelta: null, isNew: false, isRemoved: false });
      }
    }

    for (const [url, prev] of this.previousSnapshot) {
      if (!currentUrls.has(url)) {
        deltas.push({ url, title: prev.title || 'Unknown', peDelta: null, riskDelta: null, priceDelta: null, capRateDelta: null, isNew: false, isRemoved: true });
      }
    }

    this.deltas.set(deltas);
    this.takeSnapshot();
  }

  private startTimer() {
    const intervalSec = this.intervalMin * 60;
    this.countdown.set(intervalSec);

    this.countdownTimer = setInterval(() => {
      const c = this.countdown();
      if (c > 0) this.countdown.set(c - 1);
    }, 1000);

    this.timer = setInterval(() => {
      if (!this.busy) {
        this.refresh.emit();
        this.countdown.set(intervalSec);
      }
    }, intervalSec * 1000);
  }

  private stopTimers() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    this.countdown.set(0);
  }

  lastRefreshLabel(): string {
    const d = this.lastRefresh();
    if (!d) return 'never';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatPriceDelta(d: number): string {
    const abs = Math.abs(d);
    if (abs >= 1e6) return '$' + (d / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + (d / 1e3).toFixed(0) + 'K';
    return '$' + d.toFixed(0);
  }

  truncate(s: string, max: number): string {
    if (!s) return 'Property';
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  ngOnDestroy() {
    this.stopTimers();
  }
}
