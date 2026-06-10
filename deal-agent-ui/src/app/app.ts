import { Component, AfterViewChecked, AfterViewInit, signal, ElementRef, ChangeDetectorRef, NgZone, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, AgentEvent } from './agent.service';
import { environment } from '../environments/environment';
import { Chart, registerables } from 'chart.js';
import { marked } from 'marked';
import { ChangeDetectionStrategy } from '@angular/core';
import { ChatPanelComponent } from './chat-panel.component';
import { ChatUIActionsComponent } from './chat-ui-actions.component';
import { KeyboardShortcutsComponent } from './keyboard-shortcuts.component';
import { CometToastComponent } from './comet-toast.component';
import { NotificationsPanelComponent } from './notifications-panel.component';
import { WatchlistButtonComponent } from './watchlist-button.component';
import { LoadingSkeletonComponent } from './loading-skeleton.component';
import { ErrorBannerComponent } from './error-banner.component';
import { SourceListComponent } from './source-list.component';
import { DealCardComponent } from './deal-card.component';
import { ToastService } from './toast.service';
import { ToastContainerComponent } from './toast-container.component';
import { DcfPanelComponent } from './dcf-panel.component';
import { LocationIntelPanelComponent, MobilityResult } from './location-intel-panel.component';
import { DealComparisonComponent } from './deal-comparison.component';
import { SensitivityTableComponent } from './sensitivity-table.component';
import { LiveMonitorComponent } from './live-monitor.component';
import { DataSourcesPanelComponent } from './data-sources-panel.component';
import { AgentReasoningComponent, AgentStepUI } from './agent-reasoning.component';
import { HowItWorksComponent } from './how-it-works.component';
import { WhyDealsenseComponent } from './why-dealsense.component';
import { McpInfoComponent } from './mcp-info.component';
import { OrgSettingsComponent } from './org-settings.component';
import { QuickActionsComponent } from './quick-actions.component';
import { AgentNetworkPanelComponent, NsNetwork } from './agent-network-panel.component';
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
    // If the value already contains HTML tags (from server-rendered deal cards), pass through
    if (/<[a-z][\s\S]*>/i.test(value)) {
      return this.sanitizer.bypassSecurityTrustHtml(value);
    }
    // Otherwise, parse markdown to HTML
    const html = marked.parse(value, { async: false, breaks: true }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeHtmlPipe, ChatPanelComponent, ChatUIActionsComponent, KeyboardShortcutsComponent, CometToastComponent, NotificationsPanelComponent, WatchlistButtonComponent, DataSourcesPanelComponent, LoadingSkeletonComponent, ErrorBannerComponent, SourceListComponent, DealCardComponent, ToastContainerComponent, DcfPanelComponent, LocationIntelPanelComponent, DealComparisonComponent, SensitivityTableComponent, LiveMonitorComponent, AgentReasoningComponent, HowItWorksComponent, WhyDealsenseComponent, McpInfoComponent, OrgSettingsComponent, QuickActionsComponent, AgentNetworkPanelComponent],
  template: `
  <div class="shell">
    <div class="header-bar">
      <div class="brand">
        <div class="brand-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 21V7l9-4 9 4v14H3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M9 21V13h6v8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name">DealSense</span>
          <span class="brand-sub">AI-Powered CRE Intelligence <span class="brand-badge">Agent</span></span>
        </div>
      </div>
      <div class="header-meta">
        <span class="mobility-enhanced-badge" *ngIf="mobilityEnhanced()" title="Real-world activity signals included via analyze_traffic_patterns">⚡ Mobility Enhanced</span>
        <span class="meta-dot" *ngIf="mobilityEnhanced()"></span>
        <span class="meta-item" *ngIf="sources().length">{{ sources().length }} Deals Found</span>
        <span class="meta-dot" *ngIf="sources().length"></span>
        <span class="meta-item">MCP + LLM Orchestration</span>
        <span class="meta-dot"></span>
        <button class="how-it-works-link orch-toggle" [class.ns-on]="orchMode() === 'neurosan'"
                [class.lg-on]="orchMode() === 'langgraph'" (click)="cycleOrchestrator()"
                title="Cycle orchestrator: Classic agent → Neuro SAN network → LangGraph.js supervisor">
          ⚡ {{ orchLabel() }}
        </button>
        <span class="meta-dot"></span>
        <a class="how-it-works-link docs-link" [href]="docsUrl()" target="_blank" rel="noopener"
           title="Architecture, agents & tools reference, evals, demo guide">📘 Docs</a>
        <span class="meta-dot"></span>
        <button class="how-it-works-link" (click)="showWhyDealsense.set(true)">Why DealSense</button>
        <span class="meta-dot"></span>
        <button class="how-it-works-link" (click)="showHowItWorks.set(true)">How It Works</button>
        <span class="meta-dot"></span>
        <button class="how-it-works-link mcp-link" (click)="showMcpInfo.set(true)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14a1 1 0 01-.78-1.63l9.9-10.2a.5.5 0 01.86.46l-1.92 6.02A1 1 0 0013 10h7a1 1 0 01.78 1.63l-9.9 10.2a.5.5 0 01-.86-.46l1.92-6.02A1 1 0 0011 14H4z"/></svg>
          MCP Server
        </button>
        <span class="meta-dot"></span>
        <button class="how-it-works-link mcp-link" (click)="showOrgSettings.set(true)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          Settings
        </button>
      </div>
    </div>

    <div class="ask">
      <input #qinput [value]="q()" (input)="q.set(qinput.value); stopTyping();"
             [placeholder]="answerComplete() ? 'Search again or refine your query...' : typingPlaceholder()"
             (focus)="stopTyping()"
             (keydown.enter)="run()" />
      <button (click)="run()" [disabled]="busy()">{{ busy() ? 'Analyzing...' : 'Find Deals' }}</button>
      <button *ngIf="answer() || sources().length || searchError()" (click)="newSearch()" class="new-search-btn" [disabled]="busy()">
        <span class="new-search-icon">🔄</span> New Search
      </button>
    </div>

    <!-- Multi-agent network (live) — Neuro SAN or LangGraph -->
    <app-agent-network
      *ngIf="orchMode() !== 'classic' && nsNetwork() && (busy() || nsVisited().length)"
      [network]="nsNetwork()"
      [activeChain]="nsActiveChain()"
      [visited]="nsVisited()"
      [nodeCalls]="nsNodeCalls()"
      [orchestrator]="orchLabel()"
      [hops]="agentHops()"
      [running]="isAgentRunning() || nsReplaying()"
      [canReplay]="!busy() && answerComplete()"
      (replay)="replayOrchestration()">
    </app-agent-network>

    <!-- Agent Reasoning Panel -->
    <app-agent-reasoning
      *ngIf="agentSteps().length > 0"
      [steps]="agentSteps()"
      [hops]="agentHops()"
      [isRunning]="isAgentRunning()">
    </app-agent-reasoning>

    <!-- MCP Server Info Modal -->
    <app-mcp-info
      *ngIf="showMcpInfo()"
      (close)="showMcpInfo.set(false)">
    </app-mcp-info>

    <!-- Organization Settings Modal -->
    <app-org-settings
      *ngIf="showOrgSettings()"
      (close)="showOrgSettings.set(false)"
      (settingsChanged)="onOrgSettingsChanged($event)">
    </app-org-settings>

    <!-- Why DealSense Modal -->
    <app-why-dealsense
      *ngIf="showWhyDealsense()"
      (close)="showWhyDealsense.set(false)">
    </app-why-dealsense>

    <!-- How It Works Modal -->
    <app-how-it-works
      *ngIf="showHowItWorks()"
      (close)="showHowItWorks.set(false)">
    </app-how-it-works>

    <!-- Recent searches -->
    <div class="search-history" *ngIf="searchHistory().length && !busy() && !answer() && !sources().length">
      <span class="sh-label">Recent:</span>
      <button class="sh-chip" *ngFor="let h of searchHistory()" (click)="runFromHistory(h)" [title]="h">
        {{ h.length > 64 ? h.slice(0, 63) + '…' : h }}
      </button>
      <button class="sh-clear" (click)="clearHistory()" title="Clear history">✕</button>
    </div>

    <!-- Capabilities Bar -->
    <div class="capabilities-bar" *ngIf="!busy() && !answer() && !sources().length">
      <div class="cap-item">
        <div class="cap-icon cap-icon-ai">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        </div>
        <div class="cap-text">
          <span class="cap-title">AI Agent</span>
          <span class="cap-desc">Multi-step reasoning</span>
        </div>
      </div>
      <div class="cap-item">
        <div class="cap-icon cap-icon-browser">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 7h20M8 21h8M12 17v4"/></svg>
        </div>
        <div class="cap-text">
          <span class="cap-title">Browser Agent</span>
          <span class="cap-desc">Playwright automation</span>
        </div>
      </div>
      <div class="cap-item">
        <div class="cap-icon cap-icon-data">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg>
        </div>
        <div class="cap-text">
          <span class="cap-title">Live Macro Data</span>
          <span class="cap-desc">FRED + BLS feeds</span>
        </div>
      </div>
      <div class="cap-item">
        <div class="cap-icon cap-icon-score">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
        <div class="cap-text">
          <span class="cap-title">PE Scoring</span>
          <span class="cap-desc">6-factor model</span>
        </div>
      </div>
      <div class="cap-item">
        <div class="cap-icon cap-icon-risk">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        </div>
        <div class="cap-text">
          <span class="cap-title">Risk Intelligence</span>
          <span class="cap-desc">Market risk overlay</span>
        </div>
      </div>
      <div class="cap-item">
        <div class="cap-icon cap-icon-mobility">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="cap-text">
          <span class="cap-title">Mobility Intelligence</span>
          <span class="cap-desc">Foot traffic, parking, road activity</span>
        </div>
      </div>
    </div>

    <!-- Watchlist Context Banner -->
    <div class="watchlist-banner" *ngIf="currentWatchlist()">
      <span class="watchlist-icon">📌</span>
      <span class="watchlist-label">Showing results for: <strong>{{ currentWatchlist()!.label }}</strong></span>
      <button class="clear-watchlist-btn" (click)="currentWatchlist.set(null)" title="Clear watchlist filter">✕</button>
    </div>

    <!-- Error Banner -->
    <app-error-banner
      *ngIf="searchError()"
      [severity]="'error'"
      [title]="'Search failed'"
      [message]="searchError()!"
      [retryable]="true"
      [suggestions]="['Check your internet connection', 'Try a simpler search query', 'The backend server may be restarting']"
      (retry)="run()"
      (dismiss)="searchError.set(null)">
    </app-error-banner>

    <!-- Loading Skeleton (classic single-agent pipeline) -->
    <app-loading-skeleton
      *ngIf="orchMode() === 'classic' && busy() && !answer() && !sources().length && !searchError()"
      [variant]="searchPhase() >= 2 ? 'search' : 'phases'"
      [currentPhase]="searchPhase()"
      [phases]="['Connecting to search engines...', 'Searching property listings...', 'Scoring with PE model...', 'Fetching market data...']">
    </app-loading-skeleton>

    <!-- Multi-agent live progress (one step per specialist) -->
    <div class="ma-progress" *ngIf="orchMode() !== 'classic' && nsNetwork() && ((busy() && !answerComplete()) || nsReplaying())">
      <div class="ma-step" *ngFor="let s of maSpecialistSteps()"
           [class.ma-active]="s.status === 'active'"
           [class.ma-done]="s.status === 'done'">
        <span class="ma-dot">
          <span *ngIf="s.status === 'done'">✓</span>
          <span *ngIf="s.status === 'active'" class="ma-spin"></span>
        </span>
        <span class="ma-label">{{ s.label }}</span>
        <span class="ma-tools">
          <span class="ma-tool-chip ma-tool-clickable" *ngFor="let t of s.tools" [class.ma-tool-running]="t.running"
                (click)="openToolInfo(t.id, s.label, t.count, t.ms)" title="Click for tool details">
            🔧 {{ t.label }}<em *ngIf="t.count > 1"> ×{{ t.count }}</em><i *ngIf="t.ms"> · {{ (t.ms / 1000).toFixed(1) }}s</i>
          </span>
        </span>
      </div>
      <div class="ma-activity" *ngIf="lastActivity()">{{ lastActivity() }}</div>
    </div>

    <!-- Tool detail popup -->
    <div class="tool-modal-backdrop" *ngIf="toolInfo()" (click)="toolInfo.set(null)">
      <div class="tool-modal" (click)="$event.stopPropagation()">
        <div class="tool-modal-head">
          <span class="tool-modal-icon">🔧</span>
          <div>
            <h3>{{ toolInfo()!.label }}</h3>
            <div class="tool-modal-meta">
              <span class="tool-cat">{{ toolInfo()!.category }}</span>
              <span *ngIf="toolInfo()!.agent">used by {{ toolInfo()!.agent }}</span>
              <span *ngIf="toolInfo()!.count">called {{ toolInfo()!.count }}×</span>
              <span *ngIf="toolInfo()!.ms">{{ ((toolInfo()!.ms || 0) / 1000).toFixed(1) }}s last run</span>
            </div>
          </div>
          <button class="tool-modal-close" (click)="toolInfo.set(null)">✕</button>
        </div>
        <p class="tool-modal-desc">{{ toolInfo()!.description }}</p>
        <div *ngIf="toolInfo()!.params.length">
          <h4>Parameters</h4>
          <div class="tool-param" *ngFor="let p of toolInfo()!.params">
            <code>{{ p.name }}</code>
            <span class="tool-param-type">{{ p.type }}</span>
            <span class="tool-param-req" *ngIf="p.required">required</span>
            <div class="tool-param-desc">{{ p.description }}</div>
          </div>
        </div>
        <div class="tool-modal-foot">⚡ Executes as a zero-token API call via <code>POST /api/tools/execute</code> — no LLM in the loop.</div>
      </div>
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

      <!-- Follow-up Input -->
      <div class="followup-bar" *ngIf="answerComplete() && answer()">
        <div class="followup-inner">
          <svg class="followup-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <input #followupInput
                 class="followup-input"
                 [(ngModel)]="followupText"
                 placeholder="Ask a follow-up question about these results..."
                 (keydown.enter)="sendFollowup()"
                 [disabled]="busy()" />
          <button class="followup-btn" (click)="sendFollowup()" [disabled]="busy() || !followupText.trim()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div class="followup-suggestions">
          <button class="suggestion-chip" (click)="followupText = 'Run a DCF analysis on the top deal'; sendFollowup()" [disabled]="busy()">Run DCF on top deal</button>
          <button class="suggestion-chip" (click)="followupText = 'What is the market risk assessment?'; sendFollowup()" [disabled]="busy()">Market risk assessment</button>
          <button class="suggestion-chip" (click)="followupText = 'Find comparable properties'; sendFollowup()" [disabled]="busy()">Find comps</button>
        </div>
      </div>

      <!-- Quick Actions Toolbar -->
      <app-quick-actions
        *ngIf="answerComplete() && deals().length > 0"
        [deals]="deals()">
      </app-quick-actions>

      <!-- Macro Ticker removed - using the one in deals section to avoid duplication -->

      <!-- Sources (collapsed by default — deal cards show all data) -->
      <div class="sources-collapse-wrapper" *ngIf="sources().length && answerComplete()">
        <button class="sources-toggle-btn" (click)="sourcesExpanded.set(!sourcesExpanded())">
          <span>Sources ({{ sources().length }})</span>
          <span class="sources-caret">{{ sourcesExpanded() ? '\u25B2' : '\u25BC' }}</span>
        </button>
        <app-source-list
          *ngIf="sourcesExpanded()"
          [sources]="sources()">
        </app-source-list>
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

      <!-- Portfolio Summary Dashboard -->
      <div class="portfolio-dashboard" *ngIf="sources().length >= 2">
        <div class="portfolio-header">
          <div class="portfolio-title">
            Screening Summary
            <span class="portfolio-title-badge">AI Scored</span>
          </div>
          <span style="font-size:12px; color:#5b6b7f;">{{ sources().length }} opportunities analyzed</span>
        </div>

        <div class="portfolio-kpis">
          <div class="kpi-card">
            <div class="kpi-value">{{ sources().length }}</div>
            <div class="kpi-label">Total Deals</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value green">{{ getInvestmentGradeCount() }}</div>
            <div class="kpi-label">Investment Grade</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" [class.green]="getAvgPeScore() >= 70" [class.amber]="getAvgPeScore() >= 50 && getAvgPeScore() < 70" [class.red]="getAvgPeScore() < 50">
              {{ getAvgPeScore() }}
            </div>
            <div class="kpi-label">Avg PE Score</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" [class.green]="getAvgRisk() <= 45" [class.amber]="getAvgRisk() > 45 && getAvgRisk() <= 60" [class.red]="getAvgRisk() > 60">
              {{ getAvgRisk() }}
            </div>
            <div class="kpi-label">Avg Risk Score</div>
          </div>
        </div>

        <div class="portfolio-breakdown">
          <div class="breakdown-card">
            <div class="breakdown-title">Segment Classification</div>
            <div class="breakdown-row" *ngFor="let seg of getSegmentBreakdown()">
              <span class="breakdown-label">{{ seg.label }}</span>
              <span class="breakdown-value">{{ seg.count }} ({{ seg.pct }}%)</span>
            </div>
            <div *ngFor="let seg of getSegmentBreakdown()" style="margin-top:4px;">
              <div class="breakdown-bar">
                <div class="breakdown-fill" [class]="seg.fillClass" [style.width.%]="seg.pct"></div>
              </div>
            </div>
          </div>
          <div class="breakdown-card">
            <div class="breakdown-title">Screening Verdict</div>
            <div class="breakdown-row">
              <span class="breakdown-label">Pursue</span>
              <span class="breakdown-value" style="color:#059669;">{{ getVerdictCounts().pursue }}</span>
            </div>
            <div class="breakdown-row">
              <span class="breakdown-label">Monitor</span>
              <span class="breakdown-value" style="color:#d97706;">{{ getVerdictCounts().monitor }}</span>
            </div>
            <div class="breakdown-row">
              <span class="breakdown-label">Watchlist</span>
              <span class="breakdown-value" style="color:#6b7280;">{{ getVerdictCounts().watchlist }}</span>
            </div>
            <div class="breakdown-row">
              <span class="breakdown-label">Decline</span>
              <span class="breakdown-value" style="color:#dc2626;">{{ getVerdictCounts().decline }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Monitor -->
      <app-live-monitor
        *ngIf="answerComplete() && deals().length"
        [sources]="deals()"
        [busy]="busy()"
        (refresh)="run()">
      </app-live-monitor>

      <!-- Deal Comparison Matrix -->
      <app-deal-comparison
        *ngIf="answerComplete() && deals().length >= 2"
        [deals]="deals()">
      </app-deal-comparison>

      <!-- Location Intelligence / Mobility (analyze_traffic_patterns) -->
      <app-location-intel-panel
        *ngIf="mobilityResult()"
        [data]="mobilityResult()">
      </app-location-intel-panel>

      <!-- DCF / Pro Forma Analysis (top deal) -->
      <app-dcf-panel
        *ngIf="answerComplete() && getTopDeal()"
        [deal]="getTopDeal()">
      </app-dcf-panel>

      <!-- Sensitivity Analysis (top deal) -->
      <app-sensitivity-table
        *ngIf="answerComplete() && getTopDeal()"
        [deal]="getTopDeal()">
      </app-sensitivity-table>

      <!-- Share + Memo -->
      <div class="share-section" *ngIf="answerComplete() && answer()">
        <button class="share-btn" (click)="shareResults()">
          <span class="share-icon">🔗</span> Share Results
        </button>
        <button class="memo-btn" (click)="openMemo()">
          <span class="share-icon">📝</span> Generate IC Memo
        </button>
        <button class="memo-btn" (click)="downloadMemoPdf()">
          <span class="share-icon">📑</span> Export PDF
        </button>
        <span class="share-status" *ngIf="shareStatus()">{{ shareStatus() }}</span>
      </div>

      <!-- IC Memo Modal -->
      <div *ngIf="showMemo()" class="memo-overlay">
        <div class="memo-modal">
          <div class="memo-header">
          <div class="memo-header-brand">
            <div class="memo-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 21V7l9-4 9 4v14H3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <path d="M9 21V13h6v8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <h3 class="memo-title">Investment Committee Memorandum</h3>
              <span class="memo-subtitle">DealSense AI Platform</span>
            </div>
          </div>
            <button (click)="showMemo.set(false)" class="memo-close">×</button>
          </div>
          <pre class="memo-body">{{ memoText() }}</pre>
          <div class="memo-actions">
            <button class="memo-action-btn" (click)="copyMemo()">
              <span>📋</span> Copy
            </button>
            <button class="memo-action-btn" (click)="downloadMemo()">
              <span>📄</span> Download .txt
            </button>
            <button class="memo-action-btn memo-action-pdf" (click)="downloadMemoPdf()">
              <span>📑</span> Export PDF
            </button>
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
        <app-deal-card
          *ngFor="let d of deals(); let i = index"
          [deal]="d"
          [index]="i"
          (save)="showWatchlistSelector($event)">
        </app-deal-card>
      </div>
    </div>

    <!-- Footer -->
    <div class="site-footer">
      <span>DealSense AI Agent built by </span>
      <a href="https://www.linkedin.com/in/selvaonline/" target="_blank" rel="noopener">Selvakumar Murugesan</a>
    </div>

    <!-- Chat Panel -->
    <app-chat-panel
      [getContext]="getChatContext">
    </app-chat-panel>

    <!-- Comet Toast Notifications -->
    <app-comet-toast></app-comet-toast>

    <!-- Data Sources Panel -->
    <app-data-sources-panel></app-data-sources-panel>

    <!-- Watchlist Button -->
    <app-watchlist-button></app-watchlist-button>

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

    <!-- Toast Notifications -->
    <app-toast-container></app-toast-container>

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
    :host { color:#1f2937; background:#f5f6f8; min-height:100vh; display:block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; }
    .shell { max-width: 960px; margin: 0 auto; padding: 20px; }

    .header-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 0; margin-bottom: 8px;
      border-bottom: 2px solid #0f172a;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #38bdf8;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(15,23,42,0.3);
    }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; }
    .brand-sub { font-size: 13px; color: #64748b; font-weight: 500; display: flex; align-items: center; gap: 8px; }
    .brand-badge {
      background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
      color: #fff;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 2px 8px; border-radius: 4px; letter-spacing: 0.8px;
    }
    .header-meta {
      display: flex; align-items: center; gap: 10px;
      font-size: 12px; color: #8494a7; font-weight: 500;
    }
    .meta-dot { width: 4px; height: 4px; background: #0ea5e9; border-radius: 50%; }
    .how-it-works-link {
      background: none; border: 1px solid #334155; border-radius: 6px;
      color: #8494a7; font-size: 11px; font-weight: 500; padding: 3px 10px;
      cursor: pointer; transition: all 0.15s;
    }
    .how-it-works-link:hover { color: #e2e8f0; border-color: #0ea5e9; background: rgba(14,165,233,0.08); }
    .mcp-link { display: inline-flex; align-items: center; gap: 4px; }
    .mcp-link svg { flex-shrink: 0; }

    .site-footer {
      text-align: center;
      padding: 24px 0 16px;
      margin-top: 32px;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #94a3b8;
    }
    .site-footer a {
      color: #0ea5e9;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.15s;
    }
    .site-footer a:hover { color: #0284c7; text-decoration: underline; }

    .ask { display:flex; gap:12px; margin:20px 0; }
    input { flex:1; padding:13px 18px; background:#ffffff; border:1px solid #d0d8e4; border-radius:10px; color:#0f172a; font-size:15px; font-weight: 500; }
    input::placeholder { color: #94a3b8; opacity: 1; font-weight: 400; }
    input:focus { outline:none; border-color:#0ea5e9; box-shadow:0 0 0 3px rgba(14,165,233,0.12); }
    button { padding:13px 28px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600; font-size:15px; letter-spacing: 0.2px; transition: all 0.2s; }
    button:hover:not(:disabled) { background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); }
    button:disabled { opacity:0.5; cursor:not-allowed; }

    /* Capabilities Bar */
    .capabilities-bar {
      display: flex; gap: 8px; margin: 0 0 16px 0;
      padding: 14px 0;
      overflow-x: auto;
    }
    .cap-item {
      display: flex; align-items: center; gap: 10px;
      background: #fff; border: 1px solid #e2e8f0;
      border-radius: 10px; padding: 10px 14px;
      flex: 1; min-width: 150px;
      transition: all 0.2s;
    }
    .cap-item:hover { border-color: #0ea5e9; box-shadow: 0 2px 8px rgba(14,165,233,0.1); }
    .cap-icon {
      width: 34px; height: 34px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .cap-icon-ai { background: rgba(99,102,241,0.1); color: #6366f1; }
    .cap-icon-browser { background: rgba(14,165,233,0.1); color: #0ea5e9; }
    .cap-icon-data { background: rgba(16,185,129,0.1); color: #10b981; }
    .cap-icon-score { background: rgba(245,158,11,0.1); color: #f59e0b; }
    .cap-icon-risk { background: rgba(239,68,68,0.1); color: #ef4444; }
    .cap-icon-mobility { background: rgba(13,148,136,0.1); color: #0d9488; }
    .mobility-enhanced-badge {
      font-size: 11px; font-weight: 700;
      background: #0d9488; color: #fff;
      padding: 3px 10px; border-radius: 12px;
      white-space: nowrap;
    }
    .cap-text { display: flex; flex-direction: column; }
    .cap-title { font-size: 12px; font-weight: 700; color: #0f172a; }
    .cap-desc { font-size: 11px; color: #94a3b8; font-weight: 500; }

    .new-search-btn {
      background:#10b981;
      color: #fff;
      display:flex;
      align-items:center;
      gap:8px;
      padding:13px 22px;
      transition: all 0.2s ease;
    }
    .new-search-btn:hover:not(:disabled) { background:#059669; transform: translateY(-1px); }
    .new-search-icon { font-size:16px; }

    /* Watchlist Context Banner */
    .watchlist-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1px solid #10b981;
      border-radius: 8px;
      margin: 16px 0;
      animation: slideDown 0.3s ease-out;
    }
    .watchlist-icon {
      font-size: 18px;
    }
    .watchlist-label {
      flex: 1;
      color: #065f46;
      font-size: 14px;
    }
    .watchlist-label strong {
      color: #047857;
      font-weight: 600;
    }
    .clear-watchlist-btn {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .clear-watchlist-btn:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #374151;
    }
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Perplexity-style sections */
    .perplexity-section { margin-top: 24px; }
    
    .thinking-steps {
      margin-bottom: 20px;
      padding: 14px 16px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .thinking-item {
      margin-bottom: 8px;
      animation: fadeIn 0.3s ease-in;
    }
    .thinking-item:last-child { margin-bottom: 0; }
    .thinking-text {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .thinking-content {
      color: #475569;
      font-size: 13px;
      font-weight: 500;
      padding: 4px 0;
      letter-spacing: 0.1px;
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
    .answer-text h1, .answer-text h2, .answer-text h3 { color: #111827; margin: 16px 0 8px; }
    .answer-text h2 { font-size: 18px; }
    .answer-text h3 { font-size: 16px; }
    .answer-text strong { color: #111827; }
    .answer-text ul, .answer-text ol { padding-left: 20px; margin: 8px 0; }
    .answer-text li { margin-bottom: 4px; }
    .answer-text p { margin: 8px 0; }
    .answer-text p:first-child { margin-top: 0; }
    .answer-text p:last-child { margin-bottom: 0; }
    /* ensure card separators and clickable info icon */
    .answer-text .deal-card { border-bottom: 1px solid #e2e8f0; }
    .answer-text .deal-card:last-child { border-bottom: 0; }
    .answer-text #pe-model-info-icon { cursor: pointer; }

    /* Follow-up Input Bar */
    .followup-bar {
      margin-top: 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
    }
    .followup-inner {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .followup-icon {
      color: #94a3b8;
      flex-shrink: 0;
    }
    .followup-input {
      flex: 1;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
      color: #1f2937;
      transition: border-color 0.15s;
    }
    .followup-input:focus {
      outline: none;
      border-color: #0ea5e9;
      box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
    }
    .followup-input::placeholder { color: #94a3b8; }
    .followup-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      flex-shrink: 0;
      padding: 0;
      transition: opacity 0.15s;
    }
    .followup-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .followup-btn:hover:not(:disabled) { opacity: 0.85; }
    .followup-suggestions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .suggestion-chip {
      padding: 6px 14px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .suggestion-chip:hover:not(:disabled) { background: #e2e8f0; border-color: #cbd5e1; color: #1e293b; }
    .suggestion-chip:disabled { opacity: 0.5; cursor: not-allowed; }
    
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
      background: #1e3a5f;
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
    .share-btn:hover { background: #0f172a; }
    .share-icon { font-size: 16px; }
    .share-status {
      color: #5fc88f;
      font-size: 13px;
      animation: fadeOut 2s ease-out forwards;
    }
    .memo-btn { background: #0f172a; border:none; color:#fff; padding: 10px 16px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:14px; transition: background 0.2s; }
    .memo-btn:hover { background: #1e3a5f; }

    /* IC Memo Modal */
    .memo-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.7); display: flex; align-items: center;
      justify-content: center; z-index: 999999;
      backdrop-filter: blur(4px);
    }
    .memo-modal {
      background: #fff; border-radius: 16px; max-width: 760px; width: 94%;
      position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      color: #1f2937; max-height: 85vh; display: flex; flex-direction: column;
      overflow: hidden;
    }
    .memo-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px; border-bottom: 2px solid #0f172a;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
    }
    .memo-header-brand { display: flex; align-items: center; gap: 14px; }
    .memo-logo {
      width: 38px; height: 38px; background: rgba(14,165,233,0.15); color: #38bdf8;
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
    }
    .memo-title { margin: 0; font-size: 18px; color: #fff; font-weight: 700; }
    .memo-subtitle { font-size: 12px; color: #38bdf8; font-weight: 500; letter-spacing: 0.5px; }
    .memo-close {
      background: rgba(255,255,255,0.15); border: none; font-size: 20px;
      cursor: pointer; color: #fff; width: 32px; height: 32px;
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .memo-close:hover { background: rgba(255,255,255,0.25); }
    .memo-body {
      white-space: pre-wrap; background: #f8f9fb; padding: 20px 24px;
      font-size: 13.5px; line-height: 1.7; color: #1a2332;
      flex: 1; overflow-y: auto; margin: 0;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }
    .memo-actions {
      display: flex; gap: 10px; padding: 16px 24px;
      border-top: 1px solid #e5e7eb; background: #fff;
    }
    .memo-action-btn {
      background: #f3f4f6; border: 1px solid #d1d5db; color: #374151;
      padding: 10px 18px; border-radius: 8px; cursor: pointer;
      display: flex; align-items: center; gap: 8px; font-size: 13px;
      font-weight: 600; transition: all 0.2s;
    }
    .memo-action-btn:hover { background: #e5e7eb; }
    .memo-action-pdf {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; border-color: #0f172a;
      margin-left: auto;
    }
    .memo-action-pdf:hover { background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); }

    /* Portfolio Summary Dashboard */
    .portfolio-dashboard {
      background: #fff; border-radius: 14px; padding: 24px;
      margin: 20px 0; border: 1px solid #e2e6ed;
      box-shadow: 0 2px 8px rgba(12,35,64,0.06);
    }
    .portfolio-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px; padding-bottom: 14px;
      border-bottom: 2px solid #0f172a;
    }
    .portfolio-title {
      font-size: 17px; font-weight: 700; color: #0f172a;
      display: flex; align-items: center; gap: 10px;
    }
    .portfolio-title-badge {
      background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
      color: #fff; font-size: 10px;
      font-weight: 700; text-transform: uppercase; padding: 3px 10px;
      border-radius: 4px; letter-spacing: 0.8px;
    }
    .portfolio-kpis {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: linear-gradient(135deg, #f8f9fb 0%, #f0f2f5 100%);
      border-radius: 10px; padding: 16px; text-align: center;
      border: 1px solid #e2e6ed;
    }
    .kpi-value {
      font-size: 26px; font-weight: 800; color: #0f172a;
      line-height: 1.1;
    }
    .kpi-value.green { color: #059669; }
    .kpi-value.amber { color: #d97706; }
    .kpi-value.red { color: #dc2626; }
    .kpi-label {
      font-size: 11px; color: #5b6b7f; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.8px; margin-top: 6px;
    }
    .portfolio-breakdown {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    }
    .breakdown-card {
      background: #f8f9fb; border-radius: 10px; padding: 16px;
      border: 1px solid #e2e6ed;
    }
    .breakdown-title {
      font-size: 13px; font-weight: 700; color: #0f172a;
      margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .breakdown-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 0; border-bottom: 1px solid #eef0f3;
    }
    .breakdown-row:last-child { border-bottom: none; }
    .breakdown-label { font-size: 13px; color: #374151; }
    .breakdown-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .breakdown-bar {
      height: 6px; background: #e5e7eb; border-radius: 3px;
      margin-top: 4px; overflow: hidden;
    }
    .breakdown-fill {
      height: 100%; border-radius: 3px;
      transition: width 0.6s ease-out;
    }
    .fill-core { background: #0f172a; }
    .fill-coreplus { background: #0ea5e9; }
    .fill-valueadd { background: #f59e0b; }
    .fill-opp { background: #ef4444; }

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

    .sources-collapse-wrapper {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 12px; padding: 12px 18px; margin-bottom: 16px;
    }
    .sources-toggle-btn {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; background: none; border: none; cursor: pointer;
      font-size: 14px; font-weight: 600; color: #475569; padding: 0;
    }
    .sources-toggle-btn:hover { color: #1a2332; }
    .sources-caret { font-size: 10px; color: #94a3b8; }
    
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
    
    /* ── Responsive: Tablet ── */
    @media (max-width: 768px) {
      .shell { padding: 12px; }

      .header-bar {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 0;
      }
      .header-meta {
        flex-wrap: wrap;
        gap: 6px;
        font-size: 11px;
      }
      .brand-name { font-size: 18px; }
      .brand-sub { font-size: 12px; }
      .brand-logo { width: 36px; height: 36px; }
      .brand-logo svg { width: 20px; height: 20px; }

      .ask {
        flex-direction: column;
        gap: 8px;
        margin: 12px 0;
      }
      .ask input { font-size: 14px; padding: 12px 14px; }
      .ask button { width: 100%; padding: 12px; font-size: 14px; }
      .new-search-btn { width: 100%; justify-content: center; }

      .capabilities-bar {
        gap: 6px;
        padding: 10px 0;
        -webkit-overflow-scrolling: touch;
      }
      .cap-item {
        min-width: 130px;
        padding: 8px 10px;
        flex: 0 0 auto;
      }
      .cap-icon { width: 28px; height: 28px; }
      .cap-title { font-size: 11px; }
      .cap-desc { font-size: 10px; }

      .deals-grid { grid-template-columns: 1fr; }
      .deals-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .answer-section { padding: 16px; border-radius: 12px; }
      .answer-text { font-size: 14px; }

      .followup-bar { padding: 12px; }
      .followup-input { font-size: 13px; padding: 8px 12px; }
      .followup-suggestions { gap: 6px; }
      .suggestion-chip { font-size: 11px; padding: 5px 10px; }

      .sources-section { padding: 16px; }
      .source-snippet { padding-left: 0; }

      .thinking-steps { padding: 8px; }

      .agent-navigation { padding: 10px; }
      .nav-step { padding: 8px; }

      .property-data { grid-template-columns: 1fr; }

      .watchlist-banner { flex-direction: column; align-items: flex-start; gap: 8px; padding: 10px 12px; }
    }

    /* ── Responsive: Mobile ── */
    @media (max-width: 480px) {
      .shell { padding: 8px; }

      .header-bar { padding: 8px 0; margin-bottom: 4px; }
      .brand { gap: 10px; }
      .brand-name { font-size: 16px; }
      .brand-sub { font-size: 11px; gap: 4px; }
      .brand-badge { font-size: 9px; padding: 1px 6px; }
      .brand-logo { width: 32px; height: 32px; border-radius: 8px; }
      .brand-logo svg { width: 18px; height: 18px; }

      .header-meta .meta-item { display: none; }
      .header-meta .meta-dot { display: none; }
      .header-meta .how-it-works-link { display: inline-flex; }

      .ask input { font-size: 13px; padding: 10px 12px; }
      .ask button { font-size: 13px; padding: 10px; }

      .capabilities-bar { display: none; }

      .answer-section { padding: 12px; margin-top: 16px; }
      .answer-text { font-size: 13px; line-height: 1.5; }

      .sources-section { padding: 12px; }
      .source-title { font-size: 15px; }
      .source-header { gap: 8px; }
      .source-num { padding: 3px 8px; font-size: 12px; min-width: 28px; }

      .timeline-summary { font-size: 13px; padding: 6px 10px; }
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

    /* Mobile overrides for server-rendered deal card HTML inside .answer-text */
    @media (max-width: 768px) {
      :host ::ng-deep .answer-text .deal-card {
        padding: 12px !important;
      }
      :host ::ng-deep .answer-text .deal-header {
        flex-direction: column !important;
        gap: 6px !important;
      }
      :host ::ng-deep .answer-text .deal-stats {
        flex-wrap: wrap !important;
        gap: 6px !important;
      }
      :host ::ng-deep .answer-text .deal-stats .stat {
        font-size: 12px !important;
        padding: 4px 8px !important;
      }
      :host ::ng-deep .answer-text table {
        font-size: 12px !important;
        display: block !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }
      :host ::ng-deep .popup-content {
        padding: 20px !important;
        width: 95% !important;
      }
    }
  `]
})
export class App implements AfterViewInit, AfterViewChecked {
  q = signal('');
  busy = signal(false);
  cards = signal<Card[]>([]);
  deals = signal<any[]>([]);
  sources = signal<Source[]>([]);
  sourcesExpanded = signal(false);
  answer = signal<string>('');
  answerComplete = signal(false);
  shareStatus = signal<string>('');
  searchError = signal<string | null>(null);
  searchPhase = signal(0);
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
  currentWatchlist = signal<{id: string; label: string} | null>(null);
  // Agent reasoning state
  // ── Multi-agent orchestration mode: classic | neurosan | langgraph ──────
  // Defaults to Neuro SAN multi-agent orchestration for fresh sessions.
  orchMode = signal<'classic' | 'neurosan' | 'langgraph'>(
    (['classic', 'neurosan', 'langgraph'].includes(localStorage.getItem('dealsense-orchestrator') || '')
      ? localStorage.getItem('dealsense-orchestrator') as any
      : 'neurosan')
  );
  nsNetwork = signal<NsNetwork | null>(null);
  nsActiveChain = signal<string[]>([]);
  nsVisited = signal<string[]>([]);
  nsNodeCalls = signal<Record<string, number>>({});
  nsToolMs = signal<Record<string, number>>({});
  lastActivity = signal('');
  toolInfo = signal<{
    label: string; category: string; description: string; agent?: string;
    count?: number; ms?: number;
    params: Array<{ name: string; type: string; required: boolean; description: string }>;
  } | null>(null);
  private toolRegistryCache: Record<string, any> | null = null;

