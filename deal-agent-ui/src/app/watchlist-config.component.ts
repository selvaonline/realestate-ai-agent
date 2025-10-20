import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../environments/environment';

interface Watchlist {
  id: string;
  label: string;
  query: string;
  schedule: string;
  enabled: boolean;
  domains?: string[];
  minScore?: number;
  riskMax?: number;
}

interface ScheduleOption {
  value: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-watchlist-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="config-container">
      <div class="config-header">
        <h2>🔧 Watchlist Configuration</h2>
        <p>Manage your watchlists and their monitoring schedules</p>
      </div>

      <div class="config-content">
        <!-- Add New Watchlist Form -->
        <div class="add-watchlist-section">
          <h3>➕ Add New Watchlist</h3>
          <form (ngSubmit)="addWatchlist()" class="add-form">
            <div class="form-row">
              <div class="form-group">
                <label for="newId">ID:</label>
                <input 
                  type="text" 
                  id="newId" 
                  [(ngModel)]="newWatchlist.id" 
                  name="newId"
                  placeholder="e.g., my-watchlist"
                  required>
              </div>
              <div class="form-group">
                <label for="newLabel">Label:</label>
                <input 
                  type="text" 
                  id="newLabel" 
                  [(ngModel)]="newWatchlist.label" 
                  name="newLabel"
                  placeholder="e.g., My Watchlist"
                  required>
              </div>
            </div>
            
            <div class="form-group">
              <label for="newQuery">Search Query:</label>
              <input 
                type="text" 
                id="newQuery" 
                [(ngModel)]="newWatchlist.query" 
                name="newQuery"
                placeholder="e.g., commercial real estate for sale in Phoenix"
                required>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="newSchedule">Schedule:</label>
                <select 
                  id="newSchedule" 
                  [(ngModel)]="newWatchlist.schedule" 
                  name="newSchedule">
                  <option *ngFor="let option of scheduleOptions" [value]="option.value">
                    {{ option.label }} - {{ option.description }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    [(ngModel)]="newWatchlist.enabled" 
                    name="newEnabled">
                  Enabled
                </label>
              </div>
            </div>
            
            <button type="submit" class="add-btn" [disabled]="isAdding()">
              {{ isAdding() ? 'Adding...' : 'Add Watchlist' }}
            </button>
          </form>
        </div>

        <!-- Existing Watchlists -->
        <div class="watchlists-section">
          <h3>📋 Current Watchlists</h3>
          
          <div *ngIf="watchlists().length === 0" class="no-watchlists">
            <p>No watchlists configured yet.</p>
          </div>
          
          <div *ngFor="let watchlist of watchlists(); trackBy: trackByWatchlistId" 
               class="watchlist-card" 
               [class.disabled]="!watchlist.enabled">
            
            <div class="watchlist-header">
              <div class="watchlist-info">
                <h4>{{ watchlist.label }}</h4>
                <span class="watchlist-id">ID: {{ watchlist.id }}</span>
              </div>
              <div class="watchlist-actions">
                <button 
                  class="toggle-btn" 
                  [class.enabled]="watchlist.enabled"
                  (click)="toggleWatchlist(watchlist)">
                  {{ watchlist.enabled ? 'Enabled' : 'Disabled' }}
                </button>
                <button 
                  class="delete-btn" 
                  (click)="deleteWatchlist(watchlist)"
                  title="Delete watchlist">
                  🗑️
                </button>
              </div>
            </div>
            
            <div class="watchlist-details">
              <div class="detail-row">
                <label>Query:</label>
                <span class="query-text">{{ watchlist.query }}</span>
              </div>
              
              <div class="detail-row">
                <label>Schedule:</label>
                <select 
                  [(ngModel)]="watchlist.schedule" 
                  (change)="updateSchedule(watchlist)"
                  class="schedule-select">
                  <option *ngFor="let option of scheduleOptions" [value]="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
              
              <div class="detail-row">
                <label>Status:</label>
                <span class="status-indicator" [class.active]="watchlist.enabled">
                  {{ watchlist.enabled ? '🟢 Active' : '🔴 Inactive' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .config-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
    }

    .config-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .config-header h2 {
      font-size: 32px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 8px 0;
    }

    .config-header p {
      font-size: 16px;
      color: #64748b;
      margin: 0;
    }

    .config-content {
      display: grid;
      gap: 32px;
    }

    .add-watchlist-section, .watchlists-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .add-watchlist-section h3, .watchlists-section h3 {
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 20px 0;
    }

    .add-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-weight: 600;
      color: #374151;
      font-size: 14px;
    }

    .form-group input, .form-group select {
      padding: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.2s;
    }

    .form-group input:focus, .form-group select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      margin: 0;
    }

    .add-btn {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      align-self: flex-start;
    }

    .add-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    .add-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .no-watchlists {
      text-align: center;
      padding: 40px;
      color: #64748b;
    }

    .watchlist-card {
      background: #f8fafc;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      transition: all 0.2s;
    }

    .watchlist-card:hover {
      border-color: #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .watchlist-card.disabled {
      opacity: 0.6;
      background: #f1f5f9;
    }

    .watchlist-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .watchlist-info h4 {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 4px 0;
    }

    .watchlist-id {
      font-size: 12px;
      color: #64748b;
      font-family: monospace;
    }

    .watchlist-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .toggle-btn {
      padding: 6px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      background: white;
      color: #6b7280;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .toggle-btn.enabled {
      background: #10b981;
      border-color: #10b981;
      color: white;
    }

