// src/app/comet-toast.component.ts
// Toast notifications for Comet alerts

import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

type CometAlert = {
  watchId: string;
  watchLabel: string;
  newCount: number;
  changedCount: number;
  items: any[];
  timestamp: number;
};

@Component({
  selector: 'app-comet-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let alert of alerts()" 
           class="toast"
           [@slideIn]>
        <div class="toast-header">
          <span class="toast-icon">🔔</span>
          <span class="toast-title">{{ alert.watchLabel }}</span>
          <button class="toast-close" (click)="dismissAlert(alert)">✕</button>
        </div>
        <div class="toast-body">
          <div class="toast-summary">
            {{ alert.newCount }} new, {{ alert.changedCount }} changed
          </div>
          <div class="toast-items">
            <div *ngFor="let item of alert.items.slice(0, 2)" class="toast-item">
              <a [href]="item.url" target="_blank">{{ item.title || 'Property Listing' }}</a>
              <span class="toast-scores">PE: {{ item.score }} | Risk: {{ item.risk }}</span>
            </div>
          </div>
          <div class="toast-time">{{ getTimeAgo(alert.timestamp) }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
    }

    .toast {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.2);
      font-weight: 600;
    }

    .toast-icon {
      font-size: 20px;
    }

    .toast-title {
      flex: 1;
      font-size: 14px;
    }

    .toast-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .toast-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .toast-body {
      padding: 12px 16px;
    }

    .toast-summary {
      font-size: 13px;
      margin-bottom: 10px;
      opacity: 0.9;
    }

    .toast-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .toast-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .toast-item a {
      color: white;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .toast-item a:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    .toast-scores {
      font-size: 11px;
      opacity: 0.8;
    }

    .toast-time {
      margin-top: 10px;
      font-size: 11px;
      opacity: 0.7;
      text-align: right;
    }
  `]
})
export class CometToastComponent implements OnInit, OnDestroy {
  alerts = signal<CometAlert[]>([]);
  private eventSource?: EventSource;

  ngOnInit() {
    console.log('[comet-toast] Initializing, connecting to SSE...');
    
    // Connect to UI events SSE
    this.eventSource = new EventSource('http://localhost:3001/ui/events');
    
    this.eventSource.onopen = () => {
      console.log('[comet-toast] ✅ SSE connection established');
    };
    
    this.eventSource.addEventListener('connected', (event: MessageEvent) => {
      console.log('[comet-toast] Received connected event:', event.data);
    });
    
    this.eventSource.addEventListener('comet-alert', (event: MessageEvent) => {
      console.log('[comet-toast] 🔔 Received comet-alert event!', event.data);
      const alert = JSON.parse(event.data) as CometAlert;
      console.log('[comet-toast] Parsed alert:', alert);
      
      // Add to alerts
      this.alerts.update(alerts => [...alerts, alert]);
      console.log('[comet-toast] Alert added to list, total alerts:', this.alerts().length);
      
      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        this.dismissAlert(alert);
      }, 10000);
    });

    this.eventSource.onerror = (error) => {
      console.error('[comet-toast] ❌ SSE error:', error);
      console.error('[comet-toast] EventSource readyState:', this.eventSource?.readyState);
    };
  }

  ngOnDestroy() {
    this.eventSource?.close();
  }

  dismissAlert(alert: CometAlert) {
    this.alerts.update(alerts => alerts.filter(a => a.timestamp !== alert.timestamp));
  }

  getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
}