  async openToolInfo(toolId: string, agentLabel?: string, count?: number, ms?: number) {
    if (!this.toolRegistryCache) {
      try {
        const tools = await this.svc.getToolRegistry();
        this.toolRegistryCache = Object.fromEntries(tools.map(t => [t.name, t]));
      } catch { this.toolRegistryCache = {}; }
    }
    const reg = this.toolRegistryCache[toolId];
    const pretty = toolId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const props = reg?.parameters?.properties || {};
    const required: string[] = reg?.parameters?.required || [];
    this.toolInfo.set({
      label: pretty,
      category: reg?.category || 'tool',
      description: reg?.description || 'No description available.',
      agent: agentLabel,
      count, ms,
      params: Object.entries<any>(props).map(([name, p]) => ({
        name, type: p.type || 'any', required: required.includes(name), description: p.description || '',
      })),
    });
  }
  nsReplaying = signal(false);
  private nsReplayLog: Array<{ kind: 'hop' | 'think'; chain?: string[]; target?: string; text?: string }> = [];

  /** Re-animate the last multi-agent run through the network panel + stepper. */
  replayOrchestration() {
    if (this.busy() || this.nsReplaying() || !this.nsReplayLog.length) return;
    const log = [...this.nsReplayLog];
    this.nsReplaying.set(true);
    this.nsActiveChain.set([]);
    this.nsVisited.set([]);
    this.nsNodeCalls.set({});
    this.lastActivity.set('');
    let i = 0;
    const tick = () => {
      if (i >= log.length) {
        this.nsActiveChain.set([]);
        this.nsReplaying.set(false);
        return;
      }
      const e = log[i++];
      if (e.kind === 'hop') {
        const chain = e.chain || [];
        this.nsActiveChain.set(chain);
        this.nsVisited.update(v => Array.from(new Set([...v, ...chain])));
        if (e.target && e.target !== 'deal_advisor') {
          this.nsNodeCalls.update(m => ({ ...m, [e.target!]: (m[e.target!] || 0) + 1 }));
        }
      } else if (e.text) {
        this.lastActivity.set(e.text);
      }
      setTimeout(tick, e.kind === 'hop' ? 700 : 350);
    };
    tick();
  }

