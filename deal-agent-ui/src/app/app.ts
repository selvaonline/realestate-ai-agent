import { Component, AfterViewChecked, signal, ElementRef, ChangeDetectorRef, NgZone, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { AgentService, AgentEvent } from './agent.service';
import { Chart, registerables } from 'chart.js';
import { ChangeDetectionStrategy } from '@angular/core';
// Register Chart.js components
Chart.register(...registerables);

type Card = {
  kind: 'status'|'wait'|'nav'|'action'|'fallback'|'shot'|'extracted'|'started'|'finished'|'thinking'|'source'|'answer';
  label?: string;
  note?: string;
  url?: string;
  b64?: string;
  summary?: any;
  source?: { id: number; title: string; url: string; snippet: string };
  t: number;
};

type Source = { id: number; title: string; url: string; snippet: string };

type PropertyProgress = {
  url: string;
  title?: string;
  address?: string;
  screenshot?: string;
  extracted?: {
    price?: number | null;
    noi?: number | null;
    capRate?: number | null;
    dscr?: number | null;
  };
  step: 'loading' | 'screenshot' | 'extracted' | 'complete';
  count: number;
};

@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  template: `
  <div class="shell">
    <div class="header">RealEstate Deal Agent</div>

    <div class="ask">
      <input #qinput [value]="q()" (input)="q.set(qinput.value); stopTyping();"
             [placeholder]="typingPlaceholder()" 
             (focus)="stopTyping()" />
      <button (click)="run()" [disabled]="busy()">{{ busy() ? 'Running...' : 'Search' }}</button>
    </div>

    <!-- Perplexity-style Answer Section -->
    <div class="perplexity-section" *ngIf="answer() || sources().length">
      <!-- Thinking Steps -->
      <div class="thinking-steps" *ngIf="!answerComplete()">
        <div class="thinking-item" *ngFor="let c of cards()">
          <ng-container *ngIf="c.kind === 'thinking'">
            <div class="thinking-text">
              <div class="thinking-content">{{ c.label }}</div>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Live Browser Preview -->
      <div class="browser-preview-section" *ngIf="browserPreview() && !answerComplete()">
        <div class="preview-header">
          <span class="preview-icon">🌐</span>
          <span class="preview-label">{{ browserPreview()!.label }}</span>
        </div>
        <div class="preview-url">{{ browserPreview()!.url }}</div>
        <div class="preview-image">
          <img [src]="'data:image/png;base64,' + browserPreview()!.screenshot" alt="Live browser view" />
        </div>
      </div>

      <!-- Progressive Property Display -->
      <div class="properties-progress" *ngIf="progressProperties().length && !answerComplete()">
        <div class="property-card" *ngFor="let prop of progressProperties()">
          <div class="property-header">
            <span class="property-badge">Property {{ prop.count }}</span>
            <span class="property-status" [ngClass]="prop.step">
              {{ prop.step === 'loading' ? '⏳ Loading...' : 
                 prop.step === 'screenshot' ? '📸 Captured' : 
                 prop.step === 'extracted' ? '📊 Analyzing...' : 
                 '✓ Complete' }}
            </span>
          </div>
          
          <div class="property-title" *ngIf="prop.title">{{ prop.title }}</div>
          <div class="property-address" *ngIf="prop.address">{{ prop.address }}</div>
          
          <div class="property-screenshot" *ngIf="prop.screenshot">
            <img [src]="'data:image/png;base64,' + prop.screenshot" alt="Property screenshot" />
          </div>
          
          <div class="property-data" *ngIf="prop.extracted">
            <div class="data-row" *ngIf="prop.extracted.price">
              <span class="data-label">Price:</span>
              <span class="data-value">{{ prop.extracted.price | currency:'USD':'symbol':'1.0-0' }}</span>
            </div>
            <div class="data-row" *ngIf="prop.extracted.noi">
              <span class="data-label">NOI:</span>
              <span class="data-value">{{ prop.extracted.noi | currency:'USD':'symbol':'1.0-0' }}</span>
            </div>
            <div class="data-row" *ngIf="prop.extracted.capRate">
              <span class="data-label">Cap Rate:</span>
              <span class="data-value">{{ prop.extracted.capRate * 100 | number:'1.2-2' }}%</span>
            </div>
            <div class="data-row" *ngIf="prop.extracted.dscr">
              <span class="data-label">DSCR:</span>
              <span class="data-value">{{ prop.extracted.dscr | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Agent Navigation Steps (ChatGPT-style) -->
      <div class="agent-navigation" *ngIf="!answerComplete() && !progressProperties().length">
        <div class="nav-item" *ngFor="let c of cards(); let i = index">
          <ng-container *ngIf="c.kind === 'nav' && c.url">
            <div class="nav-step">
              <span class="nav-icon">🌐</span>
              <div class="nav-content">
                <div class="nav-label">{{ c.label }}</div>
                <div class="nav-url">{{ c.url }}</div>
              </div>
              <span class="nav-spinner">⏳</span>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Streaming Answer with Citations -->
      <div class="answer-section" *ngIf="answer()">
        <div class="answer-text" [innerHTML]="answer() | safeHtml"></div>
        <div class="typing-indicator" *ngIf="!answerComplete()">
          <span></span><span></span><span></span>
        </div>
      </div>

      <!-- Sources -->
      <div class="sources-section" *ngIf="sources().length && answerComplete()">
        <h3>Sources</h3>
        <div class="source-item" *ngFor="let src of sources()">
          <div class="source-header">
            <span class="source-num">[{{ src.id }}]</span>
            <a [href]="src.url" target="_blank" class="source-title">{{ src.title }}</a>
          </div>
          <div class="source-details">
            <div class="source-url">
              <span class="url-icon">🔗</span>
              <a [href]="src.url" target="_blank" class="url-link">{{ src.url }}</a>
            </div>
            <div class="source-snippet">{{ src.snippet }}</div>
          </div>
        </div>
      </div>

      <!-- PE Model Info Popup with inline styles -->
      <div *ngIf="showPeModelInfo()" 
           style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 999999;">
        <div style="background: #ffffff; padding: 30px; border-radius: 16px; max-width: 600px; width: 90%; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.2); color: #1f2937; max-height: 80vh; overflow-y: auto;">
          <button (click)="showPeModelInfo.set(false)" 
                  style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 30px; height: 30px;">×</button>
          <h3 style="margin-top: 0; font-size: 22px; color: #111827;">How the DealSense PE Model Works</h3>
          <p style="color: #1f2937; line-height: 1.6;">The DealSense Proprietary Equity (PE) Model is a sophisticated algorithm designed to evaluate commercial real estate investment opportunities by analyzing a wide range of factors. It provides a comprehensive score from 1 to 100, where a higher score indicates a more favorable investment.</p>
          <h4 style="font-size: 16px; color: #111827; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Key Factors Analyzed:</h4>
          <ul style="padding-left: 20px; margin: 0;">
            <li style="margin-bottom: 10px; line-height: 1.6; color: #1f2937;"><strong>Financial Metrics:</strong> Cap Rate, NOI, Asking Price, and potential for value-add opportunities.</li>
            <li style="margin-bottom: 10px; line-height: 1.6; color: #1f2937;"><strong>Location Analysis:</strong> Demographics, market trends, and proximity to key infrastructure.</li>
            <li style="margin-bottom: 10px; line-height: 1.6; color: #1f2937;"><strong>Asset Quality:</strong> Property type, age, condition, and tenant quality.</li>
            <li style="margin-bottom: 10px; line-height: 1.6; color: #1f2937;"><strong>Risk Assessment:</strong> Lease terms, market volatility, and economic indicators.</li>
          </ul>
          <p style="color: #1f2937; line-height: 1.6; margin-top: 15px;">This model helps investors quickly identify and rank deals that align with their strategic goals, saving time and providing a data-driven foundation for due diligence.</p>
        </div>
      </div>

      <!-- Share Button -->
      <div class="share-section" *ngIf="answerComplete() && answer()">
        <button class="share-btn" (click)="shareResults()">
          <span class="share-icon">🔗</span> Share Results
        </button>
        <span class="share-status" *ngIf="shareStatus()">{{ shareStatus() }}</span>
      </div>
    </div>

    <!-- Legacy Timeline (collapsed by default) -->
    <details class="timeline-details" *ngIf="cards().length">
      <summary class="timeline-summary">
        <span class="timeline-icon">⚙️</span>
        View detailed timeline
      </summary>
      <div class="timeline">
        <div class="card" *ngFor="let c of cards()">
          <ng-container [ngSwitch]="c.kind">

            <div *ngSwitchCase="'thinking'" class="status">
              <span class="chip purple">Thinking</span> {{c.label}}
            </div>

            <div *ngSwitchCase="'source'" class="source-card">
              <span class="chip blue">Source [{{c.source?.id}}]</span>
              <a [href]="c.source?.url" target="_blank">{{c.source?.title}}</a>
            </div>

            <div *ngSwitchCase="'answer'" class="answer-card">
              <div class="chip green">Answer</div>
              <div [innerHTML]="c.label"></div>
            </div>

            <div *ngSwitchCase="'started'" class="status">
              <span class="chip">🚀 Initializing search</span>
            </div>

            <div *ngSwitchCase="'status'" class="status">
              <span class="chip">{{c.label}}</span>
              <div class="note" *ngIf="c.note">{{c.note}}</div>
            </div>

            <div *ngSwitchCase="'nav'" class="status">
              <span class="chip blue">Navigating</span>
              <a *ngIf="c.url" [href]="c.url" target="_blank">{{c.label || c.url}}</a>
            </div>

            <div *ngSwitchCase="'shot'" class="shot">
              <div class="frame"><img [src]="'data:image/png;base64,'+c.b64" alt="screenshot" /></div>
              <div class="caption">{{c.label}}</div>
            </div>

            <div *ngSwitchCase="'extracted'" class="extracted">
              <div class="chip green">Extracted</div>
              <pre>{{ c.summary | json }}</pre>
            </div>

            <div *ngSwitchCase="'finished'" class="status">
              <span class="chip green">Done</span>
            </div>

          </ng-container>
        </div>
      </div>
    </details>

    <div class="deals" *ngIf="deals().length">
      <div class="deals-grid">
        <div class="deal-card" *ngFor="let d of deals(); let i = index">
          <div class="deal-image" *ngIf="d.screenshotBase64">
            <img [src]="'data:image/png;base64,'+d.screenshotBase64" alt="Property image" />
            <div class="deal-badge">{{ i + 1 }}</div>
          </div>
          <div class="deal-content">
            <h4 class="deal-title">{{ d.title || 'Investment Property' }}</h4>
            <p class="deal-address">📍 {{ d.address || 'Address not available' }}</p>
            
            <div class="deal-metrics">
              <div class="metric-item">
                <span class="metric-label">Asking Price</span>
                <span class="metric-value">{{ d.askingPrice | currency:'USD':'symbol':'1.0-0' }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">NOI</span>
                <span class="metric-value">{{ d.noi | currency:'USD':'symbol':'1.0-0' }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Cap Rate</span>
                <span class="metric-value">{{ (d.capRate || d.underwrite?.capRate) * 100 | number:'1.2-2' }}%</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">DSCR</span>
                <span class="metric-value">{{ d.underwrite?.dscr | number:'1.2-2' }}</span>
              </div>
            </div>
            
            <div class="deal-footer">
              <a [href]="d.url" target="_blank" class="deal-link">
                <span class="link-icon">🔗</span>
                <span>View Listing on {{ d.source }}</span>
                <span class="link-arrow">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { color:#1f2937; background:#f8fafc; min-height:100vh; display:block; }
    .shell { max-width: 920px; margin: 0 auto; padding: 20px; }
    .header { font-weight:700; font-size:20px; color:#1a2332; margin-bottom: 12px; }
    .ask { display:flex; gap:12px; margin:20px 0; }
    input { flex:1; padding:12px 16px; background:#ffffff; border:1px solid #d0d8e4; border-radius:8px; color:#1a2332; font-size:15px; }
    input::placeholder { color: #8b9db5; opacity: 1; }
    input:focus { outline:none; border-color:#2f5cff; box-shadow:0 0 0 3px rgba(47,92,255,0.1); }
    button { padding:12px 24px; background:#2f5cff; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:15px; }
    button:hover:not(:disabled) { background:#4169ff; }
    button:disabled { opacity:0.6; cursor:not-allowed; }

    /* Perplexity-style sections */
    .perplexity-section { margin-top: 24px; }
    
    .thinking-steps { 
      margin-bottom: 20px;
      padding: 12px;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(59, 130, 246, 0.05));
      border-radius: 12px;
      border: 1px solid rgba(139, 92, 246, 0.1);
    }
    .thinking-item { 
      margin-bottom: 10px;
      animation: fadeIn 0.3s ease-in;
    }
    .thinking-text { 
      display: flex; 
      align-items: center; 
      gap: 8px; 
    }
    .thinking-content {
      color: #c4b5fd;
      font-size: 14px;
      font-weight: 500;
      padding: 6px 0;
      letter-spacing: 0.3px;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Timeline details styling */
    .timeline-details {
      margin-top: 24px;
      background: #f8f9fa;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .timeline-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: #5b7a9f;
      font-size: 14px;
      font-weight: 500;
      padding: 8px 12px;
      background: #ffffff;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .timeline-summary:hover {
      background: #f1f5f9;
      color: #2f5cff;
    }
    .timeline-icon {
      font-size: 16px;
    }
    .timeline-details[open] .timeline-summary {
      margin-bottom: 16px;
      background: #2f5cff;
      color: white;
    }

    /* Agent Navigation Steps (ChatGPT-style) */
    .agent-navigation { 
      margin: 16px 0; 
      background: #0a0d12; 
      border: 1px solid #1d2735; 
      border-radius: 8px; 
      padding: 16px;
    }
    .nav-item { margin-bottom: 12px; }
    .nav-item:last-child { margin-bottom: 0; }
    .nav-step { 
      display: flex; 
      align-items: flex-start; 
      gap: 12px; 
      padding: 12px;
      background: #0f131a;
      border-radius: 8px;
      border: 1px solid #252f3f;
    }
    .nav-icon { font-size: 18px; flex-shrink: 0; margin-top: 2px; }
    .nav-content { flex: 1; min-width: 0; }
    .nav-label { 
      color: #c9d7ff; 
      font-weight: 500; 
      font-size: 14px;
      margin-bottom: 4px;
    }
    .nav-url { 
      color: #5b7a9f; 
      font-size: 13px; 
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nav-preview {
      margin-top: 12px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #252f3f;
      background: #000;
    }
    .nav-screenshot {
      width: 100%;
      height: auto;
      max-height: 300px;
      object-fit: cover;
      display: block;
    }
    .preview-label {
      padding: 8px 12px;
      background: #0a0d12;
      color: #7b8a9e;
      font-size: 12px;
      text-align: center;
      border-top: 1px solid #252f3f;
    }
    .nav-spinner {
      font-size: 16px;
      animation: spin 2s linear infinite;
      flex-shrink: 0;
    }
    .nav-check {
      font-size: 18px;
      color: #4ade80;
      flex-shrink: 0;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Progressive Properties */
    .properties-progress {
      margin: 24px 0;
      display: grid;
      gap: 16px;
    }
    .property-card {
      background: #0a0d12;
      border: 1px solid #1d2735;
      border-radius: 12px;
      padding: 16px;
      transition: all 0.3s ease;
    }
    .property-card:hover {
      border-color: #2f5cff;
    }
    .property-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .property-badge {
      background: #2f5cff;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .property-status {
      font-size: 13px;
      color: #9fb0c0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .property-status.complete {
      color: #4ade80;
    }
    .property-title {
      font-size: 16px;
      font-weight: 600;
      color: #e9eef5;
      margin-bottom: 4px;
    }
    .property-address {
      font-size: 14px;
      color: #9fb0c0;
      margin-bottom: 12px;
    }
    .property-screenshot {
      margin: 12px 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #1d2735;
    }
    .property-screenshot img {
      width: 100%;
      display: block;
      max-height: 400px;
      object-fit: cover;
    }
    .property-data {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    .data-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background: #0f131a;
      border-radius: 6px;
    }
    .data-label {
      font-size: 13px;
      color: #9fb0c0;
    }
    .data-value {
      font-size: 13px;
      font-weight: 600;
      color: #e9eef5;
    }

    /* Live Browser Preview */
    .browser-preview-section {
      margin: 20px 0;
      background: #0a0d12;
      border: 2px solid #2f5cff;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 0 20px rgba(47, 92, 255, 0.3);
    }
    .preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .preview-icon {
      font-size: 20px;
    }
    .preview-label {
      font-size: 15px;
      font-weight: 600;
      color: #c9d7ff;
    }
    .preview-url {
      font-size: 13px;
      color: #5b7a9f;
      margin-bottom: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .preview-image {
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #1d2735;
      background: #000;
    }
    .preview-image img {
      width: 100%;
      display: block;
      max-height: 600px;
      object-fit: contain;
    }

    .answer-section { 
      background: #ffffff; 
      border: 1px solid #e2e8f0; 
      border-radius: 16px; 
      padding: 24px; 
      margin-top: 24px; 
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
    }
    .answer-text { color: #374151; font-size: 15px; line-height:1.6; }
    /* ensure card separators and clickable info icon */
    .answer-text .deal-card { border-bottom: 1px solid #e2e8f0; }
    .answer-text .deal-card:last-child { border-bottom: 0; }
    .answer-text #pe-model-info-icon { cursor: pointer; }
    
    .typing-indicator { 
      display: flex; 
      gap: 4px; 
      margin-top: 12px; 
    }
    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: #5b7a9f;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-4px); }
    }

    .sources-section { 
      background: #f8fafc; 
      border: 1px solid #e2e8f0; 
      border-radius: 16px; 
      padding: 24px; 
      margin-bottom: 24px;
    }
    .sources-section h3 { 
      color: #1f2937; 
      font-size: 18px; 
      margin: 0 0 16px 0; 
      font-weight: 700;
    }
    .source-item { 
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      transition: all 0.2s;
    }
    .source-item:hover {
      border-color: #cbd5e1;
      background: #f1f5f9;
    }
    .source-item:last-child { 
      margin-bottom: 0;
    }
    .source-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .source-num { 
      color: #475569; 
      font-size: 13px; 
      font-weight: 700;
      background: #eef2ff;
      padding: 4px 10px;
      border-radius: 6px;
      min-width: 35px;
      text-align: center;
    }
    .source-url a { 
      color: #64748b; 
      text-decoration: none; 
      font-size: 13px;
      word-break: break-all;
      transition: color 0.2s;
      flex: 1;
    }
    .source-title:hover { 
      color: #1e40af; 
      text-decoration: underline; 
    }
    .url-link:hover {
      color: #a8c5f0;
    }
    .source-snippet { 
      color: #475569; 
      font-size: 14px; 
      line-height: 1.6;
      padding: 12px;
      background: #ffffff;
      border-radius: 6px;
      border-left: 3px solid #e2e8f0;
      white-space: pre-wrap;
      max-height: 120px;
      overflow-y: auto;
    }
    .source-snippet::-webkit-scrollbar {
      width: 6px;
    }
    .source-snippet::-webkit-scrollbar-track {
      background: #0a0d12;
      border-radius: 3px;
    }
    .source-snippet::-webkit-scrollbar-thumb {
      background: #2a3f5f;
      border-radius: 3px;
    }
    .source-snippet::-webkit-scrollbar-thumb:hover {
      background: #3a5080;
    }

    /* Share section */
    .share-section {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .share-btn {
      background: #0e3e9b;
      border: none;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .share-btn:hover { background: #1653c4; }
    .share-icon { font-size: 16px; }
    .share-status {
      color: #5fc88f;
      font-size: 13px;
      animation: fadeOut 2s ease-out forwards;
    }
    @keyframes fadeOut {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }

    /* Timeline details (collapsible) */
    .timeline-details { 
      margin-top: 24px; 
      background: #ffffff; 
      border: 1px solid #e2e8f0; 
      border-radius: 16px; 
      padding: 20px;
    }
    .timeline-details summary { 
      cursor: pointer; 
      color: #8b9db5; 
      font-size: 14px;
      list-style: none;
      transition: color 0.2s;
    }
    .timeline-details summary::-webkit-details-marker { display: none; }
    .timeline-details summary:hover { 
      color: #a8c5f0;
      text-decoration: underline; 
    }
    
    .timeline { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
    .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
    .card a { 
      color: #a8c5f0; 
      text-decoration: none; 
      transition: color 0.2s;
    }
    .card a:hover { 
      color: #c9d7ff; 
      text-decoration: underline; 
    }
    .status { display:flex; align-items:center; gap:8px; }
    .chip { background:#eef2ff; color:#4338ca; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; }
    .chip.purple { background:#4a2c75; }
    .chip.blue { background:#0e3e9b; }
    .chip.green { background:#0e6b36; }
    .frame { background:#0b0f14; border:1px solid #1d2735; border-radius:8px; overflow:hidden; }
    .frame img { width:100%; display:block; }
    .caption { font-size:12px; color:#9fb0c0; margin-top:6px; }
    
    /* Deals Section */
    .deals { 
      margin-top: 32px; 
      padding-top: 24px;
      border-top: 1px solid #1d2735;
    }
    .deals-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .deals-header h3 { 
      color: #c9d7ff; 
      font-size: 22px; 
      margin: 0;
      font-weight: 700;
    }
    .deal-count {
      background: #1d2735;
      color: #9fb0c0;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }
    
    .deals-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); 
      gap: 24px;
    }
    
    .deal-card { 
      background: #0f131a; 
      border: 1px solid #1d2735; 
      border-radius: 16px; 
      overflow: hidden;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
    }
    .deal-card:hover { 
      border-color: #2f5cff;
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(47, 92, 255, 0.2);
    }
    
    .deal-image {
      position: relative;
      width: 100%;
      height: 200px;
      overflow: hidden;
      background: #0b0f14;
    }
    .deal-image img { 
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    .deal-card:hover .deal-image img {
      transform: scale(1.05);
    }
    .deal-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: #2f5cff;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .deal-content {
      padding: 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    .deal-title { 
      color: #e9eef5; 
      font-size: 18px; 
      font-weight: 700;
      margin: 0 0 8px 0;
      line-height: 1.3;
    }
    
    .deal-address { 
      color: #9fb0c0; 
      font-size: 14px; 
      margin: 0 0 16px 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .deal-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
      padding: 16px;
      background: #0a0d12;
      border-radius: 10px;
      border: 1px solid #1a2332;
    }
    
    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .metric-label {
      font-size: 12px;
      color: #7b8a9e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    
    .metric-value {
      font-size: 16px;
      color: #e9eef5;
      font-weight: 700;
    }
    
    .deal-footer {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid #1d2735;
    }
    
    .deal-link {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #4a9eff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      padding: 10px 12px;
      background: rgba(47, 92, 255, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(47, 92, 255, 0.2);
    }
    .deal-link:hover {
      color: #6eb3ff;
      background: rgba(47, 92, 255, 0.2);
      border-color: rgba(47, 92, 255, 0.4);
      transform: translateX(2px);
    }
    .link-icon {
      font-size: 16px;
    }
    .link-arrow {
      margin-left: auto;
      font-size: 18px;
      transition: transform 0.2s ease;
    }
    .deal-link:hover .link-arrow {
      transform: translateX(4px);
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .deals-grid {
        grid-template-columns: 1fr;
      }
      .deals-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
    }

    /* PE Model Info Popup - Using ::ng-deep to bypass view encapsulation */
    :host ::ng-deep .pe-model-info-popup {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0, 0, 0, 0.6) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 9999 !important;
    }
    :host ::ng-deep .popup-content {
      background: #ffffff !important;
      padding: 30px !important;
      border-radius: 16px !important;
      max-width: 600px !important;
      width: 90% !important;
      position: relative !important;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2) !important;
      color: #1f2937 !important;
    }
    :host ::ng-deep .close-btn {
      position: absolute !important;
      top: 15px !important;
      right: 15px !important;
      background: none !important;
      border: none !important;
      font-size: 24px !important;
      cursor: pointer !important;
      color: #6b7280 !important;
    }
    :host ::ng-deep .popup-content h3 {
      margin-top: 0 !important;
      font-size: 22px !important;
      color: #111827 !important;
    }
    :host ::ng-deep .popup-content h4 {
      font-size: 16px !important;
      color: #111827 !important;
      margin-top: 20px !important;
      margin-bottom: 10px !important;
      border-bottom: 1px solid #e5e7eb !important;
      padding-bottom: 5px !important;
    }
    :host ::ng-deep .popup-content ul {
      padding-left: 20px !important;
      margin: 0 !important;
    }
    :host ::ng-deep .popup-content ul li {
      margin-bottom: 10px !important;
      line-height: 1.6 !important;
    }
  `]
})
export class App implements AfterViewChecked {
  q = signal('');
  busy = signal(false);
  cards = signal<Card[]>([]);
  deals = signal<any[]>([]);
  sources = signal<Source[]>([]);
  answer = signal<string>('');
  answerComplete = signal(false);
  shareStatus = signal<string>('');
  typingPlaceholder = signal<string>('Ask a question...');
  progressProperties = signal<PropertyProgress[]>([]);
  browserPreview = signal<{url: string; screenshot: string; label: string} | null>(null);
  showPeModelInfo = signal(false);
  private typingInterval: any = null;
  private isTypingActive = true;
  private currentExampleIndex = 0;
  private peModelInfoListenerAttached = false;
  private charts = new Map<string, Chart>();

