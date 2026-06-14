import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { computeDcf, DcfResult } from './dcf-engine';

@Component({
  selector: 'app-dcf-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dcf-panel" *ngIf="result">
      <div class="dcf-header">
        <div class="dcf-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg>
          Pro Forma / DCF Analysis
          <span class="dcf-badge">Auto-Generated</span>
        </div>
        <span class="dcf-assumptions">{{ holdYears }}yr hold · {{ (ltv * 100).toFixed(0) }}% LTV · {{ (interestRate * 100).toFixed(1) }}% rate</span>
      </div>

      <div class="dcf-kpis">
        <div class="dcf-kpi">
          <div class="dcf-kpi-value" [class]="irrClass">{{ (result.irr * 100).toFixed(1) }}%</div>
          <div class="dcf-kpi-label">Levered IRR</div>
        </div>
        <div class="dcf-kpi">
          <div class="dcf-kpi-value">{{ result.equityMultiple.toFixed(2) }}x</div>
          <div class="dcf-kpi-label">Equity Multiple</div>
        </div>
        <div class="dcf-kpi">
          <div class="dcf-kpi-value">{{ (result.cashOnCash * 100).toFixed(1) }}%</div>
          <div class="dcf-kpi-label">Cash-on-Cash</div>
        </div>
        <div class="dcf-kpi">
          <div class="dcf-kpi-value">{{ result.equity | currency:'USD':'symbol':'1.0-0' }}</div>
          <div class="dcf-kpi-label">Equity Required</div>
        </div>
      </div>

      <div class="dcf-cashflows">
        <div class="dcf-cf-header">Projected Cash Flows</div>
        <div class="dcf-cf-row" *ngFor="let cf of result.cashFlows; let i = index">
          <span class="dcf-cf-year">Year {{ i + 1 }}</span>
          <div class="dcf-cf-bar-wrap">
            <div class="dcf-cf-bar" [style.width.%]="barWidth(cf)" [class.negative]="cf < 0"></div>
          </div>
          <span class="dcf-cf-val" [class.negative]="cf < 0">{{ cf | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
        <div class="dcf-cf-row dcf-cf-exit">
          <span class="dcf-cf-year">Exit (Yr {{ holdYears }})</span>
          <div class="dcf-cf-bar-wrap">
            <div class="dcf-cf-bar exit-bar" [style.width.%]="100"></div>
          </div>
          <span class="dcf-cf-val exit-val">{{ result.saleProceeds | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
      </div>

      <div class="dcf-footer">
        <span>Exit Value: {{ result.exitValue | currency:'USD':'symbol':'1.0-0' }}</span>
        <span>Debt Service: {{ result.annualDebtService | currency:'USD':'symbol':'1.0-0' }}/yr</span>
        <span>Total Return: {{ result.totalReturn | currency:'USD':'symbol':'1.0-0' }}</span>
      </div>
    </div>
  `,
  styles: [`
    .dcf-panel {
      background: #fff; border: 1px solid #e2e6ed; border-radius: 14px;
      padding: 22px; margin: 20px 0;
      box-shadow: 0 2px 8px rgba(15,23,42,0.06);
    }
    .dcf-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #0f172a;
    }
    .dcf-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 15px; font-weight: 700; color: #0f172a;
    }
    .dcf-badge {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;
    }
    .dcf-assumptions { font-size: 12px; color: #64748b; }

    .dcf-kpis {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
      margin-bottom: 20px;
    }
    .dcf-kpi {
      background: #f8f9fb; border-radius: 10px; padding: 14px; text-align: center;
      border: 1px solid #e2e6ed;
    }
    .dcf-kpi-value { font-size: 24px; font-weight: 800; color: #0f172a; }
    .dcf-kpi-value.irr-great { color: #059669; }
    .dcf-kpi-value.irr-good { color: #0ea5e9; }
    .dcf-kpi-value.irr-fair { color: #f59e0b; }
    .dcf-kpi-value.irr-poor { color: #ef4444; }
    .dcf-kpi-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.5px; }

    .dcf-cashflows { margin-bottom: 16px; }
    .dcf-cf-header { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .dcf-cf-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .dcf-cf-year { font-size: 12px; color: #64748b; width: 70px; font-weight: 600; }
    .dcf-cf-bar-wrap { flex: 1; height: 16px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .dcf-cf-bar { height: 100%; background: linear-gradient(90deg, #0ea5e9, #6366f1); border-radius: 4px; transition: width 0.6s ease-out; min-width: 2px; }
    .dcf-cf-bar.negative { background: linear-gradient(90deg, #ef4444, #f97316); }
    .dcf-cf-bar.exit-bar { background: linear-gradient(90deg, #10b981, #059669); }
    .dcf-cf-val { font-size: 12px; font-weight: 700; color: #0f172a; width: 90px; text-align: right; }
    .dcf-cf-val.negative { color: #ef4444; }
    .dcf-cf-val.exit-val { color: #059669; }
    .dcf-cf-exit { margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e2e8f0; }

    .dcf-footer {
      display: flex; gap: 20px; font-size: 12px; color: #64748b;
      padding-top: 12px; border-top: 1px solid #e2e6ed;
    }
  `]
})
export class DcfPanelComponent implements OnChanges {
  @Input() deal: any;
  @Input() holdYears = 5;
  @Input() ltv = 0.65;
  @Input() interestRate = 0.055;

  result: DcfResult | null = null;

  ngOnChanges() {
    if (!this.deal) { this.result = null; return; }
    const price = this.deal.askingPrice;
    const noi = this.deal.noi;
    const capRate = this.deal.capRate || this.deal.underwrite?.capRate;
    this.result = computeDcf({
      purchasePrice: price, noi,
      entryCapRate: capRate,
      ltv: this.ltv,
      interestRate: this.interestRate,
      holdYears: this.holdYears,
    });
  }

  get irrClass(): string {
    if (!this.result) return '';
    const irr = this.result.irr * 100;
    if (irr >= 15) return 'irr-great';
    if (irr >= 10) return 'irr-good';
    if (irr >= 6) return 'irr-fair';
    return 'irr-poor';
  }

  barWidth(cf: number): number {
    if (!this.result) return 0;
    const max = Math.max(...this.result.cashFlows.map(Math.abs));
    return max > 0 ? (Math.abs(cf) / max) * 100 : 0;
  }
}
