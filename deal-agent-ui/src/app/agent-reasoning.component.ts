// agent-reasoning.component.ts — Collapsible reasoning chain UI for the agentic loop
import { Component, Input, signal, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

export interface AgentStepUI {
  hop: number;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'final_answer';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  durationMs?: number;
  timestamp: number;
}

@Pipe({ name: 'mdRender', standalone: true })
export class MdRenderPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(value: string | undefined): SafeHtml {
    if (!value) return '';
    const html = marked.parse(value, { async: false, breaks: true }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

@Component({
  selector: 'app-agent-reasoning',
  standalone: true,
  imports: [CommonModule, MdRenderPipe],
  template: `
    <div class="reasoning-panel" *ngIf="steps.length > 0" [class.running]="isRunning">
      <!-- Header -->
      <button class="reasoning-header" (click)="expanded.set(!expanded())">
        <div class="header-left">
          <svg class="brain-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/>
            <path d="M9 21h6M10 17v4M14 17v4"/>
          </svg>
          <span class="header-title">Agent Reasoning</span>
          <span class="step-badge">{{ steps.length }} steps</span>
          <span class="hop-badge" *ngIf="hops > 0">{{ hops }} hops</span>
          <span class="running-dot" *ngIf="isRunning"></span>
        </div>
        <svg class="chevron" [class.rotated]="expanded()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      <!-- Steps -->
      <div class="reasoning-steps" *ngIf="expanded()">
        <div *ngFor="let step of steps; let i = index"
             class="step-item"
             [ngClass]="'step-' + step.type">

          <!-- Thinking -->
          <ng-container *ngIf="step.type === 'thinking'">
            <div class="step-icon thinking-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div class="step-body">
              <div class="step-label">Thinking</div>
              <div class="step-content thinking-content"
                   [class.collapsed]="!isStepExpanded(i) && isLongContent(step.content)"
                   [innerHTML]="step.content | mdRender">
              </div>
              <button *ngIf="isLongContent(step.content)"
                      class="expand-btn"
                      (click)="toggleStep(i); $event.stopPropagation()">
                {{ isStepExpanded(i) ? 'Show less' : 'Show more' }}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     [style.transform]="isStepExpanded(i) ? 'rotate(180deg)' : 'none'">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
          </ng-container>

          <!-- Tool Call -->
          <ng-container *ngIf="step.type === 'tool_call'">
            <div class="step-icon tool-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
              </svg>
            </div>
            <div class="step-body">
              <div class="step-label">{{ formatToolName(step.toolName || '') }}</div>
              <div class="step-args" *ngIf="step.toolArgs">
                {{ formatArgs(step.toolArgs) }}
              </div>
            </div>
          </ng-container>

          <!-- Tool Result -->
          <ng-container *ngIf="step.type === 'tool_result'">
            <div class="step-icon result-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="step-body">
              <div class="step-label">
                {{ formatToolName(step.toolName || '') }}
                <span class="duration" *ngIf="step.durationMs">{{ step.durationMs }}ms</span>
              </div>
              <div class="step-content result-text">{{ step.toolResult || step.content }}</div>
            </div>
          </ng-container>

          <!-- Final Answer -->
          <ng-container *ngIf="step.type === 'final_answer'">
            <div class="step-icon answer-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="step-body">
              <div class="step-label">Final Answer</div>
              <div class="step-content" [innerHTML]="(step.content || '').slice(0, 300) | mdRender"></div>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reasoning-panel {
      margin: 12px 0;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fafafa;
      overflow: hidden;
    }
    .reasoning-panel.running {
      border-color: #a5b4fc;
      background: #fafbff;
    }

    .reasoning-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: #374151;
      transition: background 0.15s;
    }
    .reasoning-header:hover {
      background: #f3f4f6;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brain-icon {
      color: #6366f1;
    }
    .header-title {
      font-weight: 600;
    }
    .step-badge, .hop-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }
    .step-badge {
      background: #e5e7eb;
      color: #4b5563;
    }
    .hop-badge {
      background: #dbeafe;
      color: #1d4ed8;
    }
    .running-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse-dot 1.5s infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    .chevron {
      transition: transform 0.2s;
      color: #9ca3af;
    }
    .chevron.rotated {
      transform: rotate(180deg);
    }

    .reasoning-steps {
      padding: 0 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .step-item {
      display: flex;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      background: white;
      border: 1px solid #f3f4f6;
      animation: step-in 0.2s ease;
    }
    @keyframes step-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .step-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .thinking-icon {
      background: #ede9fe;
      color: #7c3aed;
    }
    .tool-icon {
      background: #fef3c7;
      color: #d97706;
    }
    .result-icon {
      background: #d1fae5;
      color: #059669;
    }
    .answer-icon {
      background: #dbeafe;
      color: #2563eb;
    }

    .step-body {
      flex: 1;
      min-width: 0;
    }
    .step-label {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .duration {
      font-size: 10px;
      font-weight: 400;
      color: #9ca3af;
      background: #f3f4f6;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .step-content {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
      margin-top: 2px;
      word-break: break-word;
    }

    /* Markdown rendered thinking content — ::ng-deep for innerHTML */
    :host ::ng-deep .thinking-content p {
      margin: 4px 0;
      font-size: 12px;
      line-height: 1.6;
      color: #4b5563;
    }
    :host ::ng-deep .thinking-content p:first-child {
      margin-top: 0;
    }
    :host ::ng-deep .thinking-content p:last-child {
      margin-bottom: 0;
    }
    :host ::ng-deep .thinking-content strong {
      color: #1f2937;
      font-weight: 600;
    }
    :host ::ng-deep .thinking-content ul,
    :host ::ng-deep .thinking-content ol {
      margin: 4px 0;
      padding-left: 20px;
      font-size: 12px;
      color: #4b5563;
    }
    :host ::ng-deep .thinking-content li {
      margin: 2px 0;
      line-height: 1.5;
    }
    :host ::ng-deep .thinking-content code {
      background: #f3f4f6;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 11px;
      color: #6366f1;
    }
    :host ::ng-deep .thinking-content h1,
    :host ::ng-deep .thinking-content h2,
    :host ::ng-deep .thinking-content h3,
    :host ::ng-deep .thinking-content h4 {
      font-size: 12px;
      font-weight: 700;
      color: #1f2937;
      margin: 8px 0 4px;
    }
    :host ::ng-deep .thinking-content h1:first-child,
    :host ::ng-deep .thinking-content h2:first-child,
    :host ::ng-deep .thinking-content h3:first-child {
      margin-top: 0;
    }

    /* Collapsible thinking */
    .thinking-content.collapsed {
      max-height: 80px;
      overflow: hidden;
      position: relative;
      mask-image: linear-gradient(to bottom, black 50px, transparent 80px);
      -webkit-mask-image: linear-gradient(to bottom, black 50px, transparent 80px);
    }

    .expand-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      padding: 2px 8px;
      background: none;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      color: #6366f1;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .expand-btn:hover {
      background: #f5f3ff;
      border-color: #c4b5fd;
    }
    .expand-btn svg {
      transition: transform 0.2s;
    }

    .step-args {
      font-size: 11px;
      color: #9ca3af;
      font-family: 'SF Mono', 'Fira Code', monospace;
      margin-top: 2px;
    }
    .result-text {
      color: #059669;
    }

    @media (max-width: 768px) {
      .reasoning-panel { margin: 8px 0; }
      .reasoning-header { padding: 8px 10px; }
      .header-title { font-size: 12px; }
      .step-badge, .hop-badge { font-size: 9px; padding: 1px 5px; }
      .reasoning-steps { padding: 8px; gap: 6px; max-height: 250px; }
      .step-item { padding: 6px 8px; gap: 6px; }
      .step-content { font-size: 11px; }
      .step-args { font-size: 10px; }
    }
  `]
})
export class AgentReasoningComponent {
  @Input() steps: AgentStepUI[] = [];
  @Input() hops = 0;
  @Input() isRunning = false;

  expanded = signal(true);
  private expandedSteps = new Set<number>();

  isLongContent(content?: string): boolean {
    return (content?.length || 0) > 200;
  }

  isStepExpanded(index: number): boolean {
    return this.expandedSteps.has(index);
  }

  toggleStep(index: number): void {
    if (this.expandedSteps.has(index)) {
      this.expandedSteps.delete(index);
    } else {
      this.expandedSteps.add(index);
    }
  }

  formatToolName(name: string): string {
    const names: Record<string, string> = {
      'search_properties': 'Search Properties',
      'score_deals': 'Score Deals',
      'assess_risk': 'Assess Risk',
      'get_macro_data': 'Macro Data',
      'analyze_property_url': 'Analyze Property',
      'run_dcf': 'DCF Analysis',
      'generate_memo': 'IC Memo',
      'comp_analysis': 'Comp Analysis',
      'filter_and_rank': 'Filter & Rank',
      'market_deep_dive': 'Market Deep Dive',
      'portfolio_review': 'Portfolio Review',
      'tenant_credit_analysis': 'Tenant Credit',
      'generate_loi': 'Generate LOI',
      'compliance_check': 'Compliance Check',
      'portfolio_var': 'VaR & Stress Test',
      'risk_decomposition': 'Risk Decomposition',
      'multi_asset_compare': 'Multi-Asset Compare',
      'institutional_pipeline': 'Deal Pipeline',
      'market_intel': 'Market Intelligence',
      'analyze_traffic_patterns': 'Analyze Real-World Activity',
    };
    return names[name] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatArgs(args: Record<string, any>): string {
    const entries = Object.entries(args).slice(0, 3);
    return entries.map(([k, v]) => {
      const val = typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v).slice(0, 60);
      return `${k}: ${val}`;
    }).join(', ');
  }
}