  // ── Search history (persisted) ──────────────────────────────────────────
  searchHistory = signal<string[]>(
    (() => { try { return JSON.parse(localStorage.getItem('dealsense-search-history') || '[]'); } catch { return []; } })()
  );

  private rememberSearch(q: string) {
    const next = [q, ...this.searchHistory().filter(x => x !== q)].slice(0, 10);
    this.searchHistory.set(next);
    localStorage.setItem('dealsense-search-history', JSON.stringify(next));
  }

  runFromHistory(q: string) {
    this.q.set(q);
    this.stopTyping();
    this.run();
  }

  clearHistory() {
    this.searchHistory.set([]);
    localStorage.removeItem('dealsense-search-history');
  }

  /** Live per-specialist progress for the multi-agent stepper. */
  maSpecialistSteps(): Array<{
    id: string; label: string; status: 'pending' | 'active' | 'done';
    tools: Array<{ id: string; label: string; count: number; running: boolean; ms: number }>;
  }> {
    const net = this.nsNetwork();
    if (!net) return [];
    const active = this.nsActiveChain();
    const visited = this.nsVisited();
    const calls = this.nsNodeCalls();
    const pretty = (id: string) => id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return net.nodes.filter(n => n.type === 'specialist').map(s => ({
      id: s.id,
      label: pretty(s.id),
      status: active.includes(s.id) ? 'active' as const : visited.includes(s.id) ? 'done' as const : 'pending' as const,
      tools: net.nodes
        .filter(n => n.type === 'tool' && n.parent === s.id && (calls[n.id] || 0) > 0)
        .map(t => ({
          id: t.id,
          label: pretty(t.id),
          count: calls[t.id] || 0,
          running: active[active.length - 1] === t.id,
          ms: this.nsToolMs()[t.id] || 0,
        })),
    }));
  }

