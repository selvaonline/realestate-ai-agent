import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack">
      <div
        *ngFor="let t of svc.toasts()"
        class="toast"
        [ngClass]="t.type"
        (click)="svc.dismiss(t.id)">
        <span class="toast-icon">{{ icon(t.type) }}</span>
        <span class="toast-msg">{{ t.message }}</span>
        <button class="toast-close" (click)="$event.stopPropagation(); svc.dismiss(t.id)">×</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 1000000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 420px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 14px;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1);
      cursor: pointer;
      animation: slideIn 0.35s cubic-bezier(0.21,1.02,0.73,1);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(60px) scale(0.95); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }

    .toast.success {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    }
    .toast.error {
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
    }
    .toast.warning {
      background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
    }
    .toast.info {
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
    }

    .toast-icon { font-size: 18px; flex-shrink: 0; }
    .toast-msg  { flex: 1; }
    .toast-close {
      background: none; border: none;
      color: rgba(255,255,255,0.7);
      font-size: 20px; cursor: pointer;
      padding: 0 0 0 4px; line-height: 1;
      flex-shrink: 0;
      transition: color 0.15s;
    }
    .toast-close:hover { color: #fff; }
  `]
})
export class ToastContainerComponent {
  constructor(public svc: ToastService) {}

  icon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error':   return '✕';
      case 'warning': return '⚠';
      case 'info':    return 'ℹ';
      default:        return '';
    }
  }
}