  private exampleQueries: string[] = [];
  private allPrompts: string[] = [];

  constructor(private svc: AgentService, private el: ElementRef, private cdr: ChangeDetectorRef, private zone: NgZone) {
    this.loadPrompts();
    
    // Global click listener for info icon - run inside Angular's zone
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target && target.id === 'pe-model-info-icon') {
        console.log('Info icon clicked!');
        
        // Run inside Angular's zone to ensure change detection
        this.zone.run(() => {
          this.showPeModelInfo.set(true);
          console.log('showPeModelInfo set to:', this.showPeModelInfo());
          
          // Force immediate change detection
          this.cdr.detectChanges();
          
          // Verify popup visibility
          setTimeout(() => {
            const popup = document.querySelector('.pe-model-info-popup');
            if (popup) {
              console.log('Popup found in DOM');
              const computed = window.getComputedStyle(popup as HTMLElement);
              console.log('Display:', computed.display, 'Z-index:', computed.zIndex);
            } else {
              console.log('Popup NOT in DOM');
            }
          }, 0);
        });
      }
    });
  }

  private async loadPrompts() {
    try {
      const response = await fetch('/assets/search-prompts.json');
      const data = await response.json();
      
      // Flatten all categories into one array
      this.allPrompts = Object.values(data.categories).flat() as string[];
      
      // Randomly select 20 prompts for the typing animation
      this.exampleQueries = this.getRandomPrompts(20);
      
      console.log(`[prompts] Loaded ${this.allPrompts.length} prompts from ${Object.keys(data.categories).length} categories`);
      
      // Start animation after prompts are loaded
      this.startTypingAnimation();
    } catch (error) {
      console.error('[prompts] Failed to load prompts, using fallback:', error);
      // Fallback prompts
      this.exampleQueries = [
        'Find single-tenant NNN retail in Dallas, 4–6% cap, price $4M–$6M',
        'CVS pharmacy properties for sale in Texas',
        'Medical office buildings with hospital affiliation, cap rate 6-8%',
      ];
      this.startTypingAnimation();
    }
  }

  private getRandomPrompts(count: number): string[] {
    const shuffled = [...this.allPrompts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  ngAfterViewChecked() {
    // Debug: Check if icon exists
    const icon = document.getElementById('pe-model-info-icon');
    if (icon) {
      console.log('Info icon found in DOM:', icon);
      // Ensure it's clickable
      icon.style.cursor = 'pointer';
      icon.style.userSelect = 'none';
    } else {
      console.log('Info icon NOT found in DOM');
    }

    // Add listeners for deal factor buttons
    this.el.nativeElement.querySelectorAll('.show-breakdown').forEach((button: HTMLElement) => {
      if (!button.dataset['listenerAttached']) {
        button.addEventListener('click', (event: MouseEvent) => this.toggleFactorChart(event));
        button.dataset['listenerAttached'] = 'true';
      }
    });
    
    // Initialize chart buttons after DOM updates
    this.initializeChartButtons();
    
    // Try to initialize portfolio charts
    this.initializePortfolioCharts();
    
    // Set up observer for dynamically added chart elements
    if (!this.chartObserver) {
      this.chartObserver = new MutationObserver(() => {
        this.initializePortfolioCharts();
      });
      
      // Observe the answer section for changes
      const answerSection = this.el.nativeElement.querySelector('.answer-text');
      if (answerSection) {
        this.chartObserver.observe(answerSection, {
          childList: true,
          subtree: true
        });
      }
    }
  }

  toggleFactorChart(event: MouseEvent) {
    const button = event.target as HTMLElement;
    const container = button.closest('.deal-card');
    if (!container) return;

    const cardId = (container as HTMLElement).dataset['cardId']!;
    const chartContainer = this.el.nativeElement.querySelector(`#chart-container-${cardId}`);
    
    if (chartContainer) {
      const isVisible = chartContainer.style.display !== 'none';
      chartContainer.style.display = isVisible ? 'none' : 'block';
      button.textContent = isVisible ? '📊 Deal Factors' : 'Hide Factors';

      if (!isVisible && !this.charts.has(cardId)) {
        const factors = (container as HTMLElement).dataset['factors'];
        if (factors) {
          this.createFactorChart(cardId, JSON.parse(factors));
        }
      }
    }
  }

  createFactorChart(cardId: string, factors: Record<string, number>) {
    const chartId = `factor-chart-${cardId}`;
    const existingChart = this.charts.get(chartId);
    if (existingChart) {
      existingChart.destroy();
    }

    const canvas = this.el.nativeElement.querySelector(`#${chartId}`) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(factors),
        datasets: [{
          label: 'Factor Score',
          data: Object.values(factors),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { beginAtZero: true, max: 100 }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
    this.charts.set(chartId, chart);
  }

  ngOnDestroy() {
    this.stopTyping();
    if (this.chartObserver) {
      this.chartObserver.disconnect();
    }
    // Clean up charts
    this.chartInstances.forEach(chart => chart.destroy());
    this.charts.forEach(chart => chart.destroy());
  }

  private startTypingAnimation() {
    let queryIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typingSpeed = 80;
    const deletingSpeed = 40;
    const pauseBeforeDelete = 2000;
    const pauseBeforeNext = 500;

    const type = () => {
      if (!this.isTypingActive) return;

      const currentQuery = this.exampleQueries[queryIndex];
      this.currentExampleIndex = queryIndex; // Track current example
      
      if (!isDeleting && charIndex <= currentQuery.length) {
        // Typing forward
        this.typingPlaceholder.set(currentQuery.substring(0, charIndex) + '|');
        charIndex++;
        
        if (charIndex > currentQuery.length) {
          // Finished typing, pause then start deleting
          setTimeout(() => {
            isDeleting = true;
            type();
          }, pauseBeforeDelete);
          return;
        }
      } else if (isDeleting && charIndex > 0) {
        // Deleting backward
        charIndex--;
        this.typingPlaceholder.set(currentQuery.substring(0, charIndex) + '|');
      } else if (isDeleting && charIndex === 0) {
        // Finished deleting, move to next query
        isDeleting = false;
        queryIndex = (queryIndex + 1) % this.exampleQueries.length;
        setTimeout(type, pauseBeforeNext);
        return;
      }
      
      const speed = isDeleting ? deletingSpeed : typingSpeed;
      this.typingInterval = setTimeout(type, speed);
    };

    type();
  }

  stopTyping() {
    this.isTypingActive = false;
    if (this.typingInterval) {
      clearTimeout(this.typingInterval);
      this.typingInterval = null;
    }
  }

  async shareResults() {
    const query = this.q();
    const answer = this.answer();
    const sources = this.sources();
    const deals = this.deals();
    
    // Build shareable text
    let shareText = `Query: ${query}\n\n`;
    shareText += `Answer:\n${answer.replace(/<[^>]*>/g, '')}\n\n`;
    
    if (sources.length) {
      shareText += `Sources:\n`;
      sources.forEach(src => {
        shareText += `[${src.id}] ${src.title}\n${src.url}\n\n`;
      });
    }
    
    if (deals.length) {
      shareText += `\nDeals Found:\n`;
      deals.forEach(deal => {
        shareText += `- ${deal.title || 'Property'}\n`;
        shareText += `  Address: ${deal.address || 'N/A'}\n`;
        shareText += `  Price: $${deal.askingPrice?.toLocaleString() || 'N/A'}\n`;
        shareText += `  Cap Rate: ${((deal.capRate || deal.underwrite?.capRate) * 100)?.toFixed(2) || 'N/A'}%\n`;
        shareText += `  URL: ${deal.url}\n\n`;
      });
    }
    
    try {
      // Try Web Share API first (mobile/modern browsers)
      if (navigator.share) {
        await navigator.share({
          title: 'RealEstate Deal Agent Results',
          text: shareText,
        });
        this.shareStatus.set('✓ Shared!');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareText);
        this.shareStatus.set('✓ Copied to clipboard!');
      }
      
      // Clear status after 2 seconds
      setTimeout(() => this.shareStatus.set(''), 2000);
    } catch (err) {
      console.error('Share failed:', err);
      this.shareStatus.set('✗ Share failed');
      setTimeout(() => this.shareStatus.set(''), 2000);
    }
  }

  async run() {
    let query = this.q().trim();
    
    // If empty, use the current example query from animation
    if (!query) {
      query = this.exampleQueries[this.currentExampleIndex];
      this.q.set(query); // Fill the input with the example
      this.stopTyping(); // Stop animation
    }
    
    this.cards.set([]);
    this.deals.set([]);
    this.sources.set([]);
    this.answer.set('');
    this.answerComplete.set(false);
    this.shareStatus.set('');
    this.progressProperties.set([]);
    this.browserPreview.set(null);
    this.busy.set(true);
    try {
      const runId = await this.svc.startRun(query);
      this.cards.update(c => [...c, { kind:'started', label:'🚀 Initializing search', t:Date.now() }]);
      const stop = this.svc.openEvents(runId, (ev: AgentEvent) => this.onEvent(ev));
      const poll = setInterval(async () => {
        const finished = this.cards().some(x => x.kind === 'finished');
        if (finished) {
          clearInterval(poll);
          stop();
          try {
            const result = await this.svc.getResult(runId);
            this.deals.set(result.deals || []);
          } catch { /* ignore */ }
          this.busy.set(false);
        }
      }, 400);
    } catch (e) {
      this.busy.set(false);
      alert('Run failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }


  private chartInstances = new Map<string, Chart>();
  private portfolioChartsInitialized = false;
  private chartObserver: MutationObserver | null = null;

  private initializePortfolioCharts() {
    // Skip if already initialized
    if (this.portfolioChartsInitialized) return;
    
    // Check if canvases exist
    const scoreCanvas = document.getElementById('score-distribution-chart') as HTMLCanvasElement;
    const geoCanvas = document.getElementById('geo-distribution-chart') as HTMLCanvasElement;
    
    if (!scoreCanvas || !geoCanvas) {
      console.log('Portfolio chart canvases not found yet');
      return;
    }
    
    // Check if portfolio data is available
    const portfolioData = (window as any).portfolioData;
    if (!portfolioData) {
      console.log('Portfolio data not available yet');
      return;
    }
    
    console.log('Initializing portfolio charts with data:', portfolioData);
    this.portfolioChartsInitialized = true;

    // Score Distribution Doughnut Chart
    const scoreCtx = scoreCanvas.getContext('2d');
    if (scoreCtx) {
      new Chart(scoreCtx, {
        type: 'doughnut',
        data: {
          labels: ['Premium (≥80)', 'Investment Grade (70-79)', 'Below Threshold (<70)'],
          datasets: [{
            data: [
              portfolioData.scoreDistribution.premium,
              portfolioData.scoreDistribution.investmentGrade,
              portfolioData.scoreDistribution.belowThreshold
            ],
            backgroundColor: ['#5fc88f', '#6b9aeb', '#8b9db5'],
            borderColor: ['#5fc88f', '#6b9aeb', '#8b9db5'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: '#1a2332',
                font: { size: 11 },
                padding: 10
              }
            }
          }
        }
      });
    }

    // Geographic Distribution Pie Chart
    const geoCtx = geoCanvas.getContext('2d');
    if (geoCtx) {
      const geoLabels = Object.keys(portfolioData.geoDistribution);
      const geoData = Object.values(portfolioData.geoDistribution);
      const geoColors = ['#5fc88f', '#6b9aeb', '#8b7ceb', '#eb8b5f', '#ebcf5f', '#8b9db5'];

      new Chart(geoCtx, {
        type: 'pie',
        data: {
          labels: geoLabels,
          datasets: [{
            data: geoData as number[],
            backgroundColor: geoColors.slice(0, geoLabels.length),
            borderColor: geoColors.slice(0, geoLabels.length),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: '#1a2332',
                font: { size: 11 },
                padding: 10
              }
            }
          }
        }
      });
    }
  }

  private initializeChartButtons() {
    const buttons = document.querySelectorAll('.show-breakdown');
    buttons.forEach((btn) => {
      if (!(btn as any)._chartInitialized) {
        (btn as any)._chartInitialized = true;
        btn.addEventListener('click', (e) => {
          const cardId = (e.target as HTMLElement).getAttribute('data-card-id');
          if (cardId) {
            // Create a fake MouseEvent to pass to toggleFactorChart
            const fakeEvent = { target: e.target } as MouseEvent;
            this.toggleFactorChart(fakeEvent);
          }
        });
      }
    });
  }



  onEvent(ev: AgentEvent) {
    const push = (c: Card) => this.cards.update(arr => [...arr, c]);
    switch (ev.kind) {
      case 'thinking':
        push({ kind:'thinking', label: ev['text'], t:ev.t });
        break;
      case 'source_found':
        this.sources.update(arr => [...arr, ev['source']]);
        push({ kind:'source', source: ev['source'], t:ev.t });
        break;
      case 'browser_preview':
        // Update live browser preview
        console.log('[UI] Browser preview received:', {
          url: ev['url'],
          hasScreenshot: !!ev['screenshot'],
          screenshotLength: ev['screenshot']?.length
        });
        this.browserPreview.set({
          url: ev['url'],
          screenshot: ev['screenshot'],
          label: ev['label'] || 'Live browser view'
        });
        break;
      case 'property_progress':
        // Update or add progressive property
        const prop = ev['property'];
        const step = ev['step'];
        const count = ev['count'];
        
        console.log('[UI] Property progress:', {
          step,
          count,
          hasScreenshot: !!prop.screenshot,
          screenshotLength: prop.screenshot?.length,
          hasTitle: !!prop.title
        });
        
        this.progressProperties.update(arr => {
          const existing = arr.find(p => p.url === prop.url);
          if (existing) {
            // Update existing property
            return arr.map(p => p.url === prop.url ? { ...p, ...prop, step, count } : p);
          } else {
            // Add new property
            return [...arr, { ...prop, step, count }];
          }
        });
        break;
      case 'deal_found':
        // ✅ Progressive streaming: add deal immediately as it arrives
        this.deals.update(arr => [...arr, ev['deal']]);
        push({ kind:'thinking', label: `✓ Found property ${ev['count']}: ${ev['deal'].title}`, t:ev.t });
        break;
      case 'answer_chunk':
        this.answer.update(curr => curr + ev['text']);
        // Try to initialize charts after adding content
        setTimeout(() => this.initializePortfolioCharts(), 100);
        break;
      case 'answer_complete':
        this.answerComplete.set(true);
        push({ kind:'answer', label: this.answer(), t:ev.t });
        break;
      case 'status':   push({ kind:'status', label: ev['label'], note: ev['note'], t:ev.t }); break;
      case 'wait':     push({ kind:'wait', label: ev['label'], t:ev.t }); break;
      case 'nav':      push({ kind:'nav', label: (ev['label'] || ev['url']), url: ev['url'], t:ev.t }); break;
      case 'action':   push({ kind:'action', label: ev['label'], t:ev.t }); break;
      case 'fallback': push({ kind:'fallback', label: ev['label'], t:ev.t }); break;
      case 'shot':     push({ kind:'shot', label: ev['label'], b64: ev['b64'], t:ev.t }); break;
      case 'extracted':push({ kind:'extracted', summary: ev['summary'], t:ev.t }); break;
      case 'run_started':  push({ kind:'started', label:'🚀 Initializing search', t:ev.t }); break;
      case 'run_finished': push({ kind:'finished', label:'Done', t:ev.t }); break;
    }
  }
}
