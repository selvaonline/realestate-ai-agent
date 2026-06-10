import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { sensitivityGrid } from './dcf-engine';

@Component({
  selector: 'app-sensitivity-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sens-panel" *ngIf="grid.length">
      <div class="sens-header">
        <div class="sens-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
          Sensitivity Analysis
          <span class="sens-badge">IRR Impact</span>
        </div>
        <span class="sens-note">Cap Rate (rows) × Interest Rate (cols)</span>
      </div>

      <div class="sens-table-wrap">
        <table class="sens-table">
          <thead>
            <tr>
              <th class="sens-corner"></th>
              <th *ngFor="let rd of rateDeltas" class="sens-col-header" [class.base-col]="rd === 0">
                {{ formatRate(baseRate + rd) }}
                <span class="delta-label" *ngIf="rd !== 0">{{ rd > 0 ? '+' : '' }}{{ (rd * 100).toFixed(0) }}bps</span>
                <span class="delta-label base-label" *ngIf="rd === 0">Base</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of grid; let ri = index">
              <td class="sens-row-header" [class.base-row]="capRateDeltas[ri] === 0">
                {{ formatCap(baseCap + capRateDeltas[ri]) }}
                <span class="delta-label" *ngIf="capRateDeltas[ri] !== 0">{{ capRateDeltas[ri] > 0 ? '+' : '' }}{{ (capRateDeltas[ri] * 100).toFixed(0) }}bps</span>
                <span class="delta-label base-label" *ngIf="capRateDeltas[ri] === 0">Base</span>
              </td>
              <td *ngFor="let cell of row; let ci = index"
                  class="sens-cell"
                  [class.base-cell]="capRateDeltas[ri] === 0 && rateDeltas[ci] === 0"
                  [style.background]="cellBg(cell.irr)">
                <div class="sens-irr">{{ (cell.irr * 100).toFixed(1) }}%</div>
                <div class="sens-em">{{ cell.equityMultiple.toFixed(2) }}x</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="sens-legend">
        <div class="legend-item"><span class="legend-dot" style="background:#059669;"></span> IRR ≥ 15%</div>
        <div class="legend-item"><span class="legend-dot" style="background:#0ea5e9;"></span> 10–15%</div>
        <div class="legend-item"><span class="legend-dot" style="background:#f59e0b;"></span> 6–10%</div>
        <div class="legend-item"><span class="legend-dot" style="background:#ef4444;"></span> &lt; 6%</div>
      </div>
    </div>
  `,
  styles: [`
    .sens-panel {
      background: #fff; border: 1px solid #e2e6ed; border-radius: 14px;
      padding: 22px; margin: 20px 0;
      box-shadow: 0 2px 8px rgba(15,23,42,0.06);
    }
    .sens-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #0f172a;
    }
    .sens-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 15px; font-weight: 700; color: #0f172a;
    }
    .sens-badge {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;
    }
    .sens-note { font-size: 12px; color: #64748b; }

    .sens-table-wrap { overflow-x: auto; }
    .sens-table { width: 100%; border-collapse: collapse; }
    .sens-corner { width: 100px; }
    .sens-col-header, .sens-row-header {
      font-size: 12px; font-weight: 700; color: #374151; padding: 8px 10px; text-align: center;
    }
    .sens-col-header.base-col, .sens-row-header.base-row { color: #0f172a; font-weight: 800; }
    .delta-label { display: block; font-size: 10px; color: #94a3b8; font-weight: 500; }
    .base-label { color: #0ea5e9 !important; font-weight: 700 !important; }

    .sens-cell {
      text-align: center; padding: 10px 8px; border: 1px solid #f1f5f9;
      transition: all 0.2s; border-radius: 4px;
    }
    .sens-cell.base-cell { border: 2px solid #0f172a; font-weight: 800; }
    .sens-cell:hover { transform: scale(1.05); box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1; position: relative; }
    .sens-irr { font-size: 14px; font-weight: 800; color: #0f172a; }
    .sens-em { font-size: 10px; color: #64748b; font-weight: 600; }

    .sens-legend {
      display: flex; gap: 16px; margin-top: 14px; padding-top: 12px;
      border-top: 1px solid #e2e6ed; justify-content: center;
    }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; font-weight: 600; }
    .legend-dot { width: 10px; height: 10px; border-radius: 3px; }
  `]
})
export class SensitivityTableComponent implements OnChanges {
  @Input() deal: any;

  grid: { capRate: number; interestRate: number; irr: number; equityMultiple: number }[][] = [];
  baseCap = 0;
  baseRate = 0.055;
  capRateDeltas = [-0.01, -0.005, 0, 0.005, 0.01];
  rateDeltas = [-0.01, -0.005, 0, 0.005, 0.01];

  ngOnChanges() {
    if (!this.deal?.askingPrice || !this.deal?.noi) { this.grid = []; return; }
    this.baseCap = this.deal.capRate || this.deal.underwrite?.capRate || (this.deal.noi / this.deal.askingPrice);
    this.grid = sensitivityGrid(
      { purchasePrice: this.deal.askingPrice, noi: this.deal.noi, entryCapRate: this.baseCap },
      this.capRateDeltas,
      this.rateDeltas
    );
  }

  formatCap(v: number): string { return (v * 100).toFixed(2) + '%'; }
  formatRate(v: number): string { return (v * 100).toFixed(1) + '%'; }

  cellBg(irr: number): string {
    const pct = irr * 100;
    if (pct >= 15) return 'rgba(5,150,105,0.12)';
    if (pct >= 10) return 'rgba(14,165,233,0.10)';
    if (pct >= 6) return 'rgba(245,158,11,0.10)';
    return 'rgba(239,68,68,0.10)';
  }
}
