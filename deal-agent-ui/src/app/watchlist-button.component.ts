// src/app/watchlist-button.component.ts
// Watchlist button component to view saved watchlists

import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';

type Watchlist = {
  id: string;
  label: string;
  query: string;
  lastRun?: number;
  itemCount?: number;
  enabled?: boolean;
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
               class="watchlist-item">
            <div class="watchlist-content" (click)="viewWatchlist(watchlist)">
              <div class="watchlist-header">
                <span class="watchlist-icon">📌</span>
                <div class="watchlist-info">
                  <strong>{{ watchlist.label }}</strong>
                  <span class="watchlist-query">{{ watchlist.query }}</span>
                  <span *ngIf="watchlist.enabled === false" class="disabled-badge">Disabled</span>
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
            <button class="delete-btn" 
                    (click)="deleteWatchlist($event, watchlist)"
                    title="Delete watchlist">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
              </svg>
              <span style="font-size: 12px;">Delete</span>
            </button>
          </div>
        </div>

        <div class="panel-footer">
          <button class="create-btn" (click)="createWatchlist()">
            <span>+</span> Create Watchlist
          </button>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div *ngIf="showDeleteModal()" 
           class="delete-modal-overlay"
           (click)="showDeleteModal.set(false)">
        <div class="delete-modal" (click)="$event.stopPropagation()">
          <div class="modal-icon">🗑️</div>
          <h3>Delete Watchlist?</h3>
          <p class="modal-message">
            Are you sure you want to delete <strong>"{{ watchlistToDelete()?.label }}"</strong>?
          </p>
          <p class="modal-warning">
            ⚠️ This will also remove all saved properties in this watchlist.
          </p>
          <div class="modal-actions">
            <button class="modal-btn cancel-btn" (click)="showDeleteModal.set(false)">
              Cancel
            </button>
            <button class="modal-btn delete-btn-confirm" (click)="confirmDelete()">
              Delete Watchlist
            </button>
          </div>
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
      width: 420px;
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
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      overflow: hidden;
    }

    .watchlist-item:hover {
      background: #f0fdf4;
      border-color: #10b981;
    }

    .watchlist-content {
      flex: 1;
      cursor: pointer;
      min-width: 0;
      overflow: hidden;
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
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 180px;
      display: block;
    }

    .watchlist-query {
      color: #6b7280;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
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

    .disabled-badge {
      background: #fef3c7;
      color: #92400e;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 4px;
      display: inline-block;
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

    .delete-btn {
      background: #dc2626;
      border: 2px solid #dc2626;
      color: white;
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      transition: all 0.2s;
      display: flex !important;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      opacity: 1;
      pointer-events: auto;
      min-width: 32px;
      min-height: 32px;
      font-size: 11px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);
      white-space: nowrap;
    }

    .watchlist-item:hover .delete-btn {
      opacity: 1;
      background: #b91c1c;
      border-color: #b91c1c;
      transform: scale(1.05);
    }

    .delete-btn:hover {
      background: #991b1b;
      border-color: #991b1b;
      transform: scale(1.1);
      box-shadow: 0 4px 8px rgba(220, 38, 38, 0.4);
    }

    .delete-btn svg {
      transition: transform 0.2s;
    }

    .delete-btn:hover svg {
      transform: scale(1.1);
    }

    .delete-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .delete-modal {
      background: white;
      border-radius: 20px;
      padding: 32px;
      max-width: 440px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
      text-align: center;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-icon {
      font-size: 56px;
      margin-bottom: 16px;
    }

    .delete-modal h3 {
      margin: 0 0 16px 0;
      font-size: 24px;
      color: #1f2937;
      font-weight: 700;
    }

    .modal-message {
      margin: 0 0 16px 0;
      color: #4b5563;
      font-size: 15px;
      line-height: 1.6;
    }

    .modal-message strong {
      color: #1f2937;
      font-weight: 600;
    }

    .modal-warning {
      margin: 0 0 24px 0;
      padding: 12px 16px;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 8px;
      color: #92400e;
      font-size: 13px;
      line-height: 1.5;
      text-align: left;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .modal-btn {
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      min-width: 140px;
    }

    .cancel-btn {
      background: #f3f4f6;
      color: #374151;
    }

    .cancel-btn:hover {
      background: #e5e7eb;
      transform: translateY(-1px);
    }

    .delete-btn-confirm {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white;
    }

    .delete-btn-confirm:hover {
      background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
    }
  `]
})
export class WatchlistButtonComponent implements OnInit, OnDestroy {
  isExpanded = signal(false);
  watchlists = signal<Watchlist[]>([]);
  showDeleteModal = signal(false);
  watchlistToDelete = signal<Watchlist | null>(null);
  private watchlistCreatedListener?: (event: Event) => void;

  constructor() {
    this.loadWatchlists();
  }

  ngOnInit() {
    // Listen for watchlist creation events
    this.watchlistCreatedListener = (event: Event) => {
      console.log('[watchlist-button] Watchlist created, reloading...');
      this.loadWatchlists();
    };
    window.addEventListener('watchlist-created', this.watchlistCreatedListener);
  }

  ngOnDestroy() {
    if (this.watchlistCreatedListener) {
      window.removeEventListener('watchlist-created', this.watchlistCreatedListener);
    }
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
        this.watchlists.set(watchlistsArray); // Show all watchlists for management
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

  deleteWatchlist(event: Event, watchlist: Watchlist) {
    // Prevent triggering the parent click event
    event.stopPropagation();
    
    // Show custom delete modal
    this.watchlistToDelete.set(watchlist);
    this.showDeleteModal.set(true);
  }

  async confirmDelete() {
    const watchlist = this.watchlistToDelete();
    if (!watchlist) return;
    
    try {
      const baseUrl = environment.apiUrl || window.location.origin;
      const response = await fetch(`${baseUrl}/api/saved-properties/watchlists/${watchlist.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('[watchlist-button] Deleted watchlist:', watchlist.label);
        // Close modal
        this.showDeleteModal.set(false);
        this.watchlistToDelete.set(null);
        // Reload watchlists
        await this.loadWatchlists();
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('watchlist-deleted', { 
          detail: { id: watchlist.id } 
        }));
      } else {
        const error = await response.json();
        alert(`Failed to delete watchlist: ${error.error || 'Unknown error'}`);
        this.showDeleteModal.set(false);
      }
    } catch (error) {
      console.error('[watchlist-button] Failed to delete watchlist:', error);
      alert('Failed to delete watchlist. Please try again.');
      this.showDeleteModal.set(false);
    }
  }
}
