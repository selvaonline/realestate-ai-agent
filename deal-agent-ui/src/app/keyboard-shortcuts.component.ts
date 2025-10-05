// src/app/keyboard-shortcuts.component.ts
// Global keyboard shortcuts for the app

import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-keyboard-shortcuts',
  standalone: true,
  template: '', // No UI, just event handling
  styles: []
})
export class KeyboardShortcutsComponent implements OnInit, OnDestroy {
  @Output() openSearch = new EventEmitter<void>();
  @Output() openHelp = new EventEmitter<void>();
  @Output() closeModal = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<void>();

  private handleKeyDown = (e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const cmd = isMac ? e.metaKey : e.ctrlKey;

    // Cmd+K (or Ctrl+K) -> focus search input
    if (cmd && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.openSearch.emit();
      return;
    }

    // Cmd+/ (or Ctrl+/) -> open chat
    if (cmd && e.key === '/') {
      e.preventDefault();
      this.openChat.emit();
      return;
    }

    // ? (Shift+/) -> open help
    if (!cmd && e.shiftKey && e.key === '?') {
      e.preventDefault();
      this.openHelp.emit();
      return;
    }

    // Esc -> close modals
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeModal.emit();
      return;
    }
  };

  ngOnInit() {
    window.addEventListener('keydown', this.handleKeyDown);
    console.log('[shortcuts] Keyboard shortcuts enabled: Cmd+K (search), Cmd+/ (chat), ? (help), Esc (close)');
  }

  ngOnDestroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
