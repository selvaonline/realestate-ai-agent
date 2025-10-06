// src/app/notifications-panel.component.ts
// Static notifications panel showing Comet alert history

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
  selector: 'app-notifications-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-panel" [class.expanded]="isExpanded()">
      <!-- Toggle Button -->
      <button class="notifications-toggle" (click)="togglePanel()" [title]="'Notifications (' + unreadCount() + ' unread)'">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12 2C11.172 2 10.5 2.672 10.5 3.5V4.1C8.53 4.56 7 6.24 7 8.5V14L5.29 15.71C4.9 16.1 5.17 17 5.83 17H18.17C18.83 17 19.1 16.1 18.71 15.71L17 14V8.5C17 6.24 15.47 4.56 13.5 4.1V3.5C13.5 2.672 12.828 2 12 2ZM10 19C10 20.1 10.9 21 12 21C13.1 21 14 20.1 14 19H10Z"/>
        </svg>
        <span class="badge" *ngIf="unreadCount() > 0">{{ unreadCount() }}</span>
      </button>

      <!-- Panel Content -->
      <div class="panel-content" *ngIf="isExpanded()">
        <div class="panel-header">
          <h3>Notifications</h3>
          <div class="header-actions">
            <button class="mark-read-btn" *ngIf="unreadCount() > 0" (click)="markAllRead()">
              Mark all read
            </button>
            <button class="close-btn" (click)="togglePanel()">✕</button>
          </div>
        </div>

        <div class="notifications-list">
          <div *ngIf="alerts().length === 0" class="empty-state">
            <span class="empty-icon">📭</span>
            <p>No notifications yet</p>
            <small>You'll see alerts here when watchlists find new properties</small>
          </div>

          <div *ngFor="let alert of alerts()" 
               class="notification-item"
               [class.unread]="!alert.read"
               (click)="markAsRead(alert)">
            <div class="notification-header">
              <span class="notification-icon">🔔</span>
              <div class="notification-title">
                <strong>{{ alert.watchLabel }}</strong>
                <span class="notification-time">{{ getTimeAgo(alert.timestamp) }}</span>
              </div>
            </div>
            <div class="notification-body">
              <div class="notification-summary">
                {{ alert.newCount }} new, {{ alert.changedCount }} changed
              </div>
              <div class="notification-items">
                <div *ngFor="let item of alert.items.slice(0, 3)" class="notification-property">
                  <a [href]="item.url" target="_blank" (click)="$event.stopPropagation()">
                    {{ item.title || 'Property Listing' }}
                  </a>
                  <span class="property-scores">PE: {{ item.score }} | Risk: {{ item.risk }}</span>
                </div>
                <div *ngIf="alert.items.length > 3" class="more-items">
                  +{{ alert.items.length - 3 }} more
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-footer" *ngIf="alerts().length > 0">
          <button class="clear-all-btn" (click)="clearAll()">Clear all</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notifications-panel {
      position: fixed;
      top: 10px;
      right: 20px;
      z-index: 999998;
    }

    .notifications-toggle {
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid #e5e7eb;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: all 0.2s;
      color: #6b7280;
    }

    .notifications-toggle:hover {
      border-color: #667eea;
      color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
    }

    .notifications-toggle svg {
      transition: all 0.2s;
    }

    .notifications-toggle:hover svg {
      transform: scale(1.1);
    }

    .notifications-toggle .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 20px;
      text-align: center;
    }

    .panel-content {
      position: absolute;
      top: 70px;
      right: 0;
      width: 400px;
      max-height: 600px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .panel-header {
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 18px;
      color: #1f2937;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .mark-read-btn {
      background: none;
      border: none;
      color: #667eea;
      font-size: 12px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .mark-read-btn:hover {
      background: #f3f4f6;
    }

    .close-btn {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 20px;
      cursor: pointer;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: #f3f4f6;
    }

    .notifications-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #6b7280;
    }

    .empty-icon {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
    }

    .empty-state p {
      margin: 0 0 8px 0;
      font-size: 16px;
      color: #374151;
    }

    .empty-state small {
      font-size: 13px;
    }

    .notification-item {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .notification-item:hover {
      background: #f9fafb;
      border-color: #667eea;
    }

    .notification-item.unread {
      background: #eff6ff;
      border-color: #667eea;
    }

    .notification-header {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .notification-icon {
      font-size: 20px;
    }

    .notification-title {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .notification-title strong {
      color: #1f2937;
      font-size: 14px;
    }

    .notification-time {
      color: #6b7280;
      font-size: 12px;
    }

    .notification-body {
      padding-left: 32px;
    }

    .notification-summary {
      color: #6b7280;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .notification-items {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .notification-property {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .notification-property a {
      color: #667eea;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
    }

    .notification-property a:hover {
      text-decoration: underline;
    }

    .property-scores {
      color: #6b7280;
      font-size: 11px;
    }

    .more-items {
      color: #6b7280;
      font-size: 12px;
      font-style: italic;
      margin-top: 4px;
    }

    .panel-footer {
      padding: 12px 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }

    .clear-all-btn {
      background: none;
      border: none;
      color: #ef4444;
      font-size: 13px;
      cursor: pointer;
      padding: 8px 16px;
      border-radius: 6px;
      transition: background 0.2s;
    }

    .clear-all-btn:hover {
      background: #fef2f2;
    }

    .notifications-list::-webkit-scrollbar {
      width: 6px;
    }

    .notifications-list::-webkit-scrollbar-track {
      background: #f3f4f6;
      border-radius: 3px;
    }

    .notifications-list::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }

    .notifications-list::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
  `]
})
export class NotificationsPanelComponent implements OnInit, OnDestroy {
  isExpanded = signal(false);
  alerts = signal<(CometAlert & { read?: boolean })[]>([]);
  unreadCount = signal(0);
  private eventSource?: EventSource;

  ngOnInit() {
    // Load saved alerts from localStorage
    this.loadAlerts();

    // Connect to SSE
    this.eventSource = new EventSource('http://localhost:3001/ui/events');
    
    this.eventSource.addEventListener('comet-alert', (event: MessageEvent) => {
      const alert = JSON.parse(event.data) as CometAlert;
      console.log('[notifications-panel] Received alert:', alert);
      
      // Add to alerts with unread flag
      this.alerts.update(alerts => [{ ...alert, read: false }, ...alerts]);
      this.updateUnreadCount();
      this.saveAlerts();
    });
  }

  ngOnDestroy() {
    this.eventSource?.close();
  }

  togglePanel() {
    this.isExpanded.update(v => !v);
  }

  markAsRead(alert: CometAlert & { read?: boolean }) {
    if (!alert.read) {
      this.alerts.update(alerts => 
        alerts.map(a => a.timestamp === alert.timestamp ? { ...a, read: true } : a)
      );
      this.updateUnreadCount();
      this.saveAlerts();
    }
  }

  markAllRead() {
    this.alerts.update(alerts => alerts.map(a => ({ ...a, read: true })));
    this.updateUnreadCount();
    this.saveAlerts();
  }

  clearAll() {
    if (confirm('Clear all notifications?')) {
      this.alerts.set([]);
      this.unreadCount.set(0);
      this.saveAlerts();
    }
  }

  private updateUnreadCount() {
    this.unreadCount.set(this.alerts().filter(a => !a.read).length);
  }

  private saveAlerts() {
    try {
      localStorage.setItem('comet-alerts', JSON.stringify(this.alerts()));
    } catch (e) {
      console.error('[notifications-panel] Failed to save alerts:', e);
    }
  }

  private loadAlerts() {
    try {
      const saved = localStorage.getItem('comet-alerts');
      if (saved) {
        this.alerts.set(JSON.parse(saved));
        this.updateUnreadCount();
      }
    } catch (e) {
      console.error('[notifications-panel] Failed to load alerts:', e);
    }
  }

  getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
