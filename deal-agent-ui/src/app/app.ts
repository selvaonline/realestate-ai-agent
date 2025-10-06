import { Component, AfterViewChecked, AfterViewInit, signal, ElementRef, ChangeDetectorRef, NgZone, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, AgentEvent } from './agent.service';
import { environment } from '../environments/environment';
import { Chart, registerables } from 'chart.js';
import { ChangeDetectionStrategy } from '@angular/core';
import { ChatPanelComponent } from './chat-panel.component';
import { ChatUIActionsComponent } from './chat-ui-actions.component';
import { KeyboardShortcutsComponent } from './keyboard-shortcuts.component';
import { CometToastComponent } from './comet-toast.component';
import { NotificationsPanelComponent } from './notifications-panel.component';
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
  imports: [CommonModule, FormsModule, SafeHtmlPipe, ChatPanelComponent, ChatUIActionsComponent, KeyboardShortcutsComponent, CometToastComponent, NotificationsPanelComponent],
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

      <!-- Macro Ticker removed - using the one in deals section to avoid duplication -->

      <!-- Sources -->
      <div class="sources-section" *ngIf="sources().length && answerComplete()">
        <h3>Sources</h3>
        <div class="source-item" *ngFor="let src of sources()">
          <div class="source-header">
            <span class="source-num">[{{ src.id }}]</span>
            <div class="source-content">
              <a [href]="src.url" target="_blank" class="source-title">{{ src.title }}</a>
              <div class="source-url">
                <a [href]="src.url" target="_blank" class="url-link">{{ src.url }}</a>
              </div>
            </div>
          </div>
          <div class="source-snippet">{{ src.snippet }}</div>
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

    <div class="deals" *ngIf="sources().length || deals().length">
      <!-- Macro Ticker - Inside deals section -->
      <div class="macro-ticker">
        <div class="ticker-item">
          <span class="ticker-label">📊 10Y Treasury</span>
          <span class="ticker-value">{{ getTreasuryRate() }}%</span>
        </div>
        <div class="ticker-item">
          <span class="ticker-label">📈 S&P 500</span>
          <span class="ticker-value">{{ getSP500() }}</span>
        </div>
        <div class="ticker-item">
          <span class="ticker-label">🏢 Properties</span>
          <span class="ticker-value">{{ sources().length || deals().length || 0 }}</span>
        </div>
        <div class="ticker-item">
          <span class="ticker-label">⭐ Avg PE</span>
          <span class="ticker-value">{{ getAvgPE() }}</span>
        </div>
        <div class="ticker-item">
          <span class="ticker-label">⚠️ Avg Risk</span>
          <span class="ticker-value">{{ getAvgRisk() }}</span>
        </div>
      </div>

      <div class="deals-grid">
        <div class="deal-card" *ngFor="let d of deals(); let i = index">
          <div class="deal-image" *ngIf="d.screenshotBase64">
            <img [src]="'data:image/png;base64,'+d.screenshotBase64" alt="Property image" />
            <div class="deal-badge">{{ i + 1 }}</div>
            <div class="source-badge">{{ getSourceBadge(d.source || d.url) }}</div>
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
              <button class="add-to-watchlist-btn" (click)="showWatchlistSelector(d)" title="Add to Watchlist">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Panel -->
    <app-chat-panel 
      [getContext]="getChatContext">
    </app-chat-panel>

    <!-- Comet Toast Notifications -->
    <app-comet-toast></app-comet-toast>

    <!-- Notifications Panel -->
    <app-notifications-panel></app-notifications-panel>
    
    <!-- UI Actions Listener -->
    <app-chat-ui-actions
      (openCard)="handleOpenCard($event)"
      (renderCharts)="handleRenderCharts($event)"
      (exportMemo)="handleExportMemo($event)"
      (scrollToDeal)="handleScrollToDeal($event)"
      (filterDeals)="handleFilterDeals($event)"
      (compareDeals)="handleCompareDeals($event)">
    </app-chat-ui-actions>

    <!-- Keyboard Shortcuts -->
    <app-keyboard-shortcuts
      (openSearch)="handleOpenSearch()"
      (openHelp)="handleOpenHelp()"
      (closeModal)="handleCloseModal()"
      (openChat)="handleOpenChat()">
    </app-keyboard-shortcuts>

    <!-- Watchlist Selector Modal -->
    <div *ngIf="showWatchlistModal()"
         style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 999999; backdrop-filter: blur(4px);"
         (click)="showWatchlistModal.set(false)">
      <div style="background: white; padding: 32px; border-radius: 20px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);"
           (click)="$event.stopPropagation()">
        <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #1f2937;">Add to Watchlist</h2>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">
          Save "{{ selectedPropertyToSave()?.title }}" to monitor for changes
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
          <button *ngFor="let w of availableWatchlists()"
                  (click)="selectedWatchlistId.set(w.id); showCreateWatchlist.set(false)"
                  [style.background]="selectedWatchlistId() === w.id ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ffffff'"
                  [style.color]="selectedWatchlistId() === w.id ? 'white' : '#374151'"
                  [style.border]="selectedWatchlistId() === w.id ? '2px solid #667eea' : '2px solid #e5e7eb'"
                  [style.transform]="selectedWatchlistId() === w.id ? 'scale(1.02)' : 'scale(1)'"
                  [style.boxShadow]="selectedWatchlistId() === w.id ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'"
                  style="padding: 16px 20px; border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 600; text-align: left; transition: all 0.2s; display: flex; flex-direction: column; gap: 4px; position: relative;">
            <span>{{ w.label }}</span>
            <span [style.opacity]="selectedWatchlistId() === w.id ? '0.9' : '0.6'" style="font-size: 12px; font-weight: 400;">{{ w.query.substring(0, 60) }}...</span>
            <span *ngIf="selectedWatchlistId() === w.id" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 20px;">✓</span>
          </button>
          
          <!-- Create New Watchlist Button -->
          <button (click)="toggleCreateWatchlist()"
                  [style.background]="showCreateWatchlist() ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#ffffff'"
                  [style.color]="showCreateWatchlist() ? 'white' : '#10b981'"
                  [style.border]="showCreateWatchlist() ? '2px solid #10b981' : '2px solid #10b981'"
                  style="padding: 16px 20px; border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 600; text-align: center; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 18px;">+</span>
            <span>Create New Watchlist</span>
          </button>
          
          <!-- New Watchlist Form -->
          <div *ngIf="showCreateWatchlist()" style="padding: 16px; background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; margin-top: 8px;">
            <input [(ngModel)]="newWatchlistName" 
                   type="text" 
                   placeholder="Watchlist name (e.g., 'High-Cap Retail Properties')"
                   style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; margin-bottom: 12px; box-sizing: border-box;">
            <textarea [(ngModel)]="newWatchlistQuery" 
                      placeholder="Search query (e.g., 'retail NNN lease investment grade cap rate 6..8%')"
                      rows="3"
                      style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; resize: vertical; box-sizing: border-box;"></textarea>
            <div style="margin-top: 8px; font-size: 12px; color: #059669;">
              💡 Tip: The query will be used to find similar properties automatically
            </div>
          </div>
          
          <div *ngIf="availableWatchlists().length === 0 && !showCreateWatchlist()" style="text-align: center; padding: 20px; color: #6b7280;">
            No watchlists available. Create one above!
          </div>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button (click)="showWatchlistModal.set(false)"
                  style="flex: 1; background: #f3f4f6; color: #6b7280; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">
            Cancel
          </button>
          <button (click)="saveToWatchlist()"
                  [disabled]="!selectedWatchlistId() || savingToWatchlist()"
                  style="flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; opacity: 1;"
                  [style.opacity]="!selectedWatchlistId() || savingToWatchlist() ? '0.5' : '1'"
                  [style.cursor]="!selectedWatchlistId() || savingToWatchlist() ? 'not-allowed' : 'pointer'">
            {{ savingToWatchlist() ? 'Saving...' : 'Save' }}
          </button>
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
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
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
      flex-shrink: 0;
    }
    .source-content {
      flex: 1;
      min-width: 0;
    }
    .source-title {
      color: #1a0dab;
      font-size: 18px;
      font-weight: 400;
      text-decoration: none;
      display: block;
      margin-bottom: 4px;
      line-height: 1.3;
    }
    .source-title:hover { 
      text-decoration: underline; 
    }
    .source-url { 
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }
    .url-link { 
      color: #006621; 
      text-decoration: none; 
      font-size: 14px;
      word-break: break-all;
      transition: color 0.2s;
      line-height: 1.3;
    }
    .url-link:hover {
      text-decoration: underline;
    }
    .source-snippet { 
      color: #545454; 
      font-size: 14px; 
      line-height: 1.6;
      padding-left: 47px;
      margin-bottom: 12px;
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
    
    .source-save-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(102, 126, 234, 0.1);
      border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 8px;
      color: #667eea;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 12px;
    }
    
    .source-save-btn:hover {
      background: rgba(102, 126, 234, 0.2);
      border-color: rgba(102, 126, 234, 0.5);
      transform: translateY(-1px);
    }
    
    .source-save-btn svg {
      stroke: currentColor;
    }
    
    .source-save-btn-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    
    .source-save-btn-header:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .source-save-btn-header svg {
      stroke: currentColor;
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
    
    /* Macro Ticker */
    .macro-ticker {
      display: flex;
      gap: 24px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1a2332 0%, #0f1419 100%);
      border: 1px solid #2d3748;
      border-radius: 12px;
      margin: 24px 0;
      overflow-x: auto;
    }
    
    .ticker-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
    }
    
    .ticker-label {
      font-size: 11px;
      color: #8b9db5;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .ticker-value {
      font-size: 18px;
      color: #e9eef5;
      font-weight: 700;
    }
    
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

    .source-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      color: white;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.5px;
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
      display: flex;
      gap: 8px;
      align-items: center;
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
      flex: 1;
    }
    
    .add-to-watchlist-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      background: rgba(102, 126, 234, 0.1);
      border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 8px;
      color: #667eea;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .add-to-watchlist-btn:hover {
      background: rgba(102, 126, 234, 0.2);
      border-color: rgba(102, 126, 234, 0.5);
      transform: translateY(-1px);
    }
    
    .add-to-watchlist-btn svg {
      stroke: currentColor;
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
export class App implements AfterViewInit, AfterViewChecked {
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
  selectedDealForModal = signal<any | null>(null);
  showDealModal = signal(false);
  showChartsModal = signal(false);
  chartsScope = signal<'deal' | 'portfolio'>('portfolio');
  selectedDealForCharts = signal<any | null>(null);
  showComparisonModal = signal(false);
  dealsToCompare = signal<any[]>([]);
  activeFilters = signal<any>({});
  showWatchlistModal = signal(false);
  selectedPropertyToSave = signal<any>(null);
  selectedWatchlistId = signal<string | null>(null);
  availableWatchlists = signal<any[]>([]);
  savingToWatchlist = signal(false);
  showCreateWatchlist = signal(false);
  newWatchlistName = '';
  newWatchlistQuery = '';
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

  ngAfterViewInit() {
    // Set up event delegation for dynamically added buttons
    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Handle "Deal Factors" button clicks
      if (target.classList.contains('show-breakdown') || target.closest('.show-breakdown')) {
        const button = target.classList.contains('show-breakdown') ? target : target.closest('.show-breakdown') as HTMLElement;
        if (button) {
          this.toggleFactorChart(event);
        }
      }
      
      // Handle "Add to Watchlist" button clicks
      if (target.classList.contains('add-to-watchlist-btn-inline') || target.closest('.add-to-watchlist-btn-inline')) {
        const button = target.classList.contains('add-to-watchlist-btn-inline') ? target : target.closest('.add-to-watchlist-btn-inline') as HTMLElement;
        if (button) {
          event.stopPropagation();
          event.preventDefault();
          const url = button.dataset['url'] || '';
          const title = button.dataset['title'] || '';
          const score = parseInt(button.dataset['score'] || '0');
          const risk = parseInt(button.dataset['risk'] || '0');
          console.log('[watchlist] Button clicked via delegation!', { url, title, score, risk });
          this.showWatchlistSelector({ url, title, peScore: score, riskScore: risk });
        }
      }
    });
  }

  ngAfterViewChecked() {
    // Debug: Check if icon exists
    const icon = document.getElementById('pe-model-info-icon');
    if (icon) {
      // Ensure it's clickable
      icon.style.cursor = 'pointer';
      icon.style.userSelect = 'none';
    }
    
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
  
  private attachWatchlistButtonListeners() {
    // Attach listeners to "Add to Watchlist" buttons in opportunities
    document.querySelectorAll('.add-to-watchlist-btn-inline').forEach((element) => {
      const button = element as HTMLElement;
      if (!button.dataset['listenerAttached']) {
        const clickHandler = (event: MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();
          console.log('[watchlist] Button clicked!');
          const url = button.dataset['url'] || '';
          const title = button.dataset['title'] || '';
          const score = parseInt(button.dataset['score'] || '0');
          const risk = parseInt(button.dataset['risk'] || '0');
          console.log('[watchlist] Property data:', { url, title, score, risk });
          
          // Use setTimeout to ensure this runs after any other event handlers
          setTimeout(() => {
            this.showWatchlistSelector({ url, title, peScore: score, riskScore: risk });
          }, 0);
        };
        
        button.addEventListener('click', clickHandler, { once: false });
        button.dataset['listenerAttached'] = 'true';
        console.log('[watchlist] Listener attached to button for:', button.dataset['title']);
      }
    });
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

  getChatContext = () => {
    // Provide current run context to the chat panel
    const allDeals = this.deals();
    const scored = allDeals.slice(0, 10); // Top 10 deals
    const portfolioData = this.computePortfolioData();
    
    console.log('[getChatContext] Total deals:', allDeals.length);
    console.log('[getChatContext] Scored deals:', scored.length);
    console.log('[getChatContext] Portfolio data:', portfolioData);
    
    return {
      scored,
      portfolioData,
      query: this.q(),
      sources: this.sources(),
      answer: this.answer(),
      riskNote: portfolioData?.marketRisk?.note || ''
    };
  }

  private computePortfolioData() {
    const deals = this.deals();
    if (!deals.length) return null;

    // Calculate portfolio statistics
    const totalDeals = deals.length;
    const avgPE = deals.reduce((sum, d) => sum + (d.peScore || 0), 0) / totalDeals;
    const avgRisk = deals.reduce((sum, d) => sum + (d.riskScore || 0), 0) / totalDeals;
    
    // Tier distribution
    const tierCounts: Record<string, number> = {};
    deals.forEach(d => {
      const tier = d.peTier || 'Unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    // Geographic distribution
    const geoCounts: Record<string, number> = {};
    deals.forEach(d => {
      const location = d.location || 'Unknown';
      geoCounts[location] = (geoCounts[location] || 0) + 1;
    });

    return {
      totalDeals,
      avgPE: Math.round(avgPE),
      avgRisk: Math.round(avgRisk),
      tierDistribution: tierCounts,
      geoDistribution: geoCounts,
      marketRisk: {
        score: Math.round(avgRisk),
        note: `Average market risk across ${totalDeals} properties`
      }
    };
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

  // ─────────────────────────────────────────────────────────────────────────────
  // UI Action Handlers (triggered by chat)
  // ─────────────────────────────────────────────────────────────────────────────

  handleOpenCard(data: { id?: number; url?: string }) {
    console.log('[ui-action] Open card:', data);
    
    let deal = null;
    
    if (data.id) {
      deal = this.deals()[data.id - 1]; // Convert to 0-based
    } else if (data.url) {
      deal = this.deals().find(d => d.url === data.url);
    }
    
    if (deal) {
      this.selectedDealForModal.set(deal);
      this.showDealModal.set(true);
      console.log('✅ Opened card for:', deal.title);
      
      // Scroll to the deal in the list
      setTimeout(() => {
        const dealIndex = this.deals().indexOf(deal);
        const dealElement = document.querySelector(`.deal-card:nth-of-type(${dealIndex + 1})`);
        if (dealElement) {
          dealElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      console.warn('Deal not found:', data);
    }
  }

  handleRenderCharts(data: { scope: string; id?: number }) {
    console.log('[ui-action] Render charts:', data);
    
    this.chartsScope.set(data.scope as 'deal' | 'portfolio');
    
    if (data.scope === 'portfolio') {
      // Show portfolio-level charts
      this.showChartsModal.set(true);
      this.selectedDealForCharts.set(null);
      console.log('✅ Rendering portfolio charts');
      
      // Initialize charts after modal opens
      setTimeout(() => this.initializePortfolioCharts(), 200);
      
    } else if (data.scope === 'deal' && data.id) {
      // Show deal-specific factor breakdown
      const deal = this.deals()[data.id - 1];
      if (deal) {
        this.selectedDealForCharts.set(deal);
        this.showChartsModal.set(true);
        console.log('✅ Rendering charts for:', deal.title);
        
        // Initialize deal-specific charts after modal opens
        setTimeout(() => this.initializePortfolioCharts(), 200);
      }
    }
  }

  handleExportMemo(data: { id?: number; url?: string; format: string }) {
    console.log('[ui-action] Export memo:', data);
    
    let deal = null;
    
    if (data.id) {
      deal = this.deals()[data.id - 1];
    } else if (data.url) {
      deal = this.deals().find(d => d.url === data.url);
    }
    
    if (deal) {
      console.log(`✅ Exporting ${data.format} memo for:`, deal.title);
      
      // Generate memo content
      const memoContent = this.generateICMemoText();
      
      // Create and download file
      const blob = new Blob([memoContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IC_Memo_${deal.title.replace(/[^a-z0-9]/gi, '_')}.${data.format === 'txt' ? 'txt' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Also show in modal
      this.memoText.set(memoContent);
      this.showMemo.set(true);
    } else {
      console.warn('Deal not found for memo export:', data);
    }
  }

  handleScrollToDeal(data: { id: number }) {
    console.log('[ui-action] Scroll to deal:', data.id);
    
    const dealIndex = data.id - 1; // Convert to 0-based
    const deal = this.deals()[dealIndex];
    
    if (deal) {
      // Try multiple selectors to find the deal card
      const selectors = [
        `.deal-card:nth-of-type(${data.id})`,
        `[data-deal-index="${dealIndex}"]`,
        `.deal-${dealIndex}`
      ];
      
      let dealElement = null;
      for (const selector of selectors) {
        dealElement = document.querySelector(selector);
        if (dealElement) break;
      }
      
      if (dealElement) {
        dealElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the card briefly
        dealElement.classList.add('highlight-flash');
        setTimeout(() => dealElement?.classList.remove('highlight-flash'), 2000);
        console.log('✅ Scrolled to deal:', deal.title);
      } else {
        console.warn('Deal element not found in DOM');
      }
    } else {
      console.warn('Deal not found at index:', dealIndex);
    }
  }

  handleFilterDeals(data: any) {
    console.log('[ui-action] Filter deals:', data);
    
    // Store active filters
    this.activeFilters.set(data);
    
    // Apply filters to deals
    let filteredDeals = this.deals();
    
    if (data.tier) {
      filteredDeals = filteredDeals.filter(d => d.peTier === data.tier);
      console.log(`✅ Filtered by tier: ${data.tier}`);
    }
    
    if (data.location) {
      filteredDeals = filteredDeals.filter(d => 
        d.location?.toLowerCase().includes(data.location.toLowerCase())
      );
      console.log(`✅ Filtered by location: ${data.location}`);
    }
    
    if (data.minPE !== undefined) {
      filteredDeals = filteredDeals.filter(d => (d.peScore || 0) >= data.minPE);
      console.log(`✅ Filtered by min PE: ${data.minPE}`);
    }
    
    if (data.maxRisk !== undefined) {
      filteredDeals = filteredDeals.filter(d => (d.riskScore || 100) <= data.maxRisk);
      console.log(`✅ Filtered by max risk: ${data.maxRisk}`);
    }
    
    console.log(`Filtered ${this.deals().length} → ${filteredDeals.length} deals`);
    
    // Scroll to results
    const resultsElement = document.querySelector('.results-section');
    if (resultsElement) {
      resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  handleCompareDeals(data: { ids: number[] }) {
    console.log('[ui-action] Compare deals:', data.ids);
    
    const dealsToCompare = data.ids
      .map(id => this.deals()[id - 1])
      .filter(Boolean);
    
    if (dealsToCompare.length > 0) {
      this.dealsToCompare.set(dealsToCompare);
      this.showComparisonModal.set(true);
      console.log(`✅ Comparing ${dealsToCompare.length} deals:`, 
        dealsToCompare.map(d => d.title));
    } else {
      console.warn('No valid deals found for comparison:', data.ids);
    }
  }

  toggleCreateWatchlist() {
    const isShowing = !this.showCreateWatchlist();
    this.showCreateWatchlist.set(isShowing);
    this.selectedWatchlistId.set(isShowing ? 'new' : null);
    
    if (isShowing) {
      // Auto-fill query based on property title
      const property = this.selectedPropertyToSave();
      if (property && property.title) {
        // Clean up title - remove "..." and other artifacts
        let title = property.title.replace(/\.{3,}/g, '').trim();
        // Extract key terms (remove common words like "for sale", "listing", etc.)
        title = title.replace(/\s+(for sale|listing|property)$/i, '').trim();
        this.newWatchlistQuery = `${title} commercial real estate for sale`;
      }
    }
  }

  async showWatchlistSelector(property: any) {
    console.log('[watchlist] Opening selector for:', property.title);
    console.log('[watchlist] Full property object:', property);
    console.log('[watchlist] Stack trace:', new Error().stack);
    this.selectedPropertyToSave.set(property);
    this.selectedWatchlistId.set(null); // Reset selection
    this.showCreateWatchlist.set(false); // Reset create form
    this.newWatchlistName = '';
    this.newWatchlistQuery = '';
    
    // Load available watchlists
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const apiUrl = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/saved-properties/watchlists`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const watchlists = await response.json();
      this.availableWatchlists.set(watchlists.filter((w: any) => w.enabled !== false));
      this.showWatchlistModal.set(true);
    } catch (err: any) {
      console.error('[watchlist] Failed to load watchlists:', err);
      if (err.name === 'AbortError') {
        alert('⏱️ Request timed out loading watchlists');
      } else {
        alert('❌ Failed to load watchlists. Check if backend is running on port 3001.');
      }
    }
  }

  async saveToWatchlist() {
    const property = this.selectedPropertyToSave();
    let watchlistId = this.selectedWatchlistId();
    
    if (!property || !watchlistId) {
      console.error('[watchlist] Missing property or watchlist ID');
      return;
    }
    
    // If creating a new watchlist, validate and create it first
    if (watchlistId === 'new') {
      if (!this.newWatchlistName.trim()) {
        alert('⚠️ Please enter a name for the new watchlist');
        return;
      }
      if (!this.newWatchlistQuery.trim()) {
        alert('⚠️ Please enter a search query for the new watchlist');
        return;
      }
      
      // Generate ID from name
      watchlistId = this.newWatchlistName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      // Create the watchlist via API
      try {
        console.log('[watchlist] Creating new watchlist:', { id: watchlistId, label: this.newWatchlistName, query: this.newWatchlistQuery });
        
        const apiUrl = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
        const response = await fetch(`${apiUrl}/api/saved-properties/watchlists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: watchlistId,
            label: this.newWatchlistName,
            query: this.newWatchlistQuery
          })
        });
        
        if (response.status === 409) {
          alert('⚠️ A watchlist with this name already exists. Please choose a different name.');
          return;
        } else if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const newWatchlist = await response.json();
        console.log('[watchlist] ✅ Watchlist created successfully:', newWatchlist);
        
        // Add to available watchlists
        this.availableWatchlists.update(lists => [...lists, newWatchlist]);
        
      } catch (err: any) {
        console.error('[watchlist] Failed to create watchlist:', err);
        alert('❌ Failed to create watchlist. Check console for details.');
        return;
      }
    }
    
    console.log('[watchlist] Saving property:', property.title, 'to', watchlistId);
    this.savingToWatchlist.set(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const apiUrl = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/saved-properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: property.url,
          title: property.title,
          score: property.peScore || property.score,
          risk: property.riskScore || property.risk,
          watchlistId
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 409) {
        alert('This property is already saved to this watchlist');
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      } else {
        console.log('[watchlist] ✅ Property saved successfully');
        this.showWatchlistModal.set(false);
        this.selectedWatchlistId.set(null); // Reset selection
        
        // Show success toast
        const watchlist = this.availableWatchlists().find((w: any) => w.id === watchlistId);
        alert(`✅ Saved to "${watchlist?.label || watchlistId}"`);
      }
    } catch (err: any) {
      console.error('[watchlist] Failed to save:', err);
      if (err.name === 'AbortError') {
        alert('⏱️ Request timed out. Please check if the backend server is running on port 3001.');
      } else {
        alert(`Failed to save property: ${err.message || 'Unknown error'}`);
      }
    } finally {
      console.log('[watchlist] Resetting savingToWatchlist flag');
      this.savingToWatchlist.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  getSourceBadge(sourceOrUrl: string): string {
    if (!sourceOrUrl) return 'WEB';
    const s = sourceOrUrl.toLowerCase();
    if (s.includes('crexi')) return 'CREXI';
    if (s.includes('loopnet')) return 'LOOPNET';
    if (s.includes('brevitas')) return 'BREVITAS';
    if (s.includes('commercialexchange')) return 'COMEX';
    if (s.includes('biproxi')) return 'BIPROXI';
    return 'WEB';
  }

  getTreasuryRate(): string {
    // Get from portfolio data or default
    const portfolioData = this.computePortfolioData();
    return '4.52'; // TODO: Get from actual market data
  }

  getSP500(): string {
    return '5,815'; // TODO: Get from actual market data
  }

  getAvgPE(): string {
    const sources = this.sources();
    if (!sources.length) return '-';
    const avg = sources.reduce((sum, s) => sum + (s.score || 0), 0) / sources.length;
    return Math.round(avg).toString();
  }

  getAvgRisk(): string {
    const sources = this.sources();
    if (!sources.length) return '-';
    const avg = sources.reduce((sum, s) => sum + (s.riskScore || 0), 0) / sources.length;
    return Math.round(avg).toString();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Keyboard Shortcut Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  handleOpenSearch() {
    // Focus on the search input
    const input = document.querySelector('input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();
      console.log('⌨️ Cmd+K: Focused search input');
    }
  }

  handleOpenHelp() {
    // Show help modal or tooltip
    alert(`Keyboard Shortcuts:
    
⌨️ Cmd+K (Ctrl+K) - Focus search
💬 Cmd+/ (Ctrl+/) - Open chat
❓ Shift+? - Show this help
❌ Esc - Close modals

Chat Commands:
• "Show me premium opportunities"
• "Why is the risk score X?"
• "Go to property #2"
• "Compare deal #1 and #3"
• "Create a memo for deal #1"`);
    console.log('⌨️ ?: Opened help');
  }

  handleCloseModal() {
    // Close any open modals
    this.showMemo.set(false);
    this.showPeModelInfo.set(false);
    this.showMarketRiskInfo.set(false);
    this.showDealModal.set(false);
    this.showChartsModal.set(false);
    this.showComparisonModal.set(false);
    this.showWatchlistModal.set(false);
    console.log('⌨️ Esc: Closed modals');
  }

  handleOpenChat() {
    // Open the chat panel (assuming it has a toggle method)
    const chatButton = document.querySelector('.chat-toggle') as HTMLButtonElement;
    if (chatButton) {
      chatButton.click();
      console.log('⌨️ Cmd+/: Opened chat');
    }
  }
}
