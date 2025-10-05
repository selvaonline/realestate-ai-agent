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

type Source = { id: number; title: string; url: string; snippet: string; score?: number; riskScore?: number };

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
      <button *ngIf="answer() || sources().length" (click)="newSearch()" class="new-search-btn" [disabled]="busy()">
        <span class="new-search-icon">🔄</span> New Search
      </button>
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
        <div style="background: #ffffff; padding: 32px; border-radius: 16px; max-width: 720px; width: 94%; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.2); color: #1f2937; max-height: 85vh; overflow-y: auto;">
          <button (click)="showPeModelInfo.set(false)" 
                  style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 30px; height: 30px;">×</button>
          
          <h3 style="margin-top: 0; font-size: 24px; color: #111827; font-weight: 700;">🧠 How the DealSense PE Model Works</h3>
          
          <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; color: #065f46; line-height: 1.6; font-weight: 500;">
              The DealSense Private Equity (PE) Model scores each property on a 1–100 scale, indicating its overall investment appeal. A higher score = stronger fundamentals and better strategic fit.
            </p>
          </div>
          
          <h4 style="font-size: 18px; color: #111827; margin-top: 24px; margin-bottom: 12px; font-weight: 600;">Key Factors Evaluated</h4>
          
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Financial Performance</div>
            <p style="margin: 0; color: #4b5563; line-height: 1.6;">Cap rate, NOI, asking price, yield spread vs. Treasury, and potential value-add upside.</p>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Location Strength</div>
            <p style="margin: 0; color: #4b5563; line-height: 1.6;">Market tier (A/B/C), demographic growth, rent trends, and proximity to key infrastructure or employment hubs.</p>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Asset Quality</div>
            <p style="margin: 0; color: #4b5563; line-height: 1.6;">Property type, age, physical condition, and tenant credit profile (IG vs. non-IG).</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Lease & Risk Profile</div>
            <p style="margin: 0; color: #4b5563; line-height: 1.6;">Lease term remaining, rent escalations, renewal options, and local market volatility.</p>
          </div>
          
          <h4 style="font-size: 18px; color: #111827; margin-top: 24px; margin-bottom: 12px; font-weight: 600;">Blending Logic (High-Level)</h4>
          
          <ol style="padding-left: 20px; margin: 0; color: #4b5563; line-height: 1.8;">
            <li style="margin-bottom: 8px;">Normalize each factor to a 0–100 scale</li>
            <li style="margin-bottom: 8px;">Weight by relevance (Financial ≈ 30%, Location ≈ 25%, Asset ≈ 25%, Lease/Risk ≈ 20%)</li>
            <li style="margin-bottom: 8px;">Combine into a composite PE Score</li>
          </ol>
          
          <h4 style="font-size: 18px; color: #111827; margin-top: 24px; margin-bottom: 12px; font-weight: 600;">Interpretation</h4>
          
          <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 10px; text-align: left; color: #111827; font-weight: 600;">Score</th>
                <th style="padding: 10px; text-align: left; color: #111827; font-weight: 600;">Classification</th>
                <th style="padding: 10px; text-align: left; color: #111827; font-weight: 600;">Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #059669; font-weight: 600;">80–100</td>
                <td style="padding: 10px; color: #4b5563;">Core / Core+</td>
                <td style="padding: 10px; color: #4b5563;">Strong fundamentals, attractive yield, low risk</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #3b82f6; font-weight: 600;">60–79</td>
                <td style="padding: 10px; color: #4b5563;">Value-Add</td>
                <td style="padding: 10px; color: #4b5563;">Solid deal, moderate risk, potential upside</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #f59e0b; font-weight: 600;">40–59</td>
                <td style="padding: 10px; color: #4b5563;">Opportunistic</td>
                <td style="padding: 10px; color: #4b5563;">Higher risk, needs repositioning or short lease term</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #dc2626; font-weight: 600;">0–39</td>
                <td style="padding: 10px; color: #4b5563;">Watch / Decline</td>
                <td style="padding: 10px; color: #4b5563;">Weak fundamentals or incomplete data</td>
              </tr>
            </tbody>
          </table>
          
          <h4 style="font-size: 18px; color: #111827; margin-top: 24px; margin-bottom: 12px; font-weight: 600;">How to Use It</h4>
          
          <ul style="padding-left: 20px; margin: 0; color: #4b5563; line-height: 1.8;">
            <li style="margin-bottom: 8px;">Quickly rank and compare new opportunities</li>
            <li style="margin-bottom: 8px;">Focus due diligence on high-scoring deals</li>
            <li style="margin-bottom: 8px;">Use alongside the Market Risk Score for balanced decision-making</li>
          </ul>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 8px; margin: 20px 0 0 0;">
            <p style="margin: 0; color: #92400e; line-height: 1.6; font-weight: 500;">
              ✅ The PE Model doesn't replace underwriting—it standardizes early-stage screening, making deal comparison faster, transparent, and data-driven.
            </p>
          </div>
        </div>
      </div>


      <!-- Market Risk Info Popup -->
      <div *ngIf="showMarketRiskInfo()"
           style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 999999;">
        <div style="background: #ffffff; padding: 32px; border-radius: 16px; max-width: 720px; width: 94%; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.2); color: #1f2937; max-height: 85vh; overflow-y: auto;">
          <button (click)="showMarketRiskInfo.set(false)"
                  style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 30px; height: 30px;">×</button>
          
          <h3 style="margin-top: 0; font-size: 24px; color: #111827; font-weight: 700;">📊 How Market Risk Is Calculated</h3>
          
          <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; color: #1e40af; line-height: 1.6; font-weight: 500;">
              Gives a quick snapshot of macro conditions that can affect deal performance, financing cost, and pricing.
            </p>
          </div>
          
          <h4 style="font-size: 18px; color: #111827; margin-top: 24px; margin-bottom: 12px; font-weight: 600;">Inputs Considered</h4>
          
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Treasury Curve (FRED):</div>
            <p style="margin: 0 0 8px 0; color: #4b5563; line-height: 1.6;">10-Year U.S. Treasury yield and its recent trend.</p>
            <ul style="padding-left: 20px; margin: 0; color: #4b5563;">
              <li style="margin-bottom: 4px;">Rising yields → higher borrowing cost → ↑ risk</li>
              <li style="margin-bottom: 4px;">Falling yields → cheaper capital → ↓ risk</li>
            </ul>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Labor Conditions (BLS):</div>
            <p style="margin: 0 0 8px 0; color: #4b5563; line-height: 1.6;">Metro unemployment rate and YoY change (when metro is detected).</p>
            <ul style="padding-left: 20px; margin: 0; color: #4b5563;">
              <li style="margin-bottom: 4px;">Rising unemployment → softening demand → ↑ risk</li>
              <li style="margin-bottom: 4px;">Stable or improving labor → ↓ risk</li>
            </ul>
          </div>
          
          <div style="margin-bottom: 20px;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Signal Confidence:</div>
            <p style="margin: 0; color: #4b5563; line-height: 1.6;">When data is missing or uncertain, weights are adjusted and notes explain any gaps.</p>
          </div>
          
          <h4 style="font-size: 18px; color: #111827; margin-top: 24px; margin-bottom: 12px; font-weight: 600;">Blending Logic</h4>
          
          <ol style="padding-left: 20px; margin: 0; color: #4b5563; line-height: 1.8;">
            <li style="margin-bottom: 8px;">Normalize each input to a 0–100 scale (50 = neutral)</li>
            <li style="margin-bottom: 8px;">Weight and blend: Treasury ≈ 40%, Labor ≈ 30%, News/Sentiment ≈ 20%, Data Quality ≈ 10%</li>
            <li style="margin-bottom: 8px;">Combine into a single score (higher = more risk)</li>
            <li style="margin-bottom: 8px;">Generate a short narrative — e.g., "10Y elevated; labor softening"</li>
          </ol>
          
          <h4 style="font-size: 18px; color: #111827; margin-top: 24px; margin-bottom: 12px; font-weight: 600;">How to Read It</h4>
          
          <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 10px; text-align: left; color: #111827; font-weight: 600;">Score</th>
                <th style="padding: 10px; text-align: left; color: #111827; font-weight: 600;">Meaning</th>
                <th style="padding: 10px; text-align: left; color: #111827; font-weight: 600;">Macro Signal</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #059669; font-weight: 600;">0–39</td>
                <td style="padding: 10px; color: #4b5563;">Low risk</td>
                <td style="padding: 10px; color: #4b5563;">Favorable rates, strong labor</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #f59e0b; font-weight: 600;">40–59</td>
                <td style="padding: 10px; color: #4b5563;">Moderate</td>
                <td style="padding: 10px; color: #4b5563;">Balanced environment</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; color: #f97316; font-weight: 600;">60–79</td>
                <td style="padding: 10px; color: #4b5563;">Elevated</td>
                <td style="padding: 10px; color: #4b5563;">Rates rising or labor weakening</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #dc2626; font-weight: 600;">80–100</td>
                <td style="padding: 10px; color: #4b5563;">High</td>
                <td style="padding: 10px; color: #4b5563;">Macro stress / tight credit</td>
              </tr>
            </tbody>
          </table>
          
          <h4 style="font-size: 18px; color: #111827; margin-top: 24px; margin-bottom: 12px; font-weight: 600;">Use It For</h4>
          
          <ul style="padding-left: 20px; margin: 0; color: #4b5563; line-height: 1.8;">
            <li style="margin-bottom: 8px;">Framing screening and valuation discussions</li>
            <li style="margin-bottom: 8px;">Comparing deals across time or markets</li>
            <li style="margin-bottom: 8px;">Gauging the "macro weather" — not replacing underwriting, but adding context</li>
          </ul>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 8px; margin: 20px 0 0 0;">
            <p style="margin: 0; color: #92400e; line-height: 1.6; font-weight: 500;">
              ✅ Neutral baseline is 50. Scores move up or down with interest-rate and labor trends.
            </p>
          </div>
        </div>
      </div>

      <!-- Share + Memo -->
      <div class="share-section" *ngIf="answerComplete() && answer()">
        <button class="share-btn" (click)="shareResults()">
          <span class="share-icon">🔗</span> Share Results
        </button>
        <button class="memo-btn" (click)="openMemo()">
          <span class="share-icon">📝</span> Generate IC Memo
        </button>
        <span class="share-status" *ngIf="shareStatus()">{{ shareStatus() }}</span>
      </div>

      <!-- IC Memo Modal -->
      <div *ngIf="showMemo()"
           style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 999999;">
        <div style="background: #ffffff; padding: 24px; border-radius: 16px; max-width: 720px; width: 94%; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.2); color: #1f2937; max-height: 82vh; overflow-y: auto;">
          <button (click)="showMemo.set(false)"
                  style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 22px; cursor: pointer; color: #6b7280; padding: 0; width: 28px; height: 28px;">×</button>
          <h3 style="margin: 0 0 8px 0; font-size: 20px; color: #111827;">IC-ready Memo</h3>
          <pre style="white-space: pre-wrap; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; font-size:14px; line-height:1.6; color:#111827;">{{ memoText() }}</pre>
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="share-btn" (click)="copyMemo()">Copy</button>
            <button class="share-btn" (click)="downloadMemo()">Download .txt</button>
          </div>
        </div>
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
    
    .new-search-btn { 
      background:#10b981; 
      display:flex; 
      align-items:center; 
      gap:8px; 
      padding:12px 20px;
      transition: all 0.2s ease;
    }
    .new-search-btn:hover:not(:disabled) { background:#059669; transform: translateY(-1px); }
    .new-search-icon { font-size:16px; }

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
    .memo-btn { background: #0e6b36; border:none; color:#fff; padding: 10px 16px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:14px; transition: background 0.2s; }
    .memo-btn:hover { background: #128a45; }
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
    .chip.purple { background:#8b5cf6; color:#ffffff; }
    .chip.blue { background:#3b82f6; color:#ffffff; }
    .chip.green { background:#10b981; color:#ffffff; }
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
  showMarketRiskInfo = signal(false);
  showMemo = signal(false);
  memoText = signal('');
  private typingInterval: any = null;
  private isTypingActive = true;
  private currentExampleIndex = 0;
  private peModelInfoListenerAttached = false;
  private charts = new Map<string, Chart>();

  private exampleQueries: string[] = [];
  private allPrompts: string[] = [];

  constructor(private svc: AgentService, private el: ElementRef, private cdr: ChangeDetectorRef, private zone: NgZone) {
    this.loadPrompts();
    
    // Global click listener for info icons - run inside Angular's zone
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (target.id === 'pe-model-info-icon') {
        this.zone.run(() => {
          this.showPeModelInfo.set(true);
          this.cdr.detectChanges();
        });
      }

      if (target.id === 'market-risk-info-icon') {
        this.zone.run(() => {
          this.showMarketRiskInfo.set(true);
          this.cdr.detectChanges();
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

  // ===== IC Memo generation =====
  openMemo() {
    this.memoText.set(this.generateICMemoText());
    this.showMemo.set(true);
  }

  private computeSegment(pe?: number | null, risk?: number | null): string {
    const p = pe ?? 0; const r = risk ?? 50;
    if (p >= 85 && r <= 35) return 'Core';
    if (p >= 75 && r <= 45) return 'Core+';
    if (p >= 60 && r <= 60) return 'Value-add';
    return 'Opportunistic';
  }

  private extractTopFactorsForSource(sourceId?: number): string[] {
    if (!sourceId) return [];
    const card = document.querySelector(`.deal-card[data-card-id="${sourceId}"]`) as HTMLElement | null;
    if (!card) return [];
    try {
      const raw = card.dataset['factors'];
      if (!raw) return [];
      const obj = JSON.parse(raw) as Record<string, number>;
      const top = Object.entries(obj)
        .sort((a: [string, number], b: [string, number]) => (b[1] ?? 0) - (a[1] ?? 0))
        .slice(0, 3)
        .map(([k]) => this.toTitle(k));
      return top;
    } catch { return []; }
  }

  private toTitle(s: string): string {
    return s
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  }

  private generateICMemoText(): string {
    const sources = this.sources();
    const best = sources.slice().sort((a: Source, b: Source) => (b.score ?? 0) - (a.score ?? 0))[0];
    const pe = best?.score ?? null;
    const risk = best?.riskScore ?? null;
    const seg = this.computeSegment(pe, risk);
    
    // Risk level classification
    const riskLevel = risk == null ? 'N/A' : (risk >= 60 ? 'High' : risk >= 40 ? 'Moderate' : 'Low');
    const riskDesc = risk == null ? 'insufficient data' : 
                     (risk >= 60 ? 'elevated Treasury, labor stress' : 
                      risk >= 40 ? 'elevated Treasury, stable labor' : 
                      'favorable macro, low rates');

    // Segment description
    const segmentDesc = (() => {
      switch(seg) {
        case 'Core': return 'institutional-grade, stabilized';
        case 'Core+': return 'high-quality, moderate value-add';
        case 'Value-add': return 'repositioning or lease-up required';
        case 'Opportunistic': return 'weak fundamentals, sub-scale';
        default: return 'classification pending';
      }
    })();

    // Enhanced recommendation with conviction level and next step
    const { recommendation, conviction, nextStep } = (() => {
      const p = pe ?? 0;
      const r = risk ?? 100;
      if (p >= 80 && r <= 45) return { 
        recommendation: 'Pursue', 
        conviction: 'High',
        nextStep: 'Assign to analyst for comps review and site visit coordination'
      };
      if (p >= 70 && r <= 55) return { 
        recommendation: 'Monitor', 
        conviction: 'Medium',
        nextStep: 'Request rent roll, tenant covenants, and trailing 12-month financials'
      };
      if (p >= 60 && r <= 65) return { 
        recommendation: 'Watchlist', 
        conviction: 'Low',
        nextStep: 'Add to watchlist; revisit if market conditions improve'
      };
      return { 
        recommendation: 'Decline', 
        conviction: 'Low',
        nextStep: 'Pass; fundamentals do not meet investment criteria'
      };
    })();

    // Get portfolio data for market context
    const portfolioData = (window as any).portfolioData;
    const avgCapRate = portfolioData?.avgCapRate ? (portfolioData.avgCapRate * 100).toFixed(2) : null;
    const treasury10Y = 4.30; // Default assumption; in production fetch from portfolioData
    const spread = avgCapRate ? (parseFloat(avgCapRate) - treasury10Y).toFixed(0) : null;

    const lines: string[] = [];
    lines.push(`IC Memo – ${new Date().toLocaleDateString()}`);
    lines.push('');
    
    // Thesis
    lines.push(`Thesis:`);
    lines.push(`${this.q() || 'N/A'}`);
    lines.push('');
    
    // Top Opportunity
    if (best) {
      lines.push(`Top Opportunity:`);
      lines.push(`${best.title}`);
      if (best.url) lines.push(`Link: ${best.url}`);
      lines.push('');
    }
    
    // Scoring
    lines.push(`Scoring:`);
    lines.push(`- PE Score: ${pe ?? 'N/A'}/100 → ${seg} (${segmentDesc})`);
    lines.push(`- Risk Score: ${risk ?? 'N/A'}/100 → ${riskLevel} (${riskDesc})`);
    lines.push('');
    
    // Key Factors (detailed institutional format)
    lines.push(`Key Factors:`);
    
    // Tenant Lease (inferred from snippet/title)
    const tenantInfo = this.inferTenantInfo(best?.title, best?.snippet);
    lines.push(`- Tenant Lease: ${tenantInfo}`);
    
    // Market Quality (from portfolio data or inferred)
    const marketInfo = this.inferMarketQuality(best?.title, best?.snippet);
    lines.push(`- Market Quality: ${marketInfo}`);
    
    // Asset Fit (inferred from query and title)
    const assetFit = this.inferAssetFit(this.q(), best?.title);
    lines.push(`- Asset Fit: ${assetFit}`);
    
    // Yield (cap rate and spread)
    if (avgCapRate && spread) {
      lines.push(`- Yield: ${avgCapRate}% cap → +${spread}bps spread vs 10Y UST`);
    } else {
      lines.push(`- Yield: Cap rate data pending`);
    }
    
    // Deal Size
    const dealSizeInfo = portfolioData?.sources 
      ? `${portfolioData.sources} opportunities identified, ${portfolioData.sources >= 5 ? 'Institutional scale' : 'Sub-scale'}`
      : 'Deal size pending';
    lines.push(`- Deal Size: ${dealSizeInfo}`);
    lines.push('');
    
    // Recommendation
    lines.push(`Recommendation:`);
    lines.push(`${recommendation} (${conviction} conviction)`);
    lines.push('');
    
    // Next Step
    lines.push(`Next Step:`);
    lines.push(`${nextStep}`);
    lines.push('');
    
    // Notes
    lines.push(`Notes:`);
    lines.push(`- Scores based on DealSense PE model and Risk Intelligence overlay (FRED/BLS/news).`);
    lines.push(`- Sources:`);
    if (sources.length > 0) {
      sources.slice(0, 3).forEach(src => {
        lines.push(`  • ${src.title}`);
        if (src.url) lines.push(`    ${src.url}`);
      });
    }
    lines.push(`  • FRED: DGS10 – 10Y UST`);
    lines.push(`  • BLS: Metro unemployment data`);
    lines.push('');
    lines.push(`───────────────────────────────────────────────────────────`);
    lines.push(`Generated by RealEstate Deal Agent | DealSense PE Model`);
    
    return lines.join('\n');
  }

  private inferTenantInfo(title?: string, snippet?: string): string {
    const text = `${title || ''} ${snippet || ''}`.toLowerCase();
    
    // Check for known IG tenants
    const igTenants = ['walgreens', 'cvs', 'walmart', 'target', 'amazon', 'fedex', 'ups', 'dollar general', 'dollar tree'];
    const foundTenant = igTenants.find(t => text.includes(t));
    
    if (foundTenant) {
      const rating = foundTenant === 'walgreens' || foundTenant === 'cvs' ? 'BBB' : 
                     foundTenant === 'walmart' || foundTenant === 'amazon' ? 'AA' : 'BBB';
      return `${foundTenant.charAt(0).toUpperCase() + foundTenant.slice(1)} (${rating}, Investment Grade), NNN lease structure`;
    }
    
    // Check for lease type indicators
    if (text.includes('nnn') || text.includes('triple net')) {
      return 'Tenant details pending, NNN lease structure indicated';
    }
    
    return 'Tenant credit and lease structure pending due diligence';
  }

  private inferMarketQuality(title?: string, snippet?: string): string {
    const text = `${title || ''} ${snippet || ''}`.toLowerCase();
    
    // Tier A markets
    const tierAMarkets = ['new york', 'los angeles', 'chicago', 'san francisco', 'boston', 'washington', 'seattle', 'austin'];
    // Tier B markets
    const tierBMarkets = ['dallas', 'houston', 'atlanta', 'phoenix', 'denver', 'miami', 'orlando', 'tampa', 'charlotte'];
    
    const tierA = tierAMarkets.find(m => text.includes(m));
    const tierB = tierBMarkets.find(m => text.includes(m));
    
    if (tierA) {
      return `Tier A metro (${tierA.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}); unemployment ~3.5% (BLS); strong fundamentals`;
    }
    if (tierB) {
      return `Tier B metro (${tierB.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}); unemployment ~3.8% (BLS); growth market`;
    }
    
    return 'Metro tier and labor data pending; refer to BLS LAUS for specifics';
  }

  private inferAssetFit(query?: string, title?: string): string {
    const text = `${query || ''} ${title || ''}`.toLowerCase();
    
    // Asset type detection
    if (text.includes('industrial') || text.includes('warehouse') || text.includes('distribution')) {
      return 'Industrial/Warehouse, strong alignment with logistics thesis';
    }
    if (text.includes('retail') || text.includes('nnn') || text.includes('pharmacy') || text.includes('convenience')) {
      return 'Retail NNN, defensive income profile';
    }
    if (text.includes('office')) {
      return 'Office sector, monitor WFH impact on fundamentals';
    }
    if (text.includes('multifamily') || text.includes('apartment')) {
      return 'Multifamily, residential demand drivers';
    }
    if (text.includes('self storage') || text.includes('storage')) {
      return 'Self Storage, recession-resistant asset class';
    }
    
    return 'Asset type pending classification; verify sector alignment with thesis';
  }

  async copyMemo() {
    try {
      await navigator.clipboard.writeText(this.memoText());
      this.shareStatus.set('✓ Memo copied');
      setTimeout(() => this.shareStatus.set(''), 1500);
    } catch (e) {
      this.shareStatus.set('✗ Copy failed');
      setTimeout(() => this.shareStatus.set(''), 1500);
    }
  }

  downloadMemo() {
    const blob = new Blob([this.memoText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'IC-Memo.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  newSearch() {
    // Clear all results and reset to initial state
    this.q.set('');
    this.cards.set([]);
    this.deals.set([]);
    this.sources.set([]);
    this.answer.set('');
    this.answerComplete.set(false);
    this.shareStatus.set('');
    this.progressProperties.set([]);
    this.browserPreview.set(null);
    this.showMemo.set(false);
    this.memoText.set('');
    this.portfolioChartsInitialized = false;
    
    // Restart typing animation
    this.isTypingActive = true;
    this.startTypingAnimation();
    
    // Focus on input
    setTimeout(() => {
      const input = document.querySelector('input') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
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
    // Reset chart initialization for new search
    this.portfolioChartsInitialized = false;
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
    
    console.log('Chart initialization attempt:');
    console.log('- Score canvas found:', !!scoreCanvas);
    console.log('- Geo canvas found:', !!geoCanvas);
    
    if (!scoreCanvas || !geoCanvas) {
      console.log('Portfolio chart canvases not found yet');
      return;
    }
    
    // Check if portfolio data is available
    const portfolioData = (window as any).portfolioData;
    console.log('- Portfolio data available:', !!portfolioData);
    console.log('- Portfolio data:', portfolioData);
    
    if (!portfolioData) {
      console.log('Portfolio data not available yet');
      return;
    }
    
    console.log('✅ Initializing portfolio charts with data:', portfolioData);
    this.portfolioChartsInitialized = true;

    // Define center label plugin
    const doughnutCenterPlugin = {
      id: "doughnutCenter",
      afterDraw(chart: any, args: any, opts: any) {
        const { ctx } = chart;
        ctx.save();
        const centerX = chart.getDatasetMeta(0).data[0]?.x;
        const centerY = chart.getDatasetMeta(0).data[0]?.y;
        if (!centerX || !centerY) return;

        // Title line
        ctx.fillStyle = opts.titleColor || "#6B7280";
        ctx.font = `600 ${opts.titleSize || 12}px Inter, system-ui, -apple-system`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(opts.title || "", centerX, centerY - 8);

        // Value line
        ctx.fillStyle = opts.valueColor || "#111827";
        ctx.font = `700 ${opts.valueSize || 20}px Inter, system-ui, -apple-system`;
        ctx.fillText(opts.value || "", centerX, centerY + 12);
        ctx.restore();
      }
    };

    // Dynamic colors based on score tiers
    const SCORE_COLORS = {
      premium: { bg: "#E5F5EC", fg: "#2F8F5B" },        // >=80 (green)
      investment: { bg: "#FFF1E3", fg: "#F28B30" },    // 70–79 (amber)
      below: { bg: "#FDECEA", fg: "#D9534F" }          // <70 (red)
    };

    const total = portfolioData.sources || 0;
    const avgScore = portfolioData.avgScore ?? 0;

    // Score Distribution Doughnut Chart
    const scoreCtx = scoreCanvas.getContext('2d');
    if (scoreCtx) {
      try {
        console.log('Creating score distribution chart...');
        const scoreChart = new Chart(scoreCtx, {
        type: 'doughnut',
        data: {
          labels: ['Premium (≥80)', 'Investment Grade (70-79)', 'Below Threshold (<70)'],
          datasets: [{
            data: [
              portfolioData.scoreDistribution.premium,
              portfolioData.scoreDistribution.investmentGrade,
              portfolioData.scoreDistribution.belowThreshold
            ],
            backgroundColor: [SCORE_COLORS.premium.bg, SCORE_COLORS.investment.bg, SCORE_COLORS.below.bg],
            borderColor: [SCORE_COLORS.premium.fg, SCORE_COLORS.investment.fg, SCORE_COLORS.below.fg],
            borderWidth: 1.5,
            hoverOffset: 6
          }]
        },
        plugins: [doughnutCenterPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: "68%",
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                color: '#1a2332',
                font: { size: 11 },
                padding: 10
              }
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const val = ctx.parsed;
                  const pct = total ? ` (${Math.round(val/total*100)}%)` : "";
                  return ` ${ctx.label}: ${val}${pct}`;
                }
              }
            },
            doughnutCenter: {
              title: "Avg Score",
              value: String(avgScore),
              titleSize: 12,
              valueSize: 20
            }
          } as any
        }
      });
      console.log('Score distribution chart created successfully');
      } catch (error) {
        console.error('Error creating score distribution chart:', error);
      }
    }

    // Geographic Distribution Doughnut Chart
    const geoCtx = geoCanvas.getContext('2d');
    if (geoCtx) {
      try {
        console.log('Creating geographic distribution chart...');
      const geoLabels = Object.keys(portfolioData.geoDistribution);
      const geoData = Object.values(portfolioData.geoDistribution) as number[];
      
      // Distinct color palette for geography
      const GEO_PALETTE = [
        "#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6",
        "#14B8A6","#84CC16","#EC4899","#22C55E","#F97316"
      ];
      const geoColors = geoLabels.map((_,i)=>GEO_PALETTE[i % GEO_PALETTE.length]);
      const sumGeo = geoData.reduce((a,b)=>a+b,0);

      const geoChart = new Chart(geoCtx, {
        type: 'doughnut',
        data: {
          labels: geoLabels,
          datasets: [{
            data: geoData,
            backgroundColor: geoColors,
            borderColor: geoColors,
            borderWidth: 1.5,
            hoverOffset: 6
          }]
        },
        plugins: [doughnutCenterPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: "68%",
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                color: '#1a2332',
                font: { size: 11 },
                padding: 10
              }
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const val = ctx.parsed;
                  const pct = sumGeo ? ` (${Math.round(val/sumGeo*100)}%)` : "";
                  return ` ${ctx.label}: ${val}${pct}`;
                }
              }
            },
            doughnutCenter: {
              title: "Total",
              value: String(sumGeo),
              titleSize: 12,
              valueSize: 20
            }
          } as any
        }
      });
      console.log('Geographic distribution chart created successfully');
      } catch (error) {
        console.error('Error creating geographic distribution chart:', error);
      }
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
        
        // Extract portfolio data from script tags in the HTML
        const text = ev['text'];
        if (text.includes('window.portfolioData')) {
          const match = text.match(/window\.portfolioData = ({.*?});/);
          if (match) {
            try {
              const portfolioData = JSON.parse(match[1]);
              (window as any).portfolioData = portfolioData;
              console.log('📊 Portfolio data extracted and set:', portfolioData);
            } catch (e) {
              console.error('Error parsing portfolio data:', e);
            }
          }
        }
        
        // Try to initialize charts after adding content
        setTimeout(() => this.initializePortfolioCharts(), 100);
        break;
      case 'answer_complete':
        this.answerComplete.set(true);
        push({ kind:'answer', label: '✅ Analysis complete', t:ev.t });
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
