// src/app/watchlist-button.component.ts
// Watchlist button component to view saved watchlists

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';

type Watchlist = {
  id: string;
  label: string;
  query: string;
  lastRun?: number;
  itemCount?: number;
};

@Component({
  selector: 'app-watchlist-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="watchlist-button">
      <!-- Toggle Button -->
      <button class="watchlist-toggle" (click)="togglePanel()" title="View Watchlists">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="badge" *ngIf="watchlists().length > 0">{{ watchlists().length }}</span>
      </button>

      <!-- Panel Content -->
      <div class="panel-content" *ngIf="isExpanded()">
        <div class="panel-header">
          <h3>Watchlists</h3>
          <button class="close-btn" (click)="togglePanel()">✕</button>
        </div>

        <div class="watchlists-list">
          <div *ngIf="watchlists().length === 0" class="empty-state">
            <span class="empty-icon">📋</span>
            <p>No watchlists yet</p>
            <small>Create watchlists to monitor properties automatically</small>
          </div>

          <div *ngFor="let watchlist of watchlists()" 
               class="watchlist-item"
               (click)="viewWatchlist(watchlist)">
            <div class="watchlist-header">
              <span class="watchlist-icon">📌</span>
              <div class="watchlist-info">
                <strong>{{ watchlist.label }}</strong>
                <span class="watchlist-query">{{ watchlist.query }}</span>
              </div>
            </div>
            <div class="watchlist-meta">
              <span *ngIf="watchlist.itemCount" class="item-count">
                {{ watchlist.itemCount }} properties
              </span>
              <span *ngIf="watchlist.lastRun" class="last-run">
                Last checked: {{ getTimeAgo(watchlist.lastRun) }}
              </span>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <button class="create-btn" (click)="createWatchlist()">
            <span>+</span> Create Watchlist
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .watchlist-button {
      position: fixed;
      top: 10px;
      right: 80px;
      z-index: 999998;
    }

    .watchlist-toggle {
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

    .watchlist-toggle:hover {
      border-color: #10b981;
      color: #10b981;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }

    .watchlist-toggle svg {
      transition: all 0.2s;
    }

    .watchlist-toggle:hover svg {
      transform: scale(1.1);
    }

    .watchlist-toggle .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #10b981;
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

    .watchlists-list {
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

    .watchlist-item {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .watchlist-item:hover {
      background: #f0fdf4;
      border-color: #10b981;
    }

    .watchlist-header {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }

    .watchlist-icon {
      font-size: 20px;
    }

    .watchlist-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .watchlist-info strong {
      color: #1f2937;
      font-size: 14px;
    }

    .watchlist-query {
      color: #6b7280;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .watchlist-meta {
      padding-left: 32px;
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #9ca3af;
    }

    .item-count {
      color: #10b981;
      font-weight: 600;
    }

    .panel-footer {
      padding: 12px 20px;
      border-top: 1px solid #e5e7eb;
    }

    .create-btn {
      width: 100%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .create-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .create-btn span {
      font-size: 18px;
    }

    .watchlists-list::-webkit-scrollbar {
      width: 6px;
    }

    .watchlists-list::-webkit-scrollbar-track {
      background: #f3f4f6;
      border-radius: 3px;
    }

    .watchlists-list::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }

    .watchlists-list::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
  `]
})
export class WatchlistButtonComponent {
  isExpanded = signal(false);
  watchlists = signal<Watchlist[]>([]);

  constructor() {
    this.loadWatchlists();
  }

  togglePanel() {
    this.isExpanded.update(v => !v);
  }

  async loadWatchlists() {
    try {
      const baseUrl = environment.apiUrl || window.location.origin;
      const response = await fetch(`${baseUrl}/api/saved-properties/watchlists`);
      if (response.ok) {
        const data = await response.json();
        // API returns array directly, not wrapped in an object
        const watchlistsArray = Array.isArray(data) ? data : [];
        // Filter out disabled watchlists
        this.watchlists.set(watchlistsArray.filter((w: any) => w.enabled !== false));
        console.log('[watchlist-button] Loaded watchlists:', this.watchlists().length);
      }
    } catch (error) {
      console.error('[watchlist-button] Failed to load watchlists:', error);
    }
  }

  viewWatchlist(watchlist: Watchlist) {
    // Trigger search with watchlist query
    console.log('[watchlist-button] Running watchlist:', watchlist.label);
    
    // Dispatch event to main app to run the search
    window.dispatchEvent(new CustomEvent('run-watchlist-query', { 
      detail: { 
        query: watchlist.query, 
        label: watchlist.label,
        id: watchlist.id 
      } 
    }));
    
    // Close the panel
    this.togglePanel();
  }

  createWatchlist() {
    // Open create watchlist dialog
    console.log('[watchlist-button] Create new watchlist');
    this.togglePanel();
    // Trigger the main app's watchlist creation
    window.dispatchEvent(new CustomEvent('create-watchlist'));
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
