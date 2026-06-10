// location-intel-panel.component.ts — "Location Intelligence" result section
// Renders the analyze_traffic_patterns (Mobility Intelligence) output:
// mobility/parking/foot-traffic/traffic/anchor scores, trend, confidence, signals, risks.
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MobilityResult {
  address: string;
  mobilityScore: number;
  parkingScore: number;
  trafficScore: number;
  footTrafficScore: number;
  nearbyAnchorScore: number;
  visibilityScore: number;
  trend: 'Increasing' | 'Stable' | 'Declining';
  confidence: 'Low' | 'Medium' | 'High';
  signals: string[];
  risks: string[];
  recommendationImpact: 'Positive' | 'Neutral' | 'Negative';
  summary: string;
}

@Component({
  selector: 'app-location-intel-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="li-panel" *ngIf="data">
      <div class="li-header">
        <div class="li-title-wrap">
          <span class="li-icon">📍</span>
          <div>
            <div class="li-title">Location Intelligence</div>
            <div class="li-sub">Foot traffic, parking, road activity{{ data.address ? ' — ' + data.address : '' }}</div>
          </div>
        </div>
        <span class="li-badge">⚡ Mobility Enhanced</span>
      </div>

      <div class="li-body">
        <!-- Mobility headline score -->
        <div class="li-score-ring" [class.good]="data.mobilityScore >= 70" [class.mid]="data.mobilityScore >= 50 && data.mobilityScore < 70" [class.low]="data.mobilityScore < 50">
          <div class="li-score-num">{{ data.mobilityScore }}</div>
          <div class="li-score-label">Mobility Score</div>
          <div class="li-chips">
            <span class="li-chip" [ngClass]="trendClass">{{ trendArrow }} {{ data.trend }}</span>
            <span class="li-chip conf">Confidence: {{ data.confidence }}</span>
            <span class="li-chip" [ngClass]="impactClass">{{ data.recommendationImpact }} impact</span>
          </div>
        </div>

        <!-- Component score bars -->
        <div class="li-bars">
          <div class="li-bar-row" *ngFor="let b of bars">
            <span class="li-bar-label">{{ b.label }}</span>
            <div class="li-bar-track">
              <div class="li-bar-fill" [style.width.%]="b.value" [class.good]="b.value >= 70" [class.mid]="b.value >= 50 && b.value < 70" [class.low]="b.value < 50"></div>
            </div>
            <span class="li-bar-value">{{ b.value }}</span>
          </div>
        </div>
      </div>

      <!-- Signals & Risks -->
      <div class="li-lists">
        <div class="li-list">
          <div class="li-list-title positive">Positive Signals</div>
          <div class="li-list-item" *ngFor="let s of data.signals"><span class="li-dot pos">+</span>{{ s }}</div>
        </div>
        <div class="li-list">
          <div class="li-list-title negative">Risks & Caveats</div>
          <div class="li-list-item" *ngFor="let r of data.risks"><span class="li-dot neg">−</span>{{ r }}</div>
        </div>
      </div>

      <div class="li-summary">{{ data.summary }}</div>
    </div>
  `,
  styles: [`
    .li-panel {
      margin: 16px 0;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #fff;
      overflow: hidden;
    }
    .li-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px;
      background: linear-gradient(135deg, #f0fdfa, #eff6ff);
      border-bottom: 1px solid #e2e8f0;
    }
    .li-title-wrap { display: flex; align-items: center; gap: 10px; }
    .li-icon { font-size: 22px; }
    .li-title { font-size: 15px; font-weight: 700; color: #0f172a; }
    .li-sub { font-size: 12px; color: #64748b; margin-top: 1px; }
    .li-badge {
      font-size: 11px; font-weight: 700;
      background: #0d9488; color: #fff;
      padding: 4px 10px; border-radius: 12px;
      white-space: nowrap;
    }

    .li-body {
      display: flex; gap: 24px; padding: 18px;
      align-items: center; flex-wrap: wrap;
    }
    .li-score-ring {
      min-width: 170px; text-align: center;
      padding: 14px 18px; border-radius: 12px;
      border: 2px solid #e2e8f0; background: #f8fafc;
    }
    .li-score-ring.good { border-color: #34d399; background: #ecfdf5; }
    .li-score-ring.mid { border-color: #fbbf24; background: #fffbeb; }
    .li-score-ring.low { border-color: #f87171; background: #fef2f2; }
    .li-score-num { font-size: 36px; font-weight: 800; color: #0f172a; line-height: 1; }
    .li-score-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .li-chips { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
    .li-chip {
      font-size: 11px; font-weight: 600; padding: 3px 8px;
      border-radius: 10px; background: #f1f5f9; color: #475569;
    }
    .li-chip.up { background: #dcfce7; color: #166534; }
    .li-chip.flat { background: #f1f5f9; color: #475569; }
    .li-chip.down { background: #fee2e2; color: #991b1b; }
    .li-chip.pos { background: #dcfce7; color: #166534; }
    .li-chip.neu { background: #f1f5f9; color: #475569; }
    .li-chip.neg { background: #fee2e2; color: #991b1b; }

    .li-bars { flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 8px; }
    .li-bar-row { display: flex; align-items: center; gap: 10px; }
    .li-bar-label { font-size: 12px; color: #475569; font-weight: 600; min-width: 130px; }
    .li-bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .li-bar-fill { height: 100%; border-radius: 4px; background: #94a3b8; transition: width 0.4s ease; }
    .li-bar-fill.good { background: #10b981; }
    .li-bar-fill.mid { background: #f59e0b; }
    .li-bar-fill.low { background: #ef4444; }
    .li-bar-value { font-size: 12px; font-weight: 700; color: #0f172a; min-width: 26px; text-align: right; }

    .li-lists {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
      padding: 0 18px 14px;
    }
    @media (max-width: 640px) { .li-lists { grid-template-columns: 1fr; } }
    .li-list-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }
    .li-list-title.positive { color: #059669; }
    .li-list-title.negative { color: #dc2626; }
    .li-list-item { display: flex; gap: 8px; font-size: 12.5px; color: #475569; line-height: 1.5; margin-bottom: 4px; }
    .li-dot { font-weight: 800; flex-shrink: 0; }
    .li-dot.pos { color: #059669; }
    .li-dot.neg { color: #dc2626; }

    .li-summary {
      padding: 12px 18px;
      background: #f8fafc; border-top: 1px solid #e2e8f0;
      font-size: 13px; color: #334155; line-height: 1.6; font-style: italic;
    }
  `]
})
export class LocationIntelPanelComponent {
  @Input() data: MobilityResult | null = null;

  get bars(): Array<{ label: string; value: number }> {
    if (!this.data) return [];
    return [
      { label: 'Parking', value: this.data.parkingScore },
      { label: 'Foot Traffic', value: this.data.footTrafficScore },
      { label: 'Road Traffic', value: this.data.trafficScore },
      { label: 'Nearby Anchors', value: this.data.nearbyAnchorScore },
      { label: 'Visibility', value: this.data.visibilityScore },
    ];
  }

  get trendArrow(): string {
    return this.data?.trend === 'Increasing' ? '↑' : this.data?.trend === 'Declining' ? '↓' : '→';
  }
  get trendClass(): string {
    return this.data?.trend === 'Increasing' ? 'up' : this.data?.trend === 'Declining' ? 'down' : 'flat';
  }
  get impactClass(): string {
    return this.data?.recommendationImpact === 'Positive' ? 'pos' : this.data?.recommendationImpact === 'Negative' ? 'neg' : 'neu';
  }
}
