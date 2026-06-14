import { Injectable, signal } from '@angular/core';

export type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private nextId = 0;

  show(message: string, type: Toast['type'] = 'info', duration = 4000) {
    const id = this.nextId++;
    this.toasts.update(t => [...t, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string, duration = 3000) { this.show(message, 'success', duration); }
  error(message: string, duration = 5000) { this.show(message, 'error', duration); }
  warning(message: string, duration = 4000) { this.show(message, 'warning', duration); }
  info(message: string, duration = 4000) { this.show(message, 'info', duration); }

  dismiss(id: number) {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }
}