  orchLabel() {
    return this.orchMode() === 'langgraph' ? 'LangGraph.js'
         : this.orchMode() === 'neurosan' ? 'Neuro SAN' : 'Classic';
  }

  /** If the selected orchestrator isn't reachable (e.g. Neuro SAN server not
   * deployed), fall back gracefully: other orchestrator -> classic. The
   * user's stored preference is not overwritten. */
  private async verifyOrchestratorAvailable() {
    const mode = this.orchMode();
    if (mode === 'classic') return;
    const base = (localStorage.getItem('apiUrl') || environment.apiUrl || '').replace(/\/$/, '');
    const healthy = async (o: 'ns' | 'lg') => {
      try { return (await (await fetch(`${base}/api/${o}/health`)).json()).ok === true; } catch { return false; }
    };
    const orch = mode === 'langgraph' ? 'lg' as const : 'ns' as const;
    if (await healthy(orch)) return;
    const other = orch === 'ns' ? 'lg' as const : 'ns' as const;
    const next = (await healthy(other)) ? (other === 'lg' ? 'langgraph' : 'neurosan') : 'classic';
    console.warn(`[orchestrator] ${mode} unavailable, falling back to ${next}`);
    this.orchMode.set(next as any);
  }

  /** MkDocs site, served by the orchestrator at /docs (same-origin in prod). */
  docsUrl() {
    const base = (localStorage.getItem('apiUrl') || environment.apiUrl || '').replace(/\/$/, '');
    return `${base}/docs/`;
  }

