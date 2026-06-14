// mcp-info.component.ts — MCP Server info overlay
import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mcp-info',
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
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 14a1 1 0 01-.78-1.63l9.9-10.2a.5.5 0 01.86.46l-1.92 6.02A1 1 0 0013 10h7a1 1 0 01.78 1.63l-9.9 10.2a.5.5 0 01-.86-.46l1.92-6.02A1 1 0 0011 14H4z"/>
              </svg>
            </div>
            <h2 class="hero-title">DealSense MCP Server</h2>
            <p class="hero-sub">Connect Claude Desktop, Cursor, Windsurf, or any MCP-compatible client to DealSense — access all 12 CRE investment tools through your AI assistant.</p>
          </div>

          <!-- Connection URL -->
          <div class="url-section">
            <div class="url-label">MCP Server URL</div>
            <div class="url-box" (click)="copyUrl()">
              <code class="url-text">https://reagent.selvaonline.com/mcp</code>
              <button class="copy-btn" [class.copied]="copied()">
                <svg *ngIf="!copied()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                <svg *ngIf="copied()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                {{ copied() ? 'Copied!' : 'Copy' }}
              </button>
            </div>
          </div>

          <!-- Quick Setup -->
          <div class="section">
            <h3 class="section-title">Quick Setup</h3>
            <div class="tabs">
              <button class="tab" [class.active]="activeTab() === 'claude'" (click)="activeTab.set('claude')">Claude Desktop</button>
              <button class="tab" [class.active]="activeTab() === 'cursor'" (click)="activeTab.set('cursor')">Cursor / Windsurf</button>
            </div>

            <div class="config-block" *ngIf="activeTab() === 'claude'">
              <div class="config-label">Add to <code>claude_desktop_config.json</code></div>
              <div class="code-box">
                <button class="code-copy" (click)="copyConfig('claude')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
<pre>{{ claudeConfig }}</pre>
              </div>
            </div>

            <div class="config-block" *ngIf="activeTab() === 'cursor'">
              <div class="config-label">Add to your MCP settings</div>
              <div class="code-box">
                <button class="code-copy" (click)="copyConfig('cursor')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
