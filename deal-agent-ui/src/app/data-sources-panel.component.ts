// src/app/data-sources-panel.component.ts
// Data Sources toggle panel — lets users enable/disable CRE data sources and provide API keys

import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type DataSource = {
  id: string;
  name: string;
  category: 'listings' | 'data' | 'macro';
  enabled: boolean;
  requiresApiKey: boolean;
  apiKey: string;
  icon: string;
  description: string;
};

const DEFAULT_SOURCES: DataSource[] = [
  { id: 'loopnet', name: 'LoopNet', category: 'listings', enabled: true, requiresApiKey: false, apiKey: '', icon: '🏢', description: 'Commercial real estate listings' },
  { id: 'crexi', name: 'CREXi', category: 'listings', enabled: true, requiresApiKey: false, apiKey: '', icon: '🏗️', description: 'Commercial real estate exchange' },
  { id: 'zillow', name: 'Zillow', category: 'listings', enabled: false, requiresApiKey: true, apiKey: '', icon: '🏠', description: 'Residential & commercial listings' },
  { id: 'batchdata', name: 'BatchData', category: 'data', enabled: false, requiresApiKey: true, apiKey: '', icon: '📊', description: 'Property data & analytics (155M+ parcels)' },
  { id: 'fred', name: 'FRED', category: 'macro', enabled: true, requiresApiKey: false, apiKey: '', icon: '📈', description: 'Federal Reserve economic data' },
  { id: 'bls', name: 'BLS', category: 'macro', enabled: true, requiresApiKey: false, apiKey: '', icon: '👷', description: 'Bureau of Labor Statistics' },
];

