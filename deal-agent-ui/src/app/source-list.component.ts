import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type Source = {
  id: number;
  title: string;
  url: string;
  snippet: string;
  score?: number;
  riskScore?: number;
};

@Component({
  selector: 'app-source-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sources-panel" *ngIf="sources.length">
      <h3 class="sources-heading">
        <span class="heading-icon">📚</span>
        Sources
        <span class="source-count">{{ sources.length }}</span>
      </h3>
      <div class="source-item" *ngFor="let src of sources; trackBy: trackBySourceId">
        <div class="source-header">
          <span class="source-num">[{{ src.id }}]</span>
          <div class="source-content">
            <a [href]="src.url" target="_blank" rel="noopener" class="source-title">{{ src.title }}</a>
            <div class="source-meta">
              <span class="source-domain">{{ getDomain(src.url) }}</span>
              <span class="source-score" *ngIf="src.score != null"
                    [ngClass]="getScoreClass(src.score)">
                PE {{ src.score }}
              </span>
              <span class="source-risk" *ngIf="src.riskScore != null"
                    [ngClass]="getRiskClass(src.riskScore)">
                Risk {{ src.riskScore }}
              </span>
            </div>
          </div>
        </div>
        <div class="source-snippet" *ngIf="src.snippet">{{ src.snippet }}</div>
      </div>
    </div>
  `,
  styles: [`
    .sources-panel { margin: 20px 0; }
    .sources-heading {
      display: flex; align-items: center; gap: 8px;
      font-size: 16px; font-weight: 600; color: #1a2332;
      margin: 0 0 12px 0;
    }
    .heading-icon { font-size: 18px; }
    .source-count {
      background: #e2e8f0; color: #475569;
      font-size: 12px; font-weight: 600;
      padding: 2px 8px; border-radius: 999px;
    }

    .source-item {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s;
    }
    .source-item:hover { background: #f8fafc; }
    .source-item:last-child { border-bottom: none; }

    .source-header { display: flex; align-items: flex-start; gap: 10px; }
    .source-num {
      font-weight: 700; color: #94a3b8; font-size: 13px;
      flex-shrink: 0; padding-top: 2px;
    }
    .source-content { flex: 1; min-width: 0; }
    .source-title {
      color: #1e40af; text-decoration: none;
      font-size: 14px; font-weight: 500;
      display: block;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .source-title:hover { text-decoration: underline; }

    .source-meta {
      display: flex; align-items: center; gap: 8px;
      margin-top: 4px; flex-wrap: wrap;
    }
    .source-domain {
      font-size: 12px; color: #94a3b8;
    }
    .source-score, .source-risk {
      font-size: 11px; font-weight: 600;
      padding: 2px 8px; border-radius: 999px;
    }
    .source-score.high { background: #d1fae5; color: #065f46; }
    .source-score.medium { background: #fef3c7; color: #92400e; }
    .source-score.low { background: #fee2e2; color: #991b1b; }
    .source-risk.low-risk { background: #d1fae5; color: #065f46; }
    .source-risk.med-risk { background: #fef3c7; color: #92400e; }
    .source-risk.high-risk { background: #fee2e2; color: #991b1b; }

    .source-snippet {
      margin-top: 6px; padding-left: 30px;
      font-size: 13px; color: #64748b; line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }
  `]
})
export class SourceListComponent {
  @Input() sources: Source[] = [];

  trackBySourceId(_: number, src: Source) { return src.id; }

  getDomain(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }

  getScoreClass(score: number): string {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  getRiskClass(risk: number): string {
    if (risk < 40) return 'low-risk';
    if (risk < 70) return 'med-risk';
    return 'high-risk';
  }
}
