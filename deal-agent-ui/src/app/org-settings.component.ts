// org-settings.component.ts — Organization Settings panel
// Comprehensive customization: Scoring Model, Fund Mandates, DCF Defaults,
// Market Preferences, Tenant Policy, Return Targets, Data Sources
import { Component, signal, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface OrgSettings {
  // PE Scoring Weights (must sum to 100)
  peWeights: {
    tenantLease: number;
    yieldSpread: number;
    marketQuality: number;
    assetFit: number;
    dealEconomics: number;
    executionRisk: number;
    mobility: number;
  };
  // Risk Model Parameters
  riskModel: {
    treasuryBaseline: number;   // e.g. 0.035
    cpiNeutral: number;         // e.g. 0.02
    unemploymentSensitivity: number; // bps per 1pt
    curveInversionPenalty: number;   // points added
  };
  // Fund Mandates
  fundMandates: {
    maxSingleAssetPct: number;
    maxGeoPct: number;
    minDscr: number;
    maxLtv: number;
    minPeScore: number;
    preferredReturn: number;
    minDealSize: number;
    maxDealSize: number;
  };
  // DCF Defaults
  dcfDefaults: {
    holdYears: number;
    ltv: number;
    interestRate: number;
    noiGrowth: number;
    exitCapSpread: number;
    vacancyReserve: number;
    capexPerSqft: number;
  };
  // Return Targets
  returnTargets: {
    minIrr: number;
    minCashOnCash: number;
    minEquityMultiple: number;
    targetCapSpread: number; // bps over Treasury
  };
  // Market Preferences
  marketPrefs: {
    preferredMarkets: string[];
    excludedMarkets: string[];
    marketTiers: string[];     // e.g. ["A", "B"]
    preferredPropertyTypes: string[];
    leasePreference: string;   // "NNN" | "modified_gross" | "full_service" | "any"
  };
  // Tenant Policy
  tenantPolicy: {
    minCreditRating: string;
    preferredSectors: string[];
    maxOccupancyCostRatio: number;
    minLeaseTermYears: number;
  };
  // Data Sources
  dataSources: {
    enabledSources: string[];
    apiKeys: Record<string, string>;
  };
}

const DEFAULT_SETTINGS: OrgSettings = {
  peWeights: { tenantLease: 20, yieldSpread: 15, marketQuality: 20, assetFit: 10, dealEconomics: 15, executionRisk: 10, mobility: 10 },
  riskModel: { treasuryBaseline: 0.035, cpiNeutral: 0.02, unemploymentSensitivity: 25, curveInversionPenalty: 10 },
  fundMandates: { maxSingleAssetPct: 0.10, maxGeoPct: 0.25, minDscr: 1.25, maxLtv: 0.65, minPeScore: 60, preferredReturn: 0.08, minDealSize: 1000000, maxDealSize: 100000000 },
  dcfDefaults: { holdYears: 5, ltv: 0.65, interestRate: 0.055, noiGrowth: 0.02, exitCapSpread: 0.005, vacancyReserve: 0.05, capexPerSqft: 2 },
  returnTargets: { minIrr: 0.12, minCashOnCash: 0.08, minEquityMultiple: 1.5, targetCapSpread: 250 },
  marketPrefs: { preferredMarkets: [], excludedMarkets: [], marketTiers: ["A", "B"], preferredPropertyTypes: [], leasePreference: "any" },
  tenantPolicy: { minCreditRating: "BBB-", preferredSectors: [], maxOccupancyCostRatio: 0.12, minLeaseTermYears: 3 },
  dataSources: { enabledSources: ["loopnet", "crexi", "fred", "bls"], apiKeys: {} },
};

const INSTITUTIONAL_PRESET: Partial<OrgSettings> = {
  peWeights: { tenantLease: 25, yieldSpread: 18, marketQuality: 15, assetFit: 12, dealEconomics: 10, executionRisk: 10, mobility: 10 },
  fundMandates: { maxSingleAssetPct: 0.05, maxGeoPct: 0.20, minDscr: 1.40, maxLtv: 0.55, minPeScore: 75, preferredReturn: 0.08, minDealSize: 5000000, maxDealSize: 200000000 },
  returnTargets: { minIrr: 0.15, minCashOnCash: 0.10, minEquityMultiple: 1.8, targetCapSpread: 300 },
  tenantPolicy: { minCreditRating: "BBB", preferredSectors: ["healthcare", "government", "logistics", "grocery"], maxOccupancyCostRatio: 0.10, minLeaseTermYears: 5 },
};

const VALUE_ADD_PRESET: Partial<OrgSettings> = {
  peWeights: { tenantLease: 12, yieldSpread: 22, marketQuality: 18, assetFit: 12, dealEconomics: 14, executionRisk: 10, mobility: 12 },
  fundMandates: { maxSingleAssetPct: 0.15, maxGeoPct: 0.30, minDscr: 1.15, maxLtv: 0.70, minPeScore: 50, preferredReturn: 0.10, minDealSize: 500000, maxDealSize: 50000000 },
  returnTargets: { minIrr: 0.18, minCashOnCash: 0.06, minEquityMultiple: 2.0, targetCapSpread: 350 },
  tenantPolicy: { minCreditRating: "BB", preferredSectors: [], maxOccupancyCostRatio: 0.15, minLeaseTermYears: 2 },
};

@Component({
  selector: 'app-org-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="settings-panel" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="panel-header">
          <div class="header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            <h2>Organization Settings</h2>
          </div>
          <div class="header-right">
            <div class="preset-btns">
              <button class="preset-btn" (click)="applyPreset('default')" title="Reset all to defaults">Default</button>
              <button class="preset-btn institutional" (click)="applyPreset('institutional')" title="Conservative institutional fund">Institutional</button>
              <button class="preset-btn value-add" (click)="applyPreset('value_add')" title="Value-add / opportunistic">Value-Add</button>
            </div>
            <button class="close-btn" (click)="close.emit()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button *ngFor="let tab of tabs" class="tab" [class.active]="activeTab() === tab.key" (click)="activeTab.set(tab.key)">
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">

          <!-- Scoring Model -->
          <div *ngIf="activeTab() === 'scoring'" class="section">
            <div class="section-desc">Adjust PE scoring factor weights. These control how properties are ranked. Weights must sum to 100.</div>
            <div class="weight-sum" [class.error]="getWeightSum() !== 100">
              Total: {{ getWeightSum() }}/100
              <span *ngIf="getWeightSum() !== 100" class="sum-warn">Must equal 100</span>
            </div>
            <div class="slider-group">
              <div class="slider-row" *ngFor="let w of weightKeys">
                <label>{{ weightLabels[w] }}</label>
                <input type="range" [min]="0" [max]="40" [ngModel]="s().peWeights[w]" (ngModelChange)="updateWeight(w, $event)">
                <span class="slider-value">{{ s().peWeights[w] }}</span>
              </div>
            </div>

            <div class="sub-header">Risk Model Parameters</div>
            <div class="field-grid">
              <div class="field">
                <label>Treasury Baseline</label>
                <div class="input-wrap"><input type="number" step="0.001" [ngModel]="s().riskModel.treasuryBaseline" (ngModelChange)="updateField('riskModel', 'treasuryBaseline', $event)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>CPI Neutral Target</label>
                <div class="input-wrap"><input type="number" step="0.001" [ngModel]="s().riskModel.cpiNeutral" (ngModelChange)="updateField('riskModel', 'cpiNeutral', $event)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Unemployment Sensitivity</label>
                <div class="input-wrap"><input type="number" step="1" [ngModel]="s().riskModel.unemploymentSensitivity" (ngModelChange)="updateField('riskModel', 'unemploymentSensitivity', $event)"><span class="suffix">bps/pt</span></div>
              </div>
              <div class="field">
                <label>Curve Inversion Penalty</label>
                <div class="input-wrap"><input type="number" step="1" [ngModel]="s().riskModel.curveInversionPenalty" (ngModelChange)="updateField('riskModel', 'curveInversionPenalty', $event)"><span class="suffix">pts</span></div>
              </div>
            </div>
          </div>

          <!-- Fund Mandates -->
          <div *ngIf="activeTab() === 'mandates'" class="section">
            <div class="section-desc">Set fund-level compliance rules. Deals violating these mandates will be flagged.</div>
            <div class="field-grid">
              <div class="field">
                <label>Max Single Asset %</label>
                <div class="input-wrap"><input type="number" step="0.01" [ngModel]="s().fundMandates.maxSingleAssetPct * 100" (ngModelChange)="updateField('fundMandates', 'maxSingleAssetPct', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Max Geo Concentration</label>
                <div class="input-wrap"><input type="number" step="0.01" [ngModel]="s().fundMandates.maxGeoPct * 100" (ngModelChange)="updateField('fundMandates', 'maxGeoPct', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Min DSCR</label>
                <div class="input-wrap"><input type="number" step="0.05" [ngModel]="s().fundMandates.minDscr" (ngModelChange)="updateField('fundMandates', 'minDscr', $event)"><span class="suffix">x</span></div>
              </div>
              <div class="field">
                <label>Max LTV</label>
                <div class="input-wrap"><input type="number" step="0.05" [ngModel]="s().fundMandates.maxLtv * 100" (ngModelChange)="updateField('fundMandates', 'maxLtv', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Min PE Score</label>
                <div class="input-wrap"><input type="number" step="5" [ngModel]="s().fundMandates.minPeScore" (ngModelChange)="updateField('fundMandates', 'minPeScore', $event)"></div>
              </div>
              <div class="field">
                <label>Preferred Return</label>
                <div class="input-wrap"><input type="number" step="0.5" [ngModel]="s().fundMandates.preferredReturn * 100" (ngModelChange)="updateField('fundMandates', 'preferredReturn', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Min Deal Size</label>
                <div class="input-wrap"><span class="prefix">$</span><input type="number" step="100000" [ngModel]="s().fundMandates.minDealSize" (ngModelChange)="updateField('fundMandates', 'minDealSize', $event)"></div>
              </div>
              <div class="field">
                <label>Max Deal Size</label>
                <div class="input-wrap"><span class="prefix">$</span><input type="number" step="1000000" [ngModel]="s().fundMandates.maxDealSize" (ngModelChange)="updateField('fundMandates', 'maxDealSize', $event)"></div>
              </div>
            </div>
          </div>

          <!-- Return Targets -->
          <div *ngIf="activeTab() === 'returns'" class="section">
            <div class="section-desc">Set minimum return thresholds. Deals below these targets will be flagged for additional review.</div>
            <div class="field-grid">
              <div class="field">
                <label>Min IRR</label>
                <div class="input-wrap"><input type="number" step="0.5" [ngModel]="s().returnTargets.minIrr * 100" (ngModelChange)="updateField('returnTargets', 'minIrr', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Min Cash-on-Cash</label>
                <div class="input-wrap"><input type="number" step="0.5" [ngModel]="s().returnTargets.minCashOnCash * 100" (ngModelChange)="updateField('returnTargets', 'minCashOnCash', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Min Equity Multiple</label>
                <div class="input-wrap"><input type="number" step="0.1" [ngModel]="s().returnTargets.minEquityMultiple" (ngModelChange)="updateField('returnTargets', 'minEquityMultiple', $event)"><span class="suffix">x</span></div>
              </div>
              <div class="field">
                <label>Target Cap Spread</label>
                <div class="input-wrap"><input type="number" step="25" [ngModel]="s().returnTargets.targetCapSpread" (ngModelChange)="updateField('returnTargets', 'targetCapSpread', $event)"><span class="suffix">bps</span></div>
              </div>
            </div>
          </div>

          <!-- DCF Defaults -->
          <div *ngIf="activeTab() === 'dcf'" class="section">
            <div class="section-desc">Default assumptions for DCF / pro forma analysis. Applied when running DCF on any property.</div>
            <div class="field-grid">
              <div class="field">
                <label>Hold Period</label>
                <div class="input-wrap"><input type="number" step="1" min="1" max="30" [ngModel]="s().dcfDefaults.holdYears" (ngModelChange)="updateField('dcfDefaults', 'holdYears', $event)"><span class="suffix">yrs</span></div>
              </div>
              <div class="field">
                <label>LTV</label>
                <div class="input-wrap"><input type="number" step="5" [ngModel]="s().dcfDefaults.ltv * 100" (ngModelChange)="updateField('dcfDefaults', 'ltv', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Interest Rate</label>
                <div class="input-wrap"><input type="number" step="0.25" [ngModel]="s().dcfDefaults.interestRate * 100" (ngModelChange)="updateField('dcfDefaults', 'interestRate', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>NOI Growth</label>
                <div class="input-wrap"><input type="number" step="0.25" [ngModel]="s().dcfDefaults.noiGrowth * 100" (ngModelChange)="updateField('dcfDefaults', 'noiGrowth', $event / 100)"><span class="suffix">%/yr</span></div>
              </div>
              <div class="field">
                <label>Exit Cap Spread</label>
                <div class="input-wrap"><input type="number" step="0.1" [ngModel]="s().dcfDefaults.exitCapSpread * 100" (ngModelChange)="updateField('dcfDefaults', 'exitCapSpread', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Vacancy Reserve</label>
                <div class="input-wrap"><input type="number" step="1" [ngModel]="s().dcfDefaults.vacancyReserve * 100" (ngModelChange)="updateField('dcfDefaults', 'vacancyReserve', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>CapEx Reserve</label>
                <div class="input-wrap"><span class="prefix">$</span><input type="number" step="0.5" [ngModel]="s().dcfDefaults.capexPerSqft" (ngModelChange)="updateField('dcfDefaults', 'capexPerSqft', $event)"><span class="suffix">/sqft</span></div>
              </div>
            </div>
          </div>

          <!-- Market Preferences -->
          <div *ngIf="activeTab() === 'markets'" class="section">
            <div class="section-desc">Define target markets and property types. The agent will prioritize these in searches.</div>
            <div class="field">
              <label>Market Tiers</label>
              <div class="chip-select">
                <button *ngFor="let tier of ['A', 'B', 'C']" class="chip" [class.selected]="s().marketPrefs.marketTiers.includes(tier)" (click)="toggleArrayItem('marketPrefs', 'marketTiers', tier)">Tier {{ tier }}</button>
              </div>
            </div>
            <div class="field">
              <label>Preferred Markets</label>
              <div class="chip-select">
                <button *ngFor="let m of allMarkets" class="chip" [class.selected]="s().marketPrefs.preferredMarkets.includes(m)" (click)="toggleArrayItem('marketPrefs', 'preferredMarkets', m)">{{ m }}</button>
              </div>
            </div>
            <div class="field">
              <label>Property Types</label>
              <div class="chip-select">
                <button *ngFor="let pt of allPropertyTypes" class="chip" [class.selected]="s().marketPrefs.preferredPropertyTypes.includes(pt)" (click)="toggleArrayItem('marketPrefs', 'preferredPropertyTypes', pt)">{{ pt }}</button>
              </div>
            </div>
            <div class="field">
              <label>Lease Preference</label>
              <select [ngModel]="s().marketPrefs.leasePreference" (ngModelChange)="updateField('marketPrefs', 'leasePreference', $event)">
                <option value="any">Any</option>
                <option value="NNN">NNN (Triple Net)</option>
                <option value="modified_gross">Modified Gross</option>
                <option value="full_service">Full Service</option>
              </select>
            </div>
          </div>

          <!-- Tenant Policy -->
          <div *ngIf="activeTab() === 'tenant'" class="section">
            <div class="section-desc">Set minimum tenant credit standards. Tenants below threshold will trigger watchlist flags.</div>
            <div class="field-grid two-col">
              <div class="field">
                <label>Min Credit Rating</label>
                <select [ngModel]="s().tenantPolicy.minCreditRating" (ngModelChange)="updateField('tenantPolicy', 'minCreditRating', $event)">
                  <option *ngFor="let r of creditRatings" [value]="r">{{ r }}</option>
                </select>
              </div>
              <div class="field">
                <label>Max Occupancy Cost Ratio</label>
                <div class="input-wrap"><input type="number" step="1" [ngModel]="s().tenantPolicy.maxOccupancyCostRatio * 100" (ngModelChange)="updateField('tenantPolicy', 'maxOccupancyCostRatio', $event / 100)"><span class="suffix">%</span></div>
              </div>
              <div class="field">
                <label>Min Lease Term</label>
                <div class="input-wrap"><input type="number" step="1" [ngModel]="s().tenantPolicy.minLeaseTermYears" (ngModelChange)="updateField('tenantPolicy', 'minLeaseTermYears', $event)"><span class="suffix">yrs</span></div>
              </div>
            </div>
            <div class="field">
              <label>Preferred Sectors</label>
              <div class="chip-select">
                <button *ngFor="let sec of allSectors" class="chip" [class.selected]="s().tenantPolicy.preferredSectors.includes(sec)" (click)="toggleArrayItem('tenantPolicy', 'preferredSectors', sec)">{{ sec }}</button>
              </div>
            </div>
          </div>

          <!-- Data Sources -->
          <div *ngIf="activeTab() === 'sources'" class="section">
            <div class="section-desc">Enable or disable data sources. API keys are stored locally and never sent to our servers.</div>
            <div class="source-list">
              <div *ngFor="let src of allSources" class="source-item">
                <div class="source-row">
                  <span class="source-icon">{{ src.icon }}</span>
                  <div class="source-info">
                    <strong>{{ src.name }}</strong>
                    <span class="source-desc">{{ src.description }}</span>
                  </div>
                  <label class="toggle-switch">
                    <input type="checkbox" [checked]="s().dataSources.enabledSources.includes(src.id)" (change)="toggleSource(src.id)">
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div *ngIf="src.requiresApiKey && s().dataSources.enabledSources.includes(src.id)" class="api-key-row">
                  <input type="password" [value]="s().dataSources.apiKeys[src.id] || ''" (input)="updateApiKey(src.id, $event)" placeholder="API Key (optional)">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="panel-footer">
          <div class="footer-left">
            <span class="save-status" *ngIf="saved()">Settings saved</span>
          </div>
          <div class="footer-right">
            <button class="btn-secondary" (click)="close.emit()">Cancel</button>
            <button class="btn-primary" (click)="saveAndClose()">Apply Settings</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999; animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .settings-panel {
      background: #fff; border-radius: 16px; width: 94%; max-width: 780px;
      max-height: 88vh; display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.25s ease;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px; border-bottom: 1px solid #e5e7eb;
    }
    .header-left {
      display: flex; align-items: center; gap: 10px; color: #0f172a;
    }
    .header-left h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .header-left svg { color: #6366f1; }
    .header-right { display: flex; align-items: center; gap: 12px; }
    .preset-btns { display: flex; gap: 6px; }
    .preset-btn {
      padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600;
      border: 1px solid #e5e7eb; background: #f9fafb; color: #374151;
      cursor: pointer; transition: all 0.15s;
    }
    .preset-btn:hover { border-color: #6366f1; color: #6366f1; }
    .preset-btn.institutional { border-color: #dbeafe; background: #eff6ff; color: #1d4ed8; }
    .preset-btn.institutional:hover { background: #dbeafe; }
    .preset-btn.value-add { border-color: #fde68a; background: #fffbeb; color: #d97706; }
    .preset-btn.value-add:hover { background: #fef3c7; }
    .close-btn {
      background: none; border: none; color: #9ca3af; cursor: pointer;
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      border-radius: 6px; transition: all 0.15s;
    }
    .close-btn:hover { background: #f3f4f6; color: #374151; }

    /* Tabs */
    .tabs {
      display: flex; gap: 2px; padding: 0 24px;
      border-bottom: 1px solid #e5e7eb; overflow-x: auto;
    }
    .tab {
      display: flex; align-items: center; gap: 5px;
      padding: 10px 14px; border: none; background: none;
      font-size: 12px; font-weight: 500; color: #6b7280;
      cursor: pointer; border-bottom: 2px solid transparent;
      white-space: nowrap; transition: all 0.15s;
    }
    .tab:hover { color: #374151; }
    .tab.active { color: #6366f1; border-bottom-color: #6366f1; font-weight: 600; }
    .tab-icon { font-size: 14px; }

    /* Tab content */
    .tab-content {
      flex: 1; overflow-y: auto; padding: 20px 24px;
    }
    .section-desc {
      font-size: 13px; color: #6b7280; margin-bottom: 16px; line-height: 1.5;
    }

    /* Weight sliders */
    .weight-sum {
      font-size: 12px; font-weight: 600; color: #059669;
      margin-bottom: 12px; padding: 6px 12px; background: #f0fdf4;
      border-radius: 6px; display: inline-block;
    }
    .weight-sum.error { color: #dc2626; background: #fef2f2; }
    .sum-warn { margin-left: 8px; font-weight: 400; }

    .slider-group { display: flex; flex-direction: column; gap: 10px; }
    .slider-row {
      display: flex; align-items: center; gap: 12px;
    }
    .slider-row label {
      width: 150px; font-size: 13px; color: #374151; font-weight: 500; flex-shrink: 0;
    }
    .slider-row input[type="range"] {
      flex: 1; height: 6px; -webkit-appearance: none; appearance: none;
      background: #e5e7eb; border-radius: 3px; outline: none;
    }
    .slider-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 18px; height: 18px;
      background: #6366f1; border-radius: 50%; cursor: pointer;
      border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .slider-value {
      width: 28px; text-align: right; font-size: 13px;
      font-weight: 600; color: #6366f1;
    }

    .sub-header {
      font-size: 14px; font-weight: 600; color: #1f2937;
      margin: 20px 0 12px; padding-top: 16px; border-top: 1px solid #f3f4f6;
    }

    /* Field grid */
    .field-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    }
    .field-grid.two-col { grid-template-columns: 1fr 1fr; }
    .field { margin-bottom: 12px; }
    .field label {
      display: block; font-size: 12px; font-weight: 500;
      color: #6b7280; margin-bottom: 4px;
    }
    .input-wrap {
      display: flex; align-items: center; border: 1px solid #e5e7eb;
      border-radius: 8px; overflow: hidden; background: #fff;
      transition: border-color 0.15s;
    }
    .input-wrap:focus-within { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.1); }
    .input-wrap input {
      flex: 1; border: none; padding: 8px 10px; font-size: 13px;
      color: #1f2937; outline: none; background: none; min-width: 0;
    }
    .suffix, .prefix {
      font-size: 11px; color: #9ca3af; padding: 0 8px;
      background: #f9fafb; border-left: 1px solid #e5e7eb;
      height: 100%; display: flex; align-items: center;
    }
    .prefix { border-left: none; border-right: 1px solid #e5e7eb; }

    select {
      width: 100%; padding: 8px 10px; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; color: #1f2937;
      background: #fff; cursor: pointer; outline: none;
    }
    select:focus { border-color: #6366f1; }

    /* Chip select */
    .chip-select {
      display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;
    }
    .chip {
      padding: 5px 12px; border-radius: 16px; font-size: 12px; font-weight: 500;
      border: 1px solid #e5e7eb; background: #fff; color: #6b7280;
      cursor: pointer; transition: all 0.15s;
    }
    .chip:hover { border-color: #a5b4fc; }
    .chip.selected {
      background: #6366f1; color: #fff; border-color: #6366f1;
    }

    /* Data sources */
    .source-list { display: flex; flex-direction: column; gap: 10px; }
    .source-item {
      background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 10px; padding: 12px; transition: border-color 0.15s;
    }
    .source-item:hover { border-color: #d1d5db; }
    .source-row { display: flex; align-items: center; gap: 10px; }
    .source-icon { font-size: 20px; flex-shrink: 0; }
    .source-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .source-info strong { color: #1f2937; font-size: 13px; }
    .source-desc { color: #9ca3af; font-size: 11px; }
    .toggle-switch { position: relative; display: inline-block; flex-shrink: 0; cursor: pointer; }
    .toggle-switch input { display: none; }
    .toggle-slider {
      display: block; width: 40px; height: 22px; background: #d1d5db;
      border-radius: 11px; position: relative; transition: background 0.3s;
    }
    .toggle-switch input:checked + .toggle-slider { background: #6366f1; }
    .toggle-slider::before {
      content: ''; position: absolute; width: 18px; height: 18px;
      background: white; border-radius: 50%; top: 2px; left: 2px;
      transition: transform 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .toggle-switch input:checked + .toggle-slider::before { transform: translateX(18px); }
    .api-key-row { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
    .api-key-row input {
      width: 100%; border: 1px solid #e5e7eb; border-radius: 6px;
      padding: 6px 10px; font-size: 12px; color: #374151;
      background: #fff; outline: none; box-sizing: border-box;
    }
    .api-key-row input:focus { border-color: #6366f1; }

    /* Footer */
    .panel-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px; border-top: 1px solid #e5e7eb;
    }
    .save-status {
      font-size: 12px; color: #059669; font-weight: 500;
      animation: fadeIn 0.3s ease;
    }
    .footer-right { display: flex; gap: 8px; }
    .btn-secondary {
      padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
      border: 1px solid #e5e7eb; background: #fff; color: #374151;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-secondary:hover { background: #f3f4f6; }
    .btn-primary {
      padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
      border: none; background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff; cursor: pointer; transition: all 0.15s;
    }
    .btn-primary:hover { background: linear-gradient(135deg, #4f46e5, #4338ca); }

    @media (max-width: 640px) {
      .settings-panel { max-height: 95vh; border-radius: 12px 12px 0 0; }
      .panel-header { padding: 16px; }
      .tabs { padding: 0 12px; }
      .tab { padding: 8px 10px; font-size: 11px; }
      .tab-content { padding: 16px; }
      .field-grid { grid-template-columns: 1fr; }
      .slider-row label { width: 110px; font-size: 12px; }
      .preset-btns { display: none; }
    }
  `]
})
export class OrgSettingsComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() settingsChanged = new EventEmitter<OrgSettings>();

  s = signal<OrgSettings>(structuredClone(DEFAULT_SETTINGS));
  activeTab = signal('scoring');
  saved = signal(false);

  tabs = [
    { key: 'scoring', label: 'Scoring Model', icon: '⭐' },
    { key: 'mandates', label: 'Fund Mandates', icon: '📋' },
    { key: 'returns', label: 'Return Targets', icon: '📊' },
    { key: 'dcf', label: 'DCF Defaults', icon: '🧮' },
    { key: 'markets', label: 'Markets', icon: '🗺️' },
    { key: 'tenant', label: 'Tenant Policy', icon: '🏢' },
    { key: 'sources', label: 'Data Sources', icon: '🔌' },
  ];

  weightKeys: (keyof OrgSettings['peWeights'])[] = ['tenantLease', 'yieldSpread', 'marketQuality', 'assetFit', 'dealEconomics', 'executionRisk', 'mobility'];
  weightLabels: Record<string, string> = {
    tenantLease: 'Tenant / Lease Quality',
    yieldSpread: 'Yield vs Benchmark',
    marketQuality: 'Market Quality',
    assetFit: 'Asset Fit',
    dealEconomics: 'Deal Economics',
    executionRisk: 'Execution Risk',
    mobility: 'Mobility / Real-World Activity',
  };

  creditRatings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'NR'];

  allMarkets = ['Dallas', 'Houston', 'Miami', 'New York', 'Los Angeles', 'Chicago', 'Atlanta', 'Phoenix', 'Tampa', 'Orlando', 'Austin', 'Denver', 'Seattle', 'Boston', 'San Francisco', 'Nashville', 'Charlotte', 'Raleigh', 'Salt Lake City', 'San Antonio'];
  allPropertyTypes = ['NNN Retail', 'Industrial', 'Medical Office', 'Multi-Family', 'Office', 'Self-Storage', 'Grocery-Anchored', 'Mixed-Use'];
  allSectors = ['healthcare', 'government', 'logistics', 'grocery', 'pharmacy', 'food & beverage', 'discount retail', 'auto parts', 'home improvement', 'convenience'];

  allSources = [
    { id: 'loopnet', name: 'LoopNet', icon: '🏢', description: 'Commercial real estate listings', requiresApiKey: false },
    { id: 'crexi', name: 'CREXi', icon: '🏗️', description: 'Commercial real estate exchange', requiresApiKey: false },
    { id: 'zillow', name: 'Zillow', icon: '🏠', description: 'Residential & commercial listings', requiresApiKey: true },
    { id: 'batchdata', name: 'BatchData', icon: '📊', description: 'Property data & analytics', requiresApiKey: true },
    { id: 'fred', name: 'FRED', icon: '📈', description: 'Federal Reserve economic data', requiresApiKey: false },
    { id: 'bls', name: 'BLS', icon: '👷', description: 'Bureau of Labor Statistics', requiresApiKey: false },
  ];

  ngOnInit() {
    this.loadSettings();
  }

  getWeightSum(): number {
    const w = this.s().peWeights;
    return w.tenantLease + w.yieldSpread + w.marketQuality + w.assetFit + w.dealEconomics + w.executionRisk + (w.mobility || 0);
  }

  updateWeight(key: keyof OrgSettings['peWeights'], value: number) {
    this.s.update(s => ({
      ...s,
      peWeights: { ...s.peWeights, [key]: value }
    }));
  }

  updateField(section: string, key: string, value: any) {
    this.s.update(s => ({
      ...s,
      [section]: { ...(s as any)[section], [key]: value }
    }));
  }

  toggleArrayItem(section: string, key: string, item: string) {
    this.s.update(s => {
      const arr = [...((s as any)[section][key] as string[])];
      const idx = arr.indexOf(item);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(item);
      return { ...s, [section]: { ...(s as any)[section], [key]: arr } };
    });
  }

  toggleSource(id: string) {
    this.s.update(s => {
      const arr = [...s.dataSources.enabledSources];
      const idx = arr.indexOf(id);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(id);
      return { ...s, dataSources: { ...s.dataSources, enabledSources: arr } };
    });
  }

  updateApiKey(id: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.s.update(s => ({
      ...s,
      dataSources: { ...s.dataSources, apiKeys: { ...s.dataSources.apiKeys, [id]: value } }
    }));
  }

  applyPreset(preset: 'default' | 'institutional' | 'value_add') {
    if (preset === 'default') {
      this.s.set(structuredClone(DEFAULT_SETTINGS));
    } else if (preset === 'institutional') {
      this.s.update(s => ({ ...s, ...structuredClone(INSTITUTIONAL_PRESET) } as OrgSettings));
    } else if (preset === 'value_add') {
      this.s.update(s => ({ ...s, ...structuredClone(VALUE_ADD_PRESET) } as OrgSettings));
    }
  }

  saveAndClose() {
    this.saveSettings();
    this.saved.set(true);
    this.settingsChanged.emit(this.s());
    setTimeout(() => this.close.emit(), 400);
  }

  private saveSettings() {
    try {
      localStorage.setItem('dealsense-org-settings', JSON.stringify(this.s()));
    } catch (e) {
      console.error('[org-settings] Failed to save:', e);
    }
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem('dealsense-org-settings');
      if (raw) {
        const saved = JSON.parse(raw) as Partial<OrgSettings>;
        // Deep merge with defaults to handle new fields
        const merged = structuredClone(DEFAULT_SETTINGS);
        for (const [k, v] of Object.entries(saved)) {
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            (merged as any)[k] = { ...(merged as any)[k], ...v };
          } else {
            (merged as any)[k] = v;
          }
        }
        this.s.set(merged);
      }
    } catch (e) {
      console.error('[org-settings] Failed to load:', e);
    }
  }
}
