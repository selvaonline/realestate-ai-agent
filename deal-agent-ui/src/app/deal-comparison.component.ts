import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { computeDcf } from './dcf-engine';

@Component({
  selector: 'app-deal-comparison',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="comp-panel" *ngIf="deals && deals.length >= 2">
      <div class="comp-header">
        <div class="comp-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Deal Comparison Matrix
        </div>
        <span class="comp-count">{{ deals.length }} deals</span>
      </div>

      <div class="comp-table-wrap">
        <table class="comp-table">
          <thead>
            <tr>
              <th class="comp-metric-col">Metric</th>
              <th *ngFor="let d of topDeals; let i = index" class="comp-deal-col" [class.best-col]="i === 0">
                <div class="comp-deal-name">{{ truncate(d.title, 28) }}</div>
                <div class="comp-deal-rank">#{{ i + 1 }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows">
              <td class="comp-metric-cell">{{ row.label }}</td>
              <td *ngFor="let val of row.values; let i = index"
                  class="comp-value-cell"
                  [class.best-val]="val === row.best"
                  [class.worst-val]="val === row.worst"
                  [class.best-col]="i === 0">
                {{ val }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .comp-panel {
      background: #fff; border: 1px solid #e2e6ed; border-radius: 14px;
      padding: 22px; margin: 20px 0;
      box-shadow: 0 2px 8px rgba(15,23,42,0.06);
    }
    .comp-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #0f172a;
    }
    .comp-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 15px; font-weight: 700; color: #0f172a;
    }
    .comp-count { font-size: 12px; color: #64748b; }

    .comp-table-wrap { overflow-x: auto; }
    .comp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .comp-table th, .comp-table td { padding: 10px 14px; text-align: left; }
    .comp-table thead tr { border-bottom: 2px solid #e2e6ed; }
    .comp-metric-col { font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; width: 140px; }
    .comp-deal-col { text-align: center; }
    .comp-deal-col.best-col { background: rgba(14,165,233,0.04); }
    .comp-deal-name { font-size: 12px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
    .comp-deal-rank { font-size: 10px; color: #64748b; margin-top: 2px; }

    .comp-metric-cell { font-weight: 600; color: #374151; font-size: 12px; }
    .comp-value-cell { text-align: center; font-weight: 600; color: #0f172a; }
    .comp-value-cell.best-col { background: rgba(14,165,233,0.04); }
    .comp-value-cell.best-val { color: #059669; font-weight: 800; }
    .comp-value-cell.worst-val { color: #ef4444; }

    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:hover { background: #fafbfc; }
  `]
})
export class DealComparisonComponent {
  @Input() deals: any[] = [];

  get topDeals(): any[] {
    return this.deals
      .filter((d: any) => d.askingPrice || d.noi)
      .sort((a: any, b: any) => (b.score ?? b.underwrite?.peScore ?? 0) - (a.score ?? a.underwrite?.peScore ?? 0))
      .slice(0, 5);
  }

  get rows(): { label: string; values: string[]; best: string; worst: string }[] {
    const ds = this.topDeals;
    if (!ds.length) return [];

    const metrics: { label: string; extract: (d: any) => number | null; format: (v: number) => string; higher: boolean }[] = [
      { label: 'Asking Price', extract: d => d.askingPrice, format: v => '$' + (v / 1e6).toFixed(2) + 'M', higher: false },
      { label: 'NOI', extract: d => d.noi, format: v => '$' + (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : (v / 1e3).toFixed(0) + 'K'), higher: true },
      { label: 'Cap Rate', extract: d => d.capRate || d.underwrite?.capRate, format: v => (v * 100).toFixed(2) + '%', higher: true },
      { label: 'PE Score', extract: d => d.score ?? d.underwrite?.peScore, format: v => v.toFixed(0), higher: true },
      { label: 'Risk Score', extract: d => d.riskScore ?? d.underwrite?.riskScore, format: v => v.toFixed(0), higher: false },
      { label: 'DSCR', extract: d => d.underwrite?.dscr, format: v => v.toFixed(2) + 'x', higher: true },
      { label: 'Levered IRR', extract: d => this.getDealIrr(d), format: v => (v * 100).toFixed(1) + '%', higher: true },
      { label: 'Equity Multiple', extract: d => this.getDealEM(d), format: v => v.toFixed(2) + 'x', higher: true },
    ];

    return metrics.map(m => {
      const raw = ds.map(d => m.extract(d));
      const values = raw.map(v => v != null ? m.format(v) : '—');
      const valid = raw.filter((v): v is number => v != null);
      const bestNum = valid.length ? (m.higher ? Math.max(...valid) : Math.min(...valid)) : null;
      const worstNum = valid.length > 1 ? (m.higher ? Math.min(...valid) : Math.max(...valid)) : null;
      const best = bestNum != null ? m.format(bestNum) : '';
      const worst = worstNum != null ? m.format(worstNum) : '';
      return { label: m.label, values, best, worst };
    });
  }

  private getDealIrr(d: any): number | null {
    const r = computeDcf({ purchasePrice: d.askingPrice, noi: d.noi, entryCapRate: d.capRate || d.underwrite?.capRate });
    return r?.irr ?? null;
  }

  private getDealEM(d: any): number | null {
    const r = computeDcf({ purchasePrice: d.askingPrice, noi: d.noi, entryCapRate: d.capRate || d.underwrite?.capRate });
    return r?.equityMultiple ?? null;
  }

  truncate(s: string, max: number): string {
    if (!s) return 'Property';
    return s.length > max ? s.slice(0, max) + '…' : s;
  }
}