  agentSteps = signal<AgentStepUI[]>([]);
  // Mobility Intelligence (analyze_traffic_patterns)
  mobilityResult = signal<MobilityResult | null>(null);
  mobilityEnhanced = signal(false);
  agentHops = signal(0);
  isAgentRunning = signal(false);
  showHowItWorks = signal(false);
  showWhyDealsense = signal(false);
  showMcpInfo = signal(false);
  showOrgSettings = signal(false);
  followupText = '';
  private typingInterval: any = null;
  private isTypingActive = true;
  private currentExampleIndex = 0;
  private peModelInfoListenerAttached = false;
  private charts = new Map<string, Chart>();

  private exampleQueries: string[] = [];
  private allPrompts: string[] = [];

  constructor(private svc: AgentService, private el: ElementRef, private cdr: ChangeDetectorRef, private zone: NgZone, private toast: ToastService) {
    this.verifyOrchestratorAvailable();
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

    // Listen for watchlist click events
    window.addEventListener('run-watchlist-query', ((e: CustomEvent) => {
      this.zone.run(() => {
        const { query, label, id } = e.detail;
        console.log('[app] Running watchlist query:', label, query);
        
        // Store current watchlist info
        this.currentWatchlist.set({ id, label });
        
        // Set the query and run the search
        this.q.set(query);
        this.stopTyping();
        this.run();
      });
    }) as EventListener);
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
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.5,
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
    // Clear the placeholder cursor when stopping
    const currentPlaceholder = this.typingPlaceholder();
    if (currentPlaceholder.endsWith('|')) {
      this.typingPlaceholder.set(currentPlaceholder.slice(0, -1));
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
          title: 'DealSense Agent - Investment Opportunities',
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
    lines.push(`DealSense AI — Investment Committee Memorandum`);
    lines.push(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push(`Classification: Confidential | AI-Powered Analysis`);
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
    lines.push(`Generated by DealSense AI | CRE Intelligence Platform`);
    lines.push(`Scores powered by PE Model + FRED/BLS macro data + AI analysis.`);
    
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

  // ===== Portfolio Dashboard Helpers =====
  getTopDeal(): any {
    const d = this.deals();
    if (!d.length) return null;
    return d.slice().sort((a: any, b: any) =>
      (b.score ?? b.underwrite?.peScore ?? 0) - (a.score ?? a.underwrite?.peScore ?? 0)
    )[0] || null;
  }

  getInvestmentGradeCount(): number {
    return this.sources().filter((s: any) => (s.score ?? 0) >= 70).length;
  }

  getAvgPeScore(): number {
    const s = this.sources().filter((src: any) => src.score != null);
    if (!s.length) return 0;
    return Math.round(s.reduce((sum: number, src: any) => sum + (src.score ?? 0), 0) / s.length);
  }

  getAvgRisk(): number {
    const s = this.sources().filter((src: any) => src.riskScore != null);
    if (!s.length) return 50;
    return Math.round(s.reduce((sum: number, src: any) => sum + (src.riskScore ?? 50), 0) / s.length);
  }

  getSegmentBreakdown(): { label: string; count: number; pct: number; fillClass: string }[] {
    const all = this.sources();
    if (!all.length) return [];
    const segments = { 'Core': 0, 'Core+': 0, 'Value-Add': 0, 'Opportunistic': 0 };
    all.forEach((s: any) => {
      const seg = this.computeSegment(s.score, s.riskScore);
      if (seg === 'Core') segments['Core']++;
      else if (seg === 'Core+') segments['Core+']++;
      else if (seg === 'Value-add') segments['Value-Add']++;
      else segments['Opportunistic']++;
    });
    const fills: Record<string, string> = { 'Core': 'fill-core', 'Core+': 'fill-coreplus', 'Value-Add': 'fill-valueadd', 'Opportunistic': 'fill-opp' };
    return Object.entries(segments)
      .filter(([, count]) => count > 0)
      .map(([label, count]) => ({
        label, count,
        pct: Math.round((count / all.length) * 100),
        fillClass: fills[label] || 'fill-opp',
      }));
  }

  getVerdictCounts(): { pursue: number; monitor: number; watchlist: number; decline: number } {
    const result = { pursue: 0, monitor: 0, watchlist: 0, decline: 0 };
    this.sources().forEach((s: any) => {
      const pe = s.score ?? 0;
      const risk = s.riskScore ?? 100;
      if (pe >= 80 && risk <= 45) result.pursue++;
      else if (pe >= 70 && risk <= 55) result.monitor++;
      else if (pe >= 60 && risk <= 65) result.watchlist++;
      else result.decline++;
    });
    return result;
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

  async downloadMemoPdf() {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 20;

    const addPage = () => { doc.addPage(); y = 20; drawFooter(); };
    const checkPage = (needed: number) => { if (y + needed > pageH - 25) addPage(); };

    const drawFooter = () => {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('DealSense AI | CRE Intelligence Platform | Confidential', pageW / 2, pageH - 10, { align: 'center' });
    };

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 32, 'F');

    doc.setFillColor(14, 165, 233);
    doc.rect(0, 32, pageW, 2, 'F');

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INVESTMENT COMMITTEE MEMORANDUM', pageW / 2, 16, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('DealSense AI | CRE Intelligence Platform', pageW / 2, 24, { align: 'center' });

    y = 42;
    doc.setTextColor(30, 30, 30);

    const text = this.memoText();
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('───')) continue;

      if (trimmed.endsWith(':') && !trimmed.startsWith('-') && !trimmed.startsWith('•')) {
        checkPage(12);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(trimmed, margin, y);
        y += 3;
        doc.setDrawColor(14, 165, 233);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + contentW * 0.4, y);
        y += 6;
        continue;
      }

      if (trimmed.startsWith('IC Memo')) {
        checkPage(10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(trimmed, margin, y);
        y += 7;
        continue;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        checkPage(8);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        const bulletText = trimmed.replace(/^[-•]\s*/, '');
        const wrapped = doc.splitTextToSize(`  •  ${bulletText}`, contentW - 4);
        wrapped.forEach((wl: string) => {
          checkPage(6);
          doc.text(wl, margin + 2, y);
          y += 5;
        });
        continue;
      }

      if (trimmed === '') { y += 3; continue; }

      checkPage(8);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);

      if (trimmed.includes('Pursue') || trimmed.includes('High conviction')) {
        doc.setTextColor(5, 150, 105);
        doc.setFont('helvetica', 'bold');
      } else if (trimmed.includes('Decline') || trimmed.includes('Pass')) {
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
      }

      const wrapped = doc.splitTextToSize(trimmed, contentW);
      wrapped.forEach((wl: string) => {
        checkPage(6);
        doc.text(wl, margin, y);
        y += 5;
      });
    }

    drawFooter();

    const best = this.sources().slice().sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))[0];
    const filename = best ? `IC_Memo_${best.title.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.pdf` : 'IC_Memo_DealSense.pdf';
    doc.save(filename);
    this.toast.success('PDF memo exported successfully');
  }

  newSearch() {
    // Clear ALL results and reset to fresh landing state
    this.q.set('');
    this.cards.set([]);
    this.deals.set([]);
    this.sources.set([]);
    this.sourcesExpanded.set(false);
    this.answer.set('');
    this.answerComplete.set(false);
    this.shareStatus.set('');
    this.searchError.set(null);
    this.searchPhase.set(0);
    this.progressProperties.set([]);
    this.browserPreview.set(null);
    this.showMemo.set(false);
    this.memoText.set('');
    this.portfolioChartsInitialized = false;
    this.currentWatchlist.set(null);
    this.agentSteps.set([]);
    this.agentHops.set(0);
    this.mobilityResult.set(null);
    this.mobilityEnhanced.set(false);
    this.isAgentRunning.set(false);
    this.busy.set(false);
    
    // Stop current typing animation first
    this.stopTyping();
    
    // Set clean placeholder without cursor
    this.typingPlaceholder.set('Ask a question...');
    
    // Restart typing animation with a small delay to ensure clean state
    setTimeout(() => {
      this.isTypingActive = true;
      this.startTypingAnimation();
    }, 50);
    
    // Focus on input
    setTimeout(() => {
      const input = document.querySelector('input') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  }

  async sendFollowup() {
    const text = this.followupText.trim();
    if (!text || this.busy()) return;
    this.followupText = '';
    this.busy.set(true);

    try {
      const base = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
      const res = await fetch(`${base}/chat/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: text,
          sessionId: `main-${Date.now()}`,
          context: { scored: this.deals().slice(0, 10), query: this.q() },
          orgSettings: (() => { try { const r = localStorage.getItem('dealsense-org-settings'); return r ? JSON.parse(r) : undefined; } catch { return undefined; } })(),
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const data = await res.json();

      // Append follow-up answer below existing answer
      const prev = this.answer();
      const divider = '\n\n---\n\n';
      const followupHeader = `**Follow-up: ${text}**\n\n`;
      this.answer.set(prev + divider + followupHeader + (data.content || ''));

      // Update agent steps if present
      if (data.steps?.length) {
        this.agentSteps.update(arr => [...arr, ...data.steps]);
        this.agentHops.set((this.agentHops() || 0) + (data.hops || 0));
      }
    } catch (e: any) {
      this.searchError.set(`Follow-up failed: ${e.message}`);
    } finally {
      this.busy.set(false);
    }
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
    this.rememberSearch(query);

    this.cards.set([]);
    this.deals.set([]);
    this.sources.set([]);
    this.answer.set('');
    this.answerComplete.set(false);
    this.shareStatus.set('');
    this.searchError.set(null);
    this.searchPhase.set(0);
    this.progressProperties.set([]);
    this.browserPreview.set(null);
    this.portfolioChartsInitialized = false;
    this.agentSteps.set([]);
    this.agentHops.set(0);
    this.mobilityResult.set(null);
    this.mobilityEnhanced.set(false);
    this.isAgentRunning.set(true);
    this.busy.set(true);
    try {
      // Read enabled data sources from localStorage
      let dataSources: { enabledDomains: string[]; apiKeys: Record<string, string> } | undefined;
      try {
        const saved = localStorage.getItem('dealsense-data-sources');
        if (saved) {
          const toggles = JSON.parse(saved) as { id: string; enabled: boolean }[];
          const enabledDomains = toggles.filter(t => t.enabled).map(t => t.id);
          const savedKeys = localStorage.getItem('dealsense-api-keys');
          const keyList = savedKeys ? JSON.parse(savedKeys) as { id: string; apiKey: string }[] : [];
          const apiKeys: Record<string, string> = {};
          for (const k of keyList) { if (k.apiKey) apiKeys[k.id] = k.apiKey; }
          dataSources = { enabledDomains, apiKeys };
        }
      } catch {}
      // Read org settings from localStorage
      let orgSettings: any;
      try {
        const raw = localStorage.getItem('dealsense-org-settings');
        if (raw) orgSettings = JSON.parse(raw);
      } catch {}
      let runId: string;
      const mode = this.orchMode();
      if (mode !== 'classic') {
        // Multi-agent orchestration path (Neuro SAN or LangGraph.js)
        const orch = mode === 'langgraph' ? 'lg' as const : 'ns' as const;
        this.nsActiveChain.set([]);
        this.nsVisited.set([]);
        this.nsNodeCalls.set({});
        this.nsToolMs.set({});
        this.nsReplayLog = [];
        try { this.nsNetwork.set(await this.svc.getOrchestratorNetwork(orch) as NsNetwork); } catch {}
        const threadId = orch === 'lg' ? (sessionStorage.getItem('dealsense-lg-thread') || undefined) : undefined;
        const started = await this.svc.startOrchestratedRun(orch, query, threadId);
        runId = started.runId;
        if (orch === 'lg' && started.threadId) sessionStorage.setItem('dealsense-lg-thread', started.threadId);
      } else {
        runId = await this.svc.startRun(query, dataSources, orgSettings);
      }
      this.searchPhase.set(1);
      this.lastActivity.set('');
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
          this.q.set(''); // Clear input so placeholder shows "Search again..."
        }
      }, 400);
    } catch (e) {
      this.busy.set(false);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.searchError.set(msg);
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
          aspectRatio: 1.5,
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
          aspectRatio: 1.5,
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
      case 'thinking': {
        push({ kind:'thinking', label: ev['text'], t:ev.t });
        this.lastActivity.set(ev['text'] || '');
        if (this.orchMode() !== 'classic') this.nsReplayLog.push({ kind: 'think', text: ev['text'] });
        const txt = (ev['text'] || '').toLowerCase();
        if (txt.includes('searching') || txt.includes('search')) this.searchPhase.set(1);
        if (txt.includes('scoring') || txt.includes('pe scoring') || txt.includes('deal quality')) this.searchPhase.set(2);
        if (txt.includes('market data') || txt.includes('treasury') || txt.includes('labor')) this.searchPhase.set(3);
        break;
      }
      case 'source_found':
        this.searchPhase.set(3);
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
      case 'run_finished':
        push({ kind:'finished', label:'Done', t:ev.t });
        this.isAgentRunning.set(false);
        if (ev['ok'] === false && !this.answer() && !this.sources().length) {
          this.searchError.set('The search could not be completed. The agent encountered an error processing your query.');
        }
        break;
      // ── New Agentic Events ──────────────────────────────────────────────
      case 'agent_step':
        this.agentSteps.update(arr => [...arr, {
          hop: ev['hop'] || 0,
          type: ev['type'] || 'thinking',
          content: ev['content'],
          toolName: ev['toolName'],
          toolArgs: ev['toolArgs'],
          toolResult: ev['toolResult'] || ev['resultSummary'],
          durationMs: ev['durationMs'],
          timestamp: ev['timestamp'] || ev.t,
        }]);
        break;
      case 'tool_executing':
        this.isAgentRunning.set(true);
        push({ kind:'thinking', label: `Running ${ev['toolName']}...`, t:ev.t });
        break;
      case 'tool_complete':
        if (ev['durationMs'] && ev['toolName']) {
          this.nsToolMs.update(m => ({ ...m, [ev['toolName']]: ev['durationMs'] }));
        }
        push({ kind:'thinking', label: `${ev['toolName']} completed (${ev['durationMs']}ms)`, t:ev.t });
        if (ev['toolName'] === 'analyze_traffic_patterns') {
          this.mobilityEnhanced.set(true);
        }
        break;
      case 'mobility_result':
        // Structured Location Intelligence payload from analyze_traffic_patterns
        this.mobilityResult.set(ev['mobility']);
        this.mobilityEnhanced.set(true);
        break;
      case 'agent_done':
        this.isAgentRunning.set(false);
        this.agentHops.set(ev['hops'] || 0);
        break;
      case 'ns_hop': {
        const chain = (ev['chain'] || []) as string[];
        this.nsActiveChain.set(chain);
        this.nsVisited.update(v => Array.from(new Set([...v, ...chain])));
        const target = ev['target'] as string;
        if (target && target !== 'deal_advisor') {
          this.nsNodeCalls.update(m => ({ ...m, [target]: (m[target] || 0) + 1 }));
        }
        this.nsReplayLog.push({ kind: 'hop', chain, target });
        this.agentHops.update(h => h + 1);
        break;
      }
    }
  }

  cycleOrchestrator() {
    const order: Array<'classic' | 'neurosan' | 'langgraph'> = ['classic', 'neurosan', 'langgraph'];
    const next = order[(order.indexOf(this.orchMode()) + 1) % order.length];
    this.orchMode.set(next);
    localStorage.setItem('dealsense-orchestrator', next);
    if (next !== 'classic') {
      this.svc.getOrchestratorNetwork(next === 'langgraph' ? 'lg' : 'ns')
        .then(n => this.nsNetwork.set(n as NsNetwork))
        .catch(() => this.nsNetwork.set(null));
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
        this.toast.warning('Request timed out loading watchlists');
      } else {
        this.toast.error('Failed to load watchlists. Check if backend is running.');
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
        this.toast.warning('Please enter a name for the new watchlist');
        return;
      }
      if (!this.newWatchlistQuery.trim()) {
        this.toast.warning('Please enter a search query for the new watchlist');
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
          this.toast.warning('A watchlist with this name already exists. Choose a different name.');
          return;
        } else if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const newWatchlist = await response.json();
        console.log('[watchlist] ✅ Watchlist created successfully:', newWatchlist);
        
        // Add to available watchlists
        this.availableWatchlists.update(lists => [...lists, newWatchlist]);
        
        // Notify watchlist button to refresh
        window.dispatchEvent(new CustomEvent('watchlist-created', { detail: newWatchlist }));
        
      } catch (err: any) {
        console.error('[watchlist] Failed to create watchlist:', err);
        this.toast.error('Failed to create watchlist. Check console for details.');
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
        this.toast.info('This property is already in this watchlist');
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      } else {
        console.log('[watchlist] ✅ Property saved successfully');
        this.showWatchlistModal.set(false);
        this.selectedWatchlistId.set(null); // Reset selection
        
        // Show success toast
        const watchlist = this.availableWatchlists().find((w: any) => w.id === watchlistId);
        this.toast.success(`Saved to "${watchlist?.label || watchlistId}"`);
      }
    } catch (err: any) {
      console.error('[watchlist] Failed to save:', err);
      if (err.name === 'AbortError') {
        this.toast.warning('Request timed out. Please check if the backend is running.');
      } else {
        this.toast.error(`Failed to save property: ${err.message || 'Unknown error'}`);
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
    this.toast.info('Cmd+K: Search  |  Cmd+/: Chat  |  Esc: Close modals  |  Shift+?: Help', 6000);
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
    this.showOrgSettings.set(false);
    console.log('⌨️ Esc: Closed modals');
  }

  onOrgSettingsChanged(settings: any) {
    // Store settings and pass to backend on next request
    try {
      localStorage.setItem('dealsense-org-settings', JSON.stringify(settings));
      this.toast.show('Organization settings applied', 'success');
    } catch (e) {
      console.error('[app] Failed to save org settings:', e);
    }
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