<pre>{{ cursorConfig }}</pre>
              </div>
            </div>
          </div>

          <!-- Tools -->
          <div class="section">
            <h3 class="section-title">12 Tools Available</h3>
            <p class="section-sub">Each tool calls DealSense backend functions directly — structured data, no LLM overhead.</p>

            <div class="tools-grid">
              <div class="tool-card" *ngFor="let tool of tools">
                <div class="tool-header">
                  <div class="tool-icon" [style.background]="tool.color">
                    <span [innerHTML]="tool.icon"></span>
                  </div>
                  <div class="tool-meta">
                    <code class="tool-name">{{ tool.name }}</code>
                    <span class="tool-category">{{ tool.category }}</span>
                  </div>
                </div>
                <p class="tool-desc">{{ tool.description }}</p>
                <div class="tool-params">
                  <span class="param" *ngFor="let p of tool.params">{{ p }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Resource -->
          <div class="section">
            <h3 class="section-title">Resource</h3>
            <div class="resource-box">
              <code>dealsense://capabilities</code>
              <span>Full capability manifest with tool descriptions and data sources</span>
            </div>
          </div>

          <!-- Example -->
          <div class="section section-last">
            <h3 class="section-title">Example Usage</h3>
            <p class="section-sub">Once connected, just ask naturally in Claude or Cursor:</p>
            <div class="examples">
              <div class="example-item">"Search for NNN retail properties in Dallas under $5M"</div>
              <div class="example-item">"What's the market risk score for Miami right now?"</div>
              <div class="example-item">"Run a DCF on a $3M property with $210K NOI"</div>
              <div class="example-item">"Find comps for industrial warehouse in Phoenix"</div>
              <div class="example-item">"Generate an IC memo for this Walgreens listing"</div>
              <div class="example-item">"Analyze this CVS property for foot traffic and parking strength"</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    .modal {
      background: #ffffff; border-radius: 14px;
      max-width: 760px; width: 100%; max-height: 90vh;
      position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      display: flex; flex-direction: column;
    }
    .modal-scroll {
      overflow-y: auto; padding: 36px 44px;
      scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;
    }
    .close-btn {
      position: absolute; top: 12px; right: 16px;
      background: none; border: none; color: #64748b;
      font-size: 28px; cursor: pointer; z-index: 10;
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      border-radius: 8px;
    }
    .close-btn:hover { background: #f1f5f9; color: #0f172a; }

    /* Hero */
    .hero { text-align: center; margin-bottom: 32px; }
    .hero-icon {
      width: 64px; height: 64px; border-radius: 16px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
    }
    .hero-title { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
    .hero-sub { font-size: 14px; color: #64748b; line-height: 1.6; max-width: 520px; margin: 0 auto; }

    /* URL Section */
    .url-section {
      background: #0f172a; border-radius: 12px; padding: 20px 24px;
      margin-bottom: 28px;
    }
    .url-label {
      font-size: 11px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;
    }
    .url-box {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; cursor: pointer;
    }
    .url-text {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 16px; color: #38bdf8; font-weight: 600;
    }
    .copy-btn {
      display: flex; align-items: center; gap: 6px;
      background: #1e293b; border: 1px solid #334155; border-radius: 6px;
      color: #94a3b8; padding: 6px 12px; font-size: 12px; cursor: pointer;
      transition: all 0.15s;
    }
    .copy-btn:hover { background: #334155; color: #e2e8f0; }
    .copy-btn.copied { background: #166534; border-color: #22c55e; color: #4ade80; }

    /* Section */
    .section { margin-bottom: 28px; }
    .section-last { margin-bottom: 0; }
    .section-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
    .section-sub { font-size: 13px; color: #64748b; margin: 0 0 14px; }

    /* Tabs */
    .tabs {
      display: flex; gap: 4px; margin-bottom: 14px;
      background: #f1f5f9; border-radius: 8px; padding: 3px;
    }
    .tab {
      flex: 1; padding: 7px 14px; border: none; border-radius: 6px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      background: transparent; color: #64748b; transition: all 0.15s;
    }
    .tab.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .tab:hover:not(.active) { color: #334155; }

    /* Config blocks */
    .config-block { margin-top: 4px; }
    .config-label { font-size: 13px; color: #475569; margin-bottom: 8px; }
    .config-label code {
      background: #f1f5f9; padding: 2px 6px; border-radius: 4px;
      font-size: 12px; color: #0f172a;
    }
    .code-box {
      position: relative; background: #1e293b; border-radius: 10px;
      padding: 16px 20px; overflow-x: auto;
    }
    .code-box pre {
      margin: 0; font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px; color: #e2e8f0; line-height: 1.6; white-space: pre;
    }
    .code-copy {
      position: absolute; top: 10px; right: 10px;
      background: #334155; border: none; border-radius: 5px;
      color: #94a3b8; padding: 5px 8px; cursor: pointer;
    }
    .code-copy:hover { background: #475569; color: #e2e8f0; }

    /* Tools Grid */
    .tools-grid {
      display: grid; grid-template-columns: 1fr; gap: 10px;
    }
    .tool-card {
      border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;
      transition: border-color 0.15s;
    }
    .tool-card:hover { border-color: #93c5fd; }
    .tool-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .tool-icon {
      width: 32px; height: 32px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      color: white; flex-shrink: 0; font-size: 15px;
    }
    .tool-meta { display: flex; flex-direction: column; gap: 2px; }
    .tool-name {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px; font-weight: 600; color: #0f172a;
    }
    .tool-category { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .tool-desc { font-size: 13px; color: #475569; line-height: 1.5; margin: 0 0 8px; }
    .tool-params { display: flex; flex-wrap: wrap; gap: 4px; }
    .param {
      padding: 2px 8px; border-radius: 4px; font-size: 11px;
      background: #f1f5f9; color: #64748b;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }

    /* Resource */
    .resource-box {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; background: #faf5ff; border: 1px solid #e9d5ff;
      border-radius: 10px; gap: 16px;
    }
    .resource-box code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px; color: #7c3aed; font-weight: 600;
    }
    .resource-box span { font-size: 13px; color: #64748b; text-align: right; }

    /* Examples */
    .examples { display: flex; flex-direction: column; gap: 8px; }
    .example-item {
      padding: 10px 16px; background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 8px; font-size: 13px; color: #334155;
      font-style: italic; border-left: 3px solid #3b82f6;
    }

    /* Mobile */
    @media (max-width: 768px) {
      .modal-scroll { padding: 24px 20px; }
      .hero-title { font-size: 22px; }
      .url-text { font-size: 13px; }
      .url-box { flex-direction: column; align-items: flex-start; }
      .resource-box { flex-direction: column; text-align: left; }
      .resource-box span { text-align: left; }
    }
  `]
})
export class McpInfoComponent {
  @Output() close = new EventEmitter<void>();

  copied = signal(false);
  activeTab = signal<'claude' | 'cursor'>('claude');

  claudeConfig = `{
  "mcpServers": {
    "dealsense": {
      "url": "https://reagent.selvaonline.com/mcp"
    }
  }
}`;

  cursorConfig = `{
  "mcpServers": {
    "dealsense": {
      "url": "https://reagent.selvaonline.com/mcp"
    }
  }
}`;

  tools = [
    {
      name: 'search_properties',
      category: 'Search',
      description: 'Search CRE listings across CREXi, LoopNet, Brevitas with PE scoring and ranking.',
      params: ['query', 'maxResults?'],
      icon: '&#128269;',
      color: '#2563eb',
    },
    {
      name: 'assess_risk',
      category: 'Market',
      description: 'Compute 0-100 market risk score using live FRED Treasury, CPI, yield curve, and BLS unemployment.',
      params: ['query', 'forceMetro?'],
      icon: '&#9888;&#65039;',
      color: '#dc2626',
    },
    {
      name: 'run_dcf',
      category: 'Analysis',
      description: 'Discounted Cash Flow analysis — IRR, equity multiple, cash-on-cash, annual cash flows, exit valuation.',
      params: ['purchasePrice', 'noi', 'ltv?', 'interestRate?', 'holdYears?', 'noiGrowth?', 'exitCapSpread?'],
      icon: '&#128200;',
      color: '#059669',
    },
    {
      name: 'get_macro_data',
      category: 'Market',
      description: 'Fetch raw macro data: 10Y Treasury, 2s10 curve, CPI YoY, national and metro unemployment.',
      params: ['metro?'],
      icon: '&#127970;',
      color: '#7c3aed',
    },
    {
      name: 'analyze_property_url',
      category: 'Search',
      description: 'Extract property details from a listing URL via headless browser — price, NOI, cap rate, tenant.',
      params: ['url'],
      icon: '&#127760;',
      color: '#0891b2',
    },
    {
      name: 'score_deals',
      category: 'Analysis',
      description: 'Apply DealSense PE scoring model (6-factor, 100-point) to search result rows.',
      params: ['rows', 'query?'],
      icon: '&#11088;',
      color: '#ca8a04',
    },
    {
      name: 'comp_analysis',
      category: 'Search',
      description: 'Find comparable properties in the same market and type. Returns PE-scored comps.',
      params: ['market', 'propertyType', 'subjectTitle?'],
      icon: '&#128202;',
      color: '#2563eb',
    },
    {
      name: 'market_deep_dive',
      category: 'Market',
      description: 'Comprehensive metro intelligence — macro data, risk scoring, unemployment, listing activity.',
      params: ['metro', 'propertyType?'],
      icon: '&#128506;',
      color: '#7c3aed',
    },
    {
      name: 'generate_memo',
      category: 'Document',
      description: 'Generate a 12-section Investment Committee memorandum with recommendation.',
      params: ['title', 'url', 'peScore?', 'riskScore?', 'snippet?'],
      icon: '&#128196;',
      color: '#475569',
    },
    {
      name: 'filter_and_rank',
      category: 'Analysis',
      description: 'Filter and sort deals by PE score, risk, location, property type.',
      params: ['instruction', 'minPeScore?', 'location?', 'sortBy?'],
      icon: '&#128295;',
      color: '#ca8a04',
    },
    {
      name: 'portfolio_review',
      category: 'Portfolio',
      description: 'Analyze portfolio for geographic concentration, asset type gaps, and risk distribution.',
      params: ['focus?'],
      icon: '&#128188;',
      color: '#059669',
    },
    {
      name: 'analyze_traffic_patterns',
      category: 'Location / Market',
      description: 'Estimate real-world property activity using parking, foot traffic, road traffic, nearby anchors, and visibility signals.',
      params: ['address', 'propertyType?', 'tenant?', 'metro?'],
      icon: '&#128205;',
      color: '#0d9488',
    },
  ];

  copyUrl() {
    navigator.clipboard.writeText('https://reagent.selvaonline.com/mcp');
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  copyConfig(type: string) {
    const text = type === 'claude' ? this.claudeConfig : this.cursorConfig;
    navigator.clipboard.writeText(text);
  }
}
