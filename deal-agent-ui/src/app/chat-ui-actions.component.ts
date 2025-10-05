// src/app/chat-ui-actions.component.ts
// Listens to SSE events from backend for chat-triggered UI actions

import { Component, EventEmitter, Output, OnInit, OnDestroy } from '@angular/core';
import { environment } from '../environments/environment';

export interface UIAction {
  type: string;
  payload: any;
}

@Component({
  selector: 'app-chat-ui-actions',
  standalone: true,
  template: '', // No UI, just event handling
  styles: []
})
export class ChatUIActionsComponent implements OnInit, OnDestroy {
  @Output() openCard = new EventEmitter<{ id?: number; url?: string }>();
  @Output() renderCharts = new EventEmitter<{ scope: 'deal' | 'portfolio'; id?: number }>();
  @Output() exportMemo = new EventEmitter<{ id?: number; url?: string; format: 'txt' | 'docx' | 'pdf' }>();
  @Output() scrollToDeal = new EventEmitter<{ id: number }>();
  @Output() filterDeals = new EventEmitter<any>();
  @Output() compareDeals = new EventEmitter<{ ids: number[] }>();

  private eventSource?: EventSource;

  ngOnInit() {
    this.connectToUIEvents();
  }

  private connectToUIEvents() {
    const url = `${environment.apiUrl}/ui/events`;
    console.log('[chat-ui-actions] Connecting to:', url);

    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('connected', (event: any) => {
      console.log('[chat-ui-actions] Connected to UI events stream');
    });

    this.eventSource.addEventListener('open-card', (event: any) => {
      const data = JSON.parse(event.data);
      console.log('[chat-ui-actions] Open card:', data);
      this.openCard.emit(data);
    });

    this.eventSource.addEventListener('render-charts', (event: any) => {
      const data = JSON.parse(event.data);
      console.log('[chat-ui-actions] Render charts:', data);
      this.renderCharts.emit(data);
    });

    this.eventSource.addEventListener('export-memo', (event: any) => {
      const data = JSON.parse(event.data);
      console.log('[chat-ui-actions] Export memo:', data);
      this.exportMemo.emit(data);
    });

    this.eventSource.addEventListener('scroll-to-deal', (event: any) => {
      const data = JSON.parse(event.data);
      console.log('[chat-ui-actions] Scroll to deal:', data);
      this.scrollToDeal.emit(data);
    });

    this.eventSource.addEventListener('filter-deals', (event: any) => {
      const data = JSON.parse(event.data);
      console.log('[chat-ui-actions] Filter deals:', data);
      this.filterDeals.emit(data);
    });

    this.eventSource.addEventListener('compare-deals', (event: any) => {
      const data = JSON.parse(event.data);
      console.log('[chat-ui-actions] Compare deals:', data);
      this.compareDeals.emit(data);
    });

    this.eventSource.onerror = (error) => {
      console.error('[chat-ui-actions] EventSource error:', error);
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          console.log('[chat-ui-actions] Reconnecting...');
          this.connectToUIEvents();
        }
      }, 5000);
    };
  }

  ngOnDestroy() {
    if (this.eventSource) {
      console.log('[chat-ui-actions] Closing EventSource connection');
      this.eventSource.close();
    }
  }
}