    .toggle-btn:hover {
      transform: scale(1.05);
    }

    .delete-btn {
      background: #ef4444;
      border: 2px solid #ef4444;
      color: white;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .delete-btn:hover {
      background: #dc2626;
      border-color: #dc2626;
      transform: scale(1.1);
    }

    .watchlist-details {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .detail-row label {
      font-weight: 600;
      color: #374151;
      min-width: 80px;
      font-size: 14px;
    }

    .query-text {
      flex: 1;
      color: #64748b;
      font-size: 14px;
      word-break: break-word;
    }

    .schedule-select {
      padding: 6px 8px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      font-size: 14px;
      background: white;
      min-width: 150px;
    }

    .status-indicator {
      font-size: 14px;
      font-weight: 600;
    }

    .status-indicator.active {
      color: #10b981;
    }

    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
      }
      
      .watchlist-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      
      .watchlist-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `]
})
export class WatchlistConfigComponent implements OnInit, OnDestroy {
  watchlists = signal<Watchlist[]>([]);
  isAdding = signal(false);
  isUpdating = signal<string | null>(null);

  newWatchlist: Partial<Watchlist> = {
    id: '',
    label: '',
    query: '',
    schedule: '*/5 * * * *',
    enabled: true
  };

  scheduleOptions: ScheduleOption[] = [
    { value: '*/1 * * * *', label: 'Every 1 minute', description: 'High frequency monitoring' },
    { value: '*/5 * * * *', label: 'Every 5 minutes', description: 'Recommended for active monitoring' },
    { value: '*/15 * * * *', label: 'Every 15 minutes', description: 'Moderate monitoring' },
    { value: '*/30 * * * *', label: 'Every 30 minutes', description: 'Light monitoring' },
    { value: '0 * * * *', label: 'Every hour', description: 'Standard monitoring' },
    { value: '0 */2 * * *', label: 'Every 2 hours', description: 'Low frequency' },
    { value: '0 */6 * * *', label: 'Every 6 hours', description: 'Very low frequency' },
    { value: '0 0 * * *', label: 'Daily', description: 'Once per day' }
  ];

  ngOnInit() {
    this.loadWatchlists();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  async loadWatchlists() {
    try {
      const apiUrl = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/saved-properties/watchlists`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const watchlists = await response.json();
      this.watchlists.set(watchlists);
    } catch (error) {
      console.error('Failed to load watchlists:', error);
      alert('Failed to load watchlists. Please check if the backend is running.');
    }
  }

  async addWatchlist() {
    if (!this.newWatchlist.id || !this.newWatchlist.label || !this.newWatchlist.query) {
      alert('Please fill in all required fields.');
      return;
    }

    this.isAdding.set(true);
    
    try {
      const apiUrl = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/saved-properties/watchlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.newWatchlist)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create watchlist');
      }

      // Reset form
      this.newWatchlist = {
        id: '',
        label: '',
        query: '',
        schedule: '*/5 * * * *',
        enabled: true
      };

      // Reload watchlists
      await this.loadWatchlists();
      
      console.log('Watchlist created successfully');
    } catch (error) {
      console.error('Failed to create watchlist:', error);
      alert(`Failed to create watchlist: ${error}`);
    } finally {
      this.isAdding.set(false);
    }
  }

  async toggleWatchlist(watchlist: Watchlist) {
    this.isUpdating.set(watchlist.id);
    
    try {
      const apiUrl = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/saved-properties/watchlists/${watchlist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: !watchlist.enabled
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update watchlist');
      }

      // Update local state
      const updatedWatchlists = this.watchlists().map(w => 
        w.id === watchlist.id ? { ...w, enabled: !w.enabled } : w
      );
      this.watchlists.set(updatedWatchlists);
      
      console.log(`Watchlist ${watchlist.id} ${!watchlist.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle watchlist:', error);
      alert(`Failed to toggle watchlist: ${error}`);
    } finally {
      this.isUpdating.set(null);
    }
  }

  async updateSchedule(watchlist: Watchlist) {
    this.isUpdating.set(watchlist.id);
    
    try {
      const apiUrl = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/saved-properties/watchlists/${watchlist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schedule: watchlist.schedule
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update schedule');
      }

      console.log(`Schedule updated for watchlist ${watchlist.id}: ${watchlist.schedule}`);
    } catch (error) {
      console.error('Failed to update schedule:', error);
      alert(`Failed to update schedule: ${error}`);
      // Revert the change
      await this.loadWatchlists();
    } finally {
      this.isUpdating.set(null);
    }
  }

  async deleteWatchlist(watchlist: Watchlist) {
    if (!confirm(`Are you sure you want to delete the watchlist "${watchlist.label}"?\n\n⚠️ This will also remove all saved properties in this watchlist.`)) {
      return;
    }

    try {
      const apiUrl = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/saved-properties/watchlists/${watchlist.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete watchlist');
      }

      // Remove from local state
      const updatedWatchlists = this.watchlists().filter(w => w.id !== watchlist.id);
      this.watchlists.set(updatedWatchlists);
      
      console.log(`Watchlist ${watchlist.id} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete watchlist:', error);
      alert(`Failed to delete watchlist: ${error}`);
    }
  }

  trackByWatchlistId(index: number, watchlist: Watchlist): string {
    return watchlist.id;
  }
}