@Component({
  selector: 'app-data-sources-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="data-sources-panel" [class.expanded]="isExpanded()">
      <!-- Toggle Button -->
      <button class="ds-toggle" (click)="togglePanel()" title="Data Sources">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        <span class="badge" *ngIf="enabledCount() > 0">{{ enabledCount() }}</span>
      </button>

      <!-- Panel Content -->
      <div class="panel-content" *ngIf="isExpanded()">
        <div class="panel-header">
          <h3>Data Sources</h3>
          <div class="header-actions">
            <button class="reset-btn" (click)="resetDefaults()">Reset</button>
            <button class="close-btn" (click)="togglePanel()">✕</button>
          </div>
        </div>

        <div class="sources-list">
          <div *ngFor="let cat of categories" class="category-section">
            <div class="category-label">{{ cat.label }}</div>

            <div *ngFor="let source of getSourcesByCategory(cat.key)" class="source-item">
              <div class="source-row">
                <span class="source-icon">{{ source.icon }}</span>
                <div class="source-info">
                  <strong>{{ source.name }}</strong>
                  <span class="source-desc">{{ source.description }}</span>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" [checked]="source.enabled" (change)="toggleSource(source.id)">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div *ngIf="source.requiresApiKey && source.enabled" class="api-key-row">
                <div class="api-key-input">
                  <input [type]="isKeyVisible(source.id) ? 'text' : 'password'"
                         [value]="source.apiKey"
                         (input)="updateApiKey(source.id, $event)"
                         placeholder="API Key (optional — uses server default)">
                  <button class="eye-btn" (click)="toggleKeyVisibility(source.id)">
                    {{ isKeyVisible(source.id) ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .data-sources-panel {
      position: fixed;
      top: 10px;
      right: 140px;
      z-index: 999999;
      pointer-events: auto;
    }

    .ds-toggle {
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #e5e7eb;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: all 0.2s;
      color: #6b7280;
    }

    .ds-toggle:hover {
      border-color: #f59e0b;
      color: #f59e0b;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
    }

    .ds-toggle svg {
      transition: all 0.2s;
    }

    .ds-toggle:hover svg {
      transform: scale(1.1) rotate(30deg);
    }

    .ds-toggle .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #f59e0b;
      color: white;
      font-size: 11px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 20px;
      text-align: center;
    }

    .panel-content {
      position: absolute;
      top: 70px;
      right: 0;
      width: 380px;
      max-height: 520px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease-out;
      overflow: hidden;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .panel-header {
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 18px;
      color: #1f2937;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .reset-btn {
      background: none;
      border: none;
      color: #f59e0b;
      font-size: 12px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .reset-btn:hover {
      background: #fffbeb;
    }

    .close-btn {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 20px;
      cursor: pointer;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: #f3f4f6;
    }

    .sources-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
    }

    .category-section {
      margin-bottom: 16px;
    }

    .category-section:last-child {
      margin-bottom: 0;
    }

    .category-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9ca3af;
      margin-bottom: 8px;
      padding: 0 4px;
    }

    .source-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 8px;
      transition: border-color 0.2s;
    }

    .source-item:hover {
      border-color: #d1d5db;
    }

    .source-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .source-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .source-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .source-info strong {
      color: #1f2937;
      font-size: 14px;
    }

    .source-desc {
      color: #6b7280;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Toggle switch */
    .toggle-switch {
      position: relative;
      display: inline-block;
      flex-shrink: 0;
      cursor: pointer;
    }

    .toggle-switch input {
      display: none;
    }

    .toggle-slider {
      display: block;
      width: 40px;
      height: 22px;
      background: #d1d5db;
      border-radius: 11px;
      position: relative;
      transition: background 0.3s;
    }

    .toggle-switch input:checked + .toggle-slider {
      background: #10b981;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      background: white;
      border-radius: 50%;
      top: 2px;
      left: 2px;
      transition: transform 0.3s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(18px);
    }

    /* API key input */
    .api-key-row {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
    }

    .api-key-input {
      display: flex;
      gap: 4px;
    }

    .api-key-input input {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      font-family: inherit;
      color: #374151;
      background: white;
      outline: none;
      transition: border-color 0.2s;
    }

    .api-key-input input:focus {
      border-color: #f59e0b;
    }

    .api-key-input input::placeholder {
      color: #9ca3af;
    }

    .eye-btn {
      background: none;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 14px;
      transition: background 0.2s;
    }

    .eye-btn:hover {
      background: #f3f4f6;
    }

    .sources-list::-webkit-scrollbar {
      width: 6px;
    }

    .sources-list::-webkit-scrollbar-track {
      background: #f3f4f6;
      border-radius: 3px;
    }

    .sources-list::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }

    .sources-list::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
  `]
})
export class DataSourcesPanelComponent implements OnInit {
  isExpanded = signal(false);
  sources = signal<DataSource[]>([]);
  enabledCount = signal(0);
  private keyVisibility: Record<string, boolean> = {};

  categories = [
    { key: 'listings', label: 'Property Listings' },
    { key: 'data', label: 'Property Data' },
    { key: 'macro', label: 'Market / Macro Data' },
  ];

  ngOnInit() {
    this.loadSources();
  }

  togglePanel() {
    this.isExpanded.update(v => !v);
  }

  getSourcesByCategory(cat: string): DataSource[] {
    return this.sources().filter(s => s.category === cat);
  }

  toggleSource(id: string) {
    this.sources.update(sources =>
      sources.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
    this.updateEnabledCount();
    this.saveSources();
  }

  updateApiKey(id: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.sources.update(sources =>
      sources.map(s => s.id === id ? { ...s, apiKey: value } : s)
    );
    this.saveSources();
  }

  isKeyVisible(id: string): boolean {
    return this.keyVisibility[id] || false;
  }

  toggleKeyVisibility(id: string) {
    this.keyVisibility[id] = !this.keyVisibility[id];
  }

  resetDefaults() {
    this.sources.set(DEFAULT_SOURCES.map(s => ({ ...s })));
    this.updateEnabledCount();
    this.saveSources();
  }

  private updateEnabledCount() {
    this.enabledCount.set(this.sources().filter(s => s.enabled).length);
  }

  private saveSources() {
    try {
      const toggleStates = this.sources().map(s => ({ id: s.id, enabled: s.enabled }));
      localStorage.setItem('dealsense-data-sources', JSON.stringify(toggleStates));

      const apiKeys = this.sources()
        .filter(s => s.apiKey)
        .map(s => ({ id: s.id, apiKey: s.apiKey }));
      localStorage.setItem('dealsense-api-keys', JSON.stringify(apiKeys));
    } catch (e) {
      console.error('[data-sources] Failed to save:', e);
    }
  }

  private loadSources() {
    const sources = DEFAULT_SOURCES.map(s => ({ ...s }));
    try {
      const savedToggles = localStorage.getItem('dealsense-data-sources');
      if (savedToggles) {
        const toggles = JSON.parse(savedToggles) as { id: string; enabled: boolean }[];
        for (const toggle of toggles) {
          const source = sources.find(s => s.id === toggle.id);
          if (source) source.enabled = toggle.enabled;
        }
      }
      const savedKeys = localStorage.getItem('dealsense-api-keys');
      if (savedKeys) {
        const keys = JSON.parse(savedKeys) as { id: string; apiKey: string }[];
        for (const key of keys) {
          const source = sources.find(s => s.id === key.id);
          if (source) source.apiKey = key.apiKey;
        }
      }
    } catch (e) {
      console.error('[data-sources] Failed to load:', e);
    }
    this.sources.set(sources);
    this.updateEnabledCount();
  }
}
