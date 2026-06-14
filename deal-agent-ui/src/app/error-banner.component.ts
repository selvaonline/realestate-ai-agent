import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="error-banner" [ngClass]="severity" *ngIf="message">
      <div class="error-icon">
        {{ severity === 'error' ? '⚠️' : severity === 'warning' ? '⚡' : 'ℹ️' }}
      </div>
      <div class="error-body">
        <div class="error-title">{{ title || defaultTitle }}</div>
        <div class="error-message">{{ message }}</div>
        <div class="error-suggestions" *ngIf="suggestions.length">
          <ul>
            <li *ngFor="let s of suggestions">{{ s }}</li>
          </ul>
        </div>
      </div>
      <div class="error-actions">
        <button *ngIf="retryable" class="retry-btn" (click)="retry.emit()">
          🔄 Retry
        </button>
        <button class="dismiss-btn" (click)="dismiss.emit()">✕</button>
      </div>
    </div>
  `,
  styles: [`
    .error-banner {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 16px 20px;
      border-radius: 12px;
      margin: 16px 0;
      animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .error-banner.error {
      background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444;
    }
    .error-banner.warning {
      background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b;
    }
    .error-banner.info {
      background: #f0f9ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6;
    }
    .error-icon { font-size: 24px; flex-shrink: 0; padding-top: 2px; }
    .error-body { flex: 1; min-width: 0; }
    .error-title { font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 4px; }
    .error-message { font-size: 14px; color: #4b5563; line-height: 1.5; }
    .error-suggestions ul {
      margin: 8px 0 0 0; padding-left: 18px;
      font-size: 13px; color: #6b7280; line-height: 1.6;
    }
    .error-actions { display: flex; gap: 8px; align-items: flex-start; flex-shrink: 0; }
    .retry-btn {
      padding: 6px 14px;
      background: #fff; border: 1px solid #d1d5db;
      border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 600; color: #374151;
      transition: all 0.15s;
    }
    .retry-btn:hover { background: #f9fafb; border-color: #9ca3af; }
    .dismiss-btn {
      background: none; border: none;
      color: #9ca3af; cursor: pointer;
      font-size: 18px; padding: 2px 6px;
    }
    .dismiss-btn:hover { color: #6b7280; }
  `]
})
export class ErrorBannerComponent {
  @Input() severity: 'error' | 'warning' | 'info' = 'error';
  @Input() title = '';
  @Input() message = '';
  @Input() suggestions: string[] = [];
  @Input() retryable = false;
  @Output() retry = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  get defaultTitle(): string {
    switch (this.severity) {
      case 'error': return 'Something went wrong';
      case 'warning': return 'Heads up';
      case 'info': return 'Note';
    }
  }
}
