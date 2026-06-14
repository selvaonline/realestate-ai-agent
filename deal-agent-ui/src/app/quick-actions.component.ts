import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../environments/environment';

interface ActionDef {
  id: string;
  tool: string;
  label: string;
  icon: string;
  color: string;
  bgLight: string;
  fields: { key: string; label: string; type: string; default?: any }[];
  prefill: (deals: any[]) => Record<string, any>;
}

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="quick-actions">
      <div class="qa-header">
        <div class="qa-header-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <div>
          <span class="qa-title">Quick Actions</span>
          <span class="qa-sub">Run institutional tools directly on your results</span>
        </div>
      </div>

      <div class="qa-buttons">
        <button *ngFor="let a of actions"
                class="qa-btn"
                [style.background]="activeAction()?.id === a.id ? a.color : a.bgLight"
                [style.color]="activeAction()?.id === a.id ? '#fff' : a.color"
                [style.borderColor]="activeAction()?.id === a.id ? a.color : 'transparent'"
                (click)="toggleAction(a)"
                [disabled]="loading()">
          <span class="qa-icon">{{ a.icon }}</span>
          <span class="qa-label">{{ a.label }}</span>
        </button>
      </div>

      <!-- Inline Form -->
      <div class="qa-form" *ngIf="activeAction() && !result() && !loading()" [style.borderColor]="activeAction()!.color">
        <div class="qa-form-header">
          <span>{{ activeAction()!.icon }} {{ activeAction()!.label }}</span>
          <button class="qa-close" (click)="closeAction()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="qa-fields">
          <div class="qa-field" *ngFor="let f of activeAction()!.fields">
            <label>{{ f.label }}</label>
            <input *ngIf="f.type === 'text' || f.type === 'number'"
                   [type]="f.type"
                   [value]="formValues[f.key] ?? ''"
                   (input)="formValues[f.key] = $any($event.target).value"
                   [placeholder]="f.label" />
          </div>
        </div>
        <button class="qa-run" [style.background]="activeAction()!.color" (click)="execute()">
          Run {{ activeAction()!.label }}
        </button>
      </div>

      <!-- Loading -->
      <div class="qa-loading" *ngIf="loading()">
        <div class="qa-spinner" [style.borderTopColor]="activeAction()?.color || '#3b82f6'"></div>
        <span>Running {{ activeAction()?.label }}...</span>
      </div>

      <!-- Error -->
      <div class="qa-error" *ngIf="error()">
        <span>{{ error() }}</span>
        <button class="qa-close-sm" (click)="error.set(null)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Result Card -->
      <div class="qa-result" *ngIf="result()" [style.borderLeftColor]="activeAction()?.color || '#3b82f6'">
        <div class="qa-result-header">
          <span class="qa-result-title">{{ activeAction()?.icon }} {{ activeAction()?.label }} Results</span>
          <button class="qa-close" (click)="closeResult()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Tenant Credit Result -->
        <ng-container *ngIf="activeAction()?.tool === 'tenant_credit_analysis'">
          <div class="result-grid">
            <div class="result-stat">
              <span class="stat-label">Tenant</span>
              <span class="stat-value">{{ result().tenant }}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">Rating</span>
              <span class="stat-value" [class]="'rating-' + (result().rating || '').toLowerCase()">{{ result().ratingLabel || result().rating }}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">Outlook</span>
              <span class="stat-value">{{ result().outlook }}</span>
            </div>
            <div class="result-stat" *ngIf="result().financialHealth">
              <span class="stat-label">Revenue Stability</span>
              <span class="stat-value">{{ result().financialHealth.revenueStability }}</span>
            </div>
          </div>
          <div class="result-flags" *ngIf="result().watchlistFlags?.length">
            <span class="flag-title">Watchlist Flags:</span>
            <span class="flag" *ngFor="let f of result().watchlistFlags">{{ f }}</span>
          </div>
          <div class="result-rec" *ngIf="result().recommendation">{{ result().recommendation }}</div>
        </ng-container>

        <!-- Stress Test / VaR Result -->
        <ng-container *ngIf="activeAction()?.tool === 'portfolio_var'">
          <div class="result-grid">
            <div class="result-stat">
              <span class="stat-label">Portfolio IRR</span>
              <span class="stat-value">{{ formatPct(result().portfolioIrr) }}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">VaR (95%)</span>
              <span class="stat-value color-red">{{ formatPct(result().var95) }}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">VaR (99%)</span>
              <span class="stat-value color-red">{{ formatPct(result().var99) }}</span>
            </div>
          </div>
          <div class="result-stress" *ngIf="result().stressResults?.length">
            <div class="stress-title">Stress Scenarios</div>
            <div class="stress-row" *ngFor="let s of result().stressResults">
              <span class="stress-name">{{ s.scenario }}</span>
              <span class="stress-irr">IRR: {{ formatPct(s.portfolioIrr) }}</span>
              <span class="stress-delta" [class.negative]="s.irrDelta < 0">{{ s.irrDelta > 0 ? '+' : '' }}{{ formatPct(s.irrDelta) }}</span>
            </div>
          </div>
        </ng-container>

        <!-- LOI Result -->
        <ng-container *ngIf="activeAction()?.tool === 'generate_loi'">
          <div class="result-grid">
            <div class="result-stat">
              <span class="stat-label">Purchase Price</span>
              <span class="stat-value">{{ formatCurrency(result().summary?.price) }}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">Earnest Money</span>
              <span class="stat-value">{{ formatCurrency(result().summary?.earnestMoney) }}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">Equity Required</span>
              <span class="stat-value">{{ formatCurrency(result().summary?.equity) }}</span>
            </div>
          </div>
          <div class="loi-preview">
            <div class="loi-text">{{ result().loi?.slice(0, 800) }}{{ result().loi?.length > 800 ? '...' : '' }}</div>
            <button class="qa-copy" (click)="copyToClipboard(result().loi)">Copy Full LOI</button>
          </div>
        </ng-container>

        <!-- Market Intel Result -->
        <ng-container *ngIf="activeAction()?.tool === 'market_intel'">
          <div class="result-grid">
            <div class="result-stat">
              <span class="stat-label">Metro</span>
              <span class="stat-value">{{ result().metro }}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">Risk Score</span>
              <span class="stat-value" [class]="riskClass(result().riskScore)">{{ result().riskScore }}/100</span>
            </div>
            <div class="result-stat" *ngIf="result().macroContext?.treasury10y">
              <span class="stat-label">10Y Treasury</span>
              <span class="stat-value">{{ result().macroContext.treasury10y }}%</span>
            </div>
          </div>
          <div class="intel-section" *ngIf="result().summary">
            <div class="intel-summary">{{ result().summary }}</div>
          </div>
        </ng-container>

        <!-- Multi Asset Compare Result -->
        <ng-container *ngIf="activeAction()?.tool === 'multi_asset_compare'">
          <div class="compare-table" *ngIf="result().comparisonTable?.length">
            <div class="compare-header">
              <span>Asset</span><span>Return</span><span>Risk</span><span>Sharpe</span>
            </div>
            <div class="compare-row" *ngFor="let row of result().comparisonTable">
              <span class="compare-asset">{{ row.asset }}</span>
              <span>{{ formatPct(row.return) }}</span>
              <span>{{ formatPct(row.risk) }}</span>
              <span>{{ row.sharpe?.toFixed(2) }}</span>
            </div>
          </div>
          <div class="result-rec" *ngIf="result().recommendation">{{ result().recommendation }}</div>
        </ng-container>

        <!-- Risk Decomposition Result -->
        <ng-container *ngIf="activeAction()?.tool === 'risk_decomposition'">
          <div class="result-grid">
            <div class="result-stat">
              <span class="stat-label">Total Risk</span>
              <span class="stat-value" [class]="riskClass(result().totalRisk)">{{ result().totalRisk }}/100</span>
            </div>
          </div>
          <div class="risk-factors" *ngIf="result().factors?.length">
            <div class="factor-row" *ngFor="let f of result().factors">
              <span class="factor-name">{{ f.name }}</span>
              <div class="factor-bar-bg">
                <div class="factor-bar" [style.width.%]="f.score" [style.background]="f.score > 60 ? '#ef4444' : f.score > 30 ? '#f59e0b' : '#10b981'"></div>
              </div>
              <span class="factor-score">{{ f.score }}</span>
            </div>
          </div>
          <div class="result-rec" *ngIf="result().recommendation">{{ result().recommendation }}</div>
        </ng-container>

        <!-- Generic fallback -->
        <ng-container *ngIf="!isKnownTool()">
          <pre class="result-json">{{ result() | json }}</pre>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .quick-actions {
      margin: 20px 0 28px;
      padding: 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .qa-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .qa-header-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }
    .qa-title {
      display: block;
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }
    .qa-sub {
      display: block;
      font-size: 12px;
      color: #6b7280;
      margin-top: 1px;
    }
    .qa-buttons {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }
    .qa-buttons::-webkit-scrollbar { display: none; }
    .qa-btn {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 10px 16px;
      border: 2px solid transparent;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .qa-btn:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.1); }
    .qa-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .qa-icon { font-size: 16px; }

    .qa-form {
      margin-top: 14px;
      padding: 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid;
      border-radius: 12px;
    }
    .qa-form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 14px;
    }
    .qa-close {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
    }
    .qa-close:hover { color: #374151; background: #f1f5f9; }
    .qa-close-sm {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      padding: 2px;
      display: flex; align-items: center;
    }
    .qa-fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }
    .qa-field label {
      display: block;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .qa-field input {
      width: 100%;
      padding: 9px 12px;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      color: #111827;
      font-size: 13px;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .qa-field input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
    }
    .qa-run {
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .qa-run:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.15); }

    .qa-loading {
      margin-top: 14px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #475569;
      font-size: 14px;
      font-weight: 500;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .qa-spinner {
      width: 22px; height: 22px;
      border: 3px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: qa-spin 0.7s linear infinite;
    }
    @keyframes qa-spin { to { transform: rotate(360deg); } }

    .qa-error {
      margin-top: 14px;
      padding: 12px 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      color: #991b1b;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .qa-result {
      margin-top: 14px;
      padding: 18px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #3b82f6;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .qa-result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .qa-result-title {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }

    .result-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .result-stat {
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .stat-label {
      display: block;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 17px;
      font-weight: 700;
      color: #111827;
    }

    .rating-aaa, .rating-aa { color: #059669; }
    .rating-a { color: #10b981; }
    .rating-bbb { color: #d97706; }
    .rating-bb { color: #ea580c; }
    .rating-b, .rating-nr { color: #dc2626; }
    .color-red { color: #dc2626; }
    .color-green { color: #059669; }

    .result-flags {
      margin: 12px 0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .flag-title {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }
    .flag {
      padding: 4px 10px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 6px;
      font-size: 12px;
      color: #c2410c;
      font-weight: 500;
    }

    .result-rec {
      margin-top: 12px;
      padding: 12px 14px;
      background: #f0fdf4;
      border-left: 3px solid #10b981;
      border-radius: 8px;
      font-size: 13px;
      color: #065f46;
      line-height: 1.6;
    }

    .result-stress { margin: 12px 0; }
    .stress-title {
      font-size: 12px;
      font-weight: 700;
      color: #374151;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .stress-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .stress-name { color: #374151; flex: 1; font-weight: 500; }
    .stress-irr { color: #64748b; }
    .stress-delta { color: #059669; font-weight: 600; }
    .stress-delta.negative { color: #dc2626; }

    .loi-preview { margin-top: 12px; }
    .loi-text {
      padding: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 12px;
      color: #374151;
      line-height: 1.7;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;
    }
    .qa-copy {
      margin-top: 10px;
      padding: 8px 16px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      color: #1d4ed8;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .qa-copy:hover { background: #dbeafe; }

    .intel-summary {
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 13px;
      color: #374151;
      line-height: 1.6;
    }

    .compare-table { margin: 12px 0; }
    .compare-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 8px;
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      background: #f8fafc;
      border-radius: 8px 8px 0 0;
      border: 1px solid #e2e8f0;
      border-bottom: none;
    }
    .compare-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 8px;
      padding: 10px 12px;
      font-size: 13px;
      color: #374151;
      border: 1px solid #e2e8f0;
      border-top: none;
    }
    .compare-row:last-child { border-radius: 0 0 8px 8px; }
    .compare-asset { font-weight: 700; color: #111827; }

    .risk-factors { margin: 12px 0; }
    .factor-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }
    .factor-name {
      width: 140px;
      font-size: 13px;
      color: #374151;
      font-weight: 500;
    }
    .factor-bar-bg {
      flex: 1;
      height: 10px;
      background: #f1f5f9;
      border-radius: 5px;
      overflow: hidden;
    }
    .factor-bar {
      height: 100%;
      border-radius: 5px;
      transition: width 0.5s ease;
    }
    .factor-score {
      width: 32px;
      font-size: 13px;
      font-weight: 700;
      color: #374151;
      text-align: right;
    }

    .result-json {
      padding: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 11px;
      color: #475569;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }

    @media (max-width: 640px) {
      .quick-actions { padding: 14px; }
      .qa-fields { grid-template-columns: 1fr; }
      .result-grid { grid-template-columns: 1fr 1fr; }
      .qa-buttons { gap: 6px; }
      .qa-btn { padding: 8px 12px; font-size: 12px; }
      .compare-header, .compare-row { grid-template-columns: 1.5fr 1fr 1fr 1fr; font-size: 11px; }
    }
  `]
})
export class QuickActionsComponent {
  @Input() deals: any[] = [];

  private base = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');

  activeAction = signal<ActionDef | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  result = signal<any>(null);
  formValues: Record<string, any> = {};

  actions: ActionDef[] = [
    {
      id: 'stress', tool: 'portfolio_var', label: 'Stress Test', icon: '📊', color: '#dc2626', bgLight: '#fef2f2',
      fields: [
        { key: 'purchasePrice', label: 'Purchase Price', type: 'number' },
        { key: 'noi', label: 'NOI', type: 'number' },
        { key: 'ltv', label: 'LTV (%)', type: 'number', default: 65 },
        { key: 'interestRate', label: 'Interest Rate (%)', type: 'number', default: 6.5 },
      ],
      prefill: (deals) => {
        const d = deals[0];
        return {
          purchasePrice: d?.askingPrice || d?.price || '',
          noi: d?.noi || '',
          ltv: 65,
          interestRate: 6.5,
        };
      }
    },
    {
      id: 'credit', tool: 'tenant_credit_analysis', label: 'Tenant Credit', icon: '🏢', color: '#2563eb', bgLight: '#eff6ff',
      fields: [
        { key: 'tenantName', label: 'Tenant Name', type: 'text' },
        { key: 'leaseTermYears', label: 'Lease Term (years)', type: 'number' },
        { key: 'annualRent', label: 'Annual Rent', type: 'number' },
      ],
      prefill: (deals) => {
        const d = deals[0];
        const tenant = d?.tenant || d?.tenantName || d?.raw?.peFactors?.tenant || '';
        return { tenantName: tenant, leaseTermYears: '', annualRent: d?.noi || '' };
      }
    },
    {
      id: 'loi', tool: 'generate_loi', label: 'Generate LOI', icon: '📝', color: '#7c3aed', bgLight: '#f5f3ff',
      fields: [
        { key: 'propertyTitle', label: 'Property Title', type: 'text' },
        { key: 'purchasePrice', label: 'Purchase Price', type: 'number' },
        { key: 'buyerName', label: 'Buyer Name', type: 'text', default: 'DealSense Fund I, LLC' },
        { key: 'dueDiligenceDays', label: 'Due Diligence (days)', type: 'number', default: 45 },
      ],
      prefill: (deals) => {
        const d = deals[0];
        return {
          propertyTitle: d?.title || '',
          purchasePrice: d?.askingPrice || d?.price || '',
          buyerName: 'DealSense Fund I, LLC',
          dueDiligenceDays: 45,
        };
      }
    },
    {
      id: 'market', tool: 'market_intel', label: 'Market Intel', icon: '🌐', color: '#059669', bgLight: '#ecfdf5',
      fields: [
        { key: 'metro', label: 'Metro / City', type: 'text' },
        { key: 'propertyType', label: 'Property Type', type: 'text' },
      ],
      prefill: (deals) => {
        const d = deals[0];
        const addr = d?.address || d?.title || '';
        const parts = addr.split(',');
        const metro = parts.length >= 2 ? parts[parts.length - 2].trim() : addr;
        return { metro, propertyType: d?.assetType || 'retail' };
      }
    },
    {
      id: 'compare', tool: 'multi_asset_compare', label: 'Compare Assets', icon: '⚖️', color: '#d97706', bgLight: '#fffbeb',
      fields: [
        { key: 'creIrr', label: 'CRE IRR (%)', type: 'number' },
        { key: 'holdYears', label: 'Hold Period (years)', type: 'number', default: 5 },
        { key: 'riskScore', label: 'Risk Score', type: 'number' },
      ],
      prefill: (deals) => {
        const d = deals[0];
        const capRate = d?.capRate || d?.raw?.peFactors?.capRate;
        return {
          creIrr: capRate ? (capRate * 100 + 3).toFixed(1) : '',
          holdYears: 5,
          riskScore: d?.raw?.riskScore || '',
        };
      }
    },
    {
      id: 'risk', tool: 'risk_decomposition', label: 'Risk Breakdown', icon: '🔍', color: '#db2777', bgLight: '#fdf2f8',
      fields: [
        { key: 'purchasePrice', label: 'Purchase Price', type: 'number' },
        { key: 'noi', label: 'NOI', type: 'number' },
        { key: 'market', label: 'Market / Metro', type: 'text' },
        { key: 'tenantName', label: 'Tenant', type: 'text' },
      ],
      prefill: (deals) => {
        const d = deals[0];
        const addr = d?.address || d?.title || '';
        const parts = addr.split(',');
        const market = parts.length >= 2 ? parts[parts.length - 2].trim() : '';
        return {
          purchasePrice: d?.askingPrice || d?.price || '',
          noi: d?.noi || '',
          market,
          tenantName: d?.tenant || d?.tenantName || d?.raw?.peFactors?.tenant || '',
        };
      }
    },
  ];

  toggleAction(action: ActionDef) {
    if (this.activeAction()?.id === action.id) {
      this.closeAction();
      return;
    }
    this.result.set(null);
    this.error.set(null);
    this.formValues = action.prefill(this.deals);
    this.activeAction.set(action);
  }

  closeAction() {
    this.activeAction.set(null);
    this.result.set(null);
    this.error.set(null);
    this.formValues = {};
  }

  closeResult() {
    this.result.set(null);
  }

  async execute() {
    const action = this.activeAction();
    if (!action) return;

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    const args: Record<string, any> = {};
    for (const f of action.fields) {
      let val = this.formValues[f.key];
      if (f.type === 'number' && val !== '' && val != null) {
        val = Number(val);
        if (isNaN(val)) continue;
      }
      if (val !== '' && val != null) {
        args[f.key] = val;
      }
    }

    if (action.tool === 'portfolio_var') {
      const props = this.deals.slice(0, 5).map(d => ({
        purchasePrice: d.askingPrice || d.price || args['purchasePrice'],
        noi: d.noi || args['noi'],
        ltv: (args['ltv'] || 65) / 100,
        interestRate: (args['interestRate'] || 6.5) / 100,
        title: d.title,
      })).filter(p => p.purchasePrice && p.noi);

      if (props.length === 0 && args['purchasePrice'] && args['noi']) {
        props.push({
          purchasePrice: args['purchasePrice'],
          noi: args['noi'],
          ltv: (args['ltv'] || 65) / 100,
          interestRate: (args['interestRate'] || 6.5) / 100,
          title: 'Manual Entry',
        });
      }

      delete args['ltv'];
      delete args['interestRate'];
      delete args['purchasePrice'];
      delete args['noi'];
      args['properties'] = props;
    }

    if (action.tool === 'multi_asset_compare' && args['creIrr']) {
      args['creIrr'] = args['creIrr'] / 100;
    }

    try {
      const res = await fetch(`${this.base}/api/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: action.tool, args }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Tool execution failed');

      this.result.set(data.result);
    } catch (e: any) {
      this.error.set(e.message || 'Failed to execute tool');
    } finally {
      this.loading.set(false);
    }
  }

  formatPct(val: any): string {
    if (val == null) return 'N/A';
    return (val * 100).toFixed(2) + '%';
  }

  formatCurrency(val: any): string {
    if (val == null) return 'N/A';
    return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  riskClass(score: number): string {
    if (score <= 30) return 'color-green';
    if (score <= 50) return 'rating-bbb';
    return 'color-red';
  }

  isKnownTool(): boolean {
    const t = this.activeAction()?.tool;
    return ['tenant_credit_analysis', 'portfolio_var', 'generate_loi', 'market_intel', 'multi_asset_compare', 'risk_decomposition'].includes(t || '');
  }

  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* fallback ignored */ }
  }
}
