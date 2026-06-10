import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-container" [ngClass]="variant">
      <ng-container [ngSwitch]="variant">

        <!-- Search results loading -->
        <ng-container *ngSwitchCase="'search'">
          <div class="skeleton-header">
            <div class="pulse bar w60"></div>
            <div class="pulse bar w30 mt4"></div>
          </div>
          <div class="skeleton-cards">
            <div class="skeleton-card" *ngFor="let _ of [1,2,3]">
              <div class="skeleton-card-inner">
                <div class="pulse circle"></div>
                <div class="skeleton-card-text">
                  <div class="pulse bar w80"></div>
                  <div class="pulse bar w50 mt6"></div>
                  <div class="skeleton-badges mt8">
                    <div class="pulse badge"></div>
                    <div class="pulse badge"></div>
                  </div>
                  <div class="pulse bar w90 mt8"></div>
                  <div class="pulse bar w70 mt4"></div>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Inline loader (for smaller sections) -->
        <ng-container *ngSwitchCase="'inline'">
          <div class="inline-loader">
            <div class="spinner"></div>
            <span class="loader-text">{{ message }}</span>
          </div>
        </ng-container>

        <!-- Phase-based progress indicator -->
        <ng-container *ngSwitchDefault>
          <div class="phase-loader">
            <div class="phase-steps">
              <div class="phase-step" *ngFor="let step of phases; let i = index"
                   [ngClass]="{ active: i === currentPhase, done: i < currentPhase }">
                <div class="step-icon">
                  <span *ngIf="i < currentPhase">✓</span>
                  <span *ngIf="i === currentPhase" class="spinner-small"></span>
                  <span *ngIf="i > currentPhase" class="step-num">{{ i + 1 }}</span>
                </div>
                <span class="step-label">{{ step }}</span>
              </div>
            </div>
          </div>
        </ng-container>

      </ng-container>
    </div>
  `,
  styles: [`
    .skeleton-container { margin: 20px 0; }

    .pulse {
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite ease-in-out;
      border-radius: 6px;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .bar { height: 14px; }
    .w30 { width: 30%; }
    .w50 { width: 50%; }
    .w60 { width: 60%; }
    .w70 { width: 70%; }
    .w80 { width: 80%; }
    .w90 { width: 90%; }
    .mt4 { margin-top: 4px; }
    .mt6 { margin-top: 6px; }
    .mt8 { margin-top: 8px; }

    .circle { width: 56px; height: 56px; border-radius: 14px; flex-shrink: 0; }

    .skeleton-header { margin-bottom: 16px; }

    .skeleton-cards {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      overflow: hidden;
    }
    .skeleton-card { padding: 22px 26px; border-bottom: 1px solid #e2e8f0; }
    .skeleton-card:last-child { border-bottom: none; }
    .skeleton-card-inner { display: flex; gap: 24px; align-items: flex-start; }
    .skeleton-card-text { flex: 1; }
    .skeleton-badges { display: flex; gap: 8px; }
    .badge { width: 120px; height: 26px; border-radius: 999px; }

    /* Inline loader */
    .inline-loader {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px;
      background: #f0f9ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
    }
    .loader-text { color: #1e40af; font-size: 14px; font-weight: 500; }

    .spinner {
      width: 20px; height: 20px;
      border: 3px solid #bfdbfe;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Phase progress */
    .phase-loader {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 24px;
    }
    .phase-steps { display: flex; flex-direction: column; gap: 12px; }
    .phase-step {
      display: flex; align-items: center; gap: 14px;
      padding: 10px 14px;
      border-radius: 10px;
      transition: all 0.3s ease;
    }
    .phase-step.active { background: #f0f9ff; }
    .phase-step.done { opacity: 0.6; }
    .step-icon {
      width: 28px; height: 28px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
      background: #e2e8f0; color: #64748b;
    }
    .phase-step.active .step-icon { background: #dbeafe; color: #2563eb; }
    .phase-step.done .step-icon { background: #d1fae5; color: #059669; }
    .step-label { font-size: 14px; color: #374151; font-weight: 500; }
    .phase-step.active .step-label { color: #1e40af; font-weight: 600; }
    .step-num { font-size: 12px; }

    .spinner-small {
      display: block; width: 14px; height: 14px;
      border: 2px solid #bfdbfe;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  `]
})
export class LoadingSkeletonComponent {
  @Input() variant: 'search' | 'inline' | 'phases' = 'search';
  @Input() message = 'Loading...';
  @Input() phases: string[] = [
    'Searching property listings...',
    'Scoring with PE model...',
    'Fetching market data...',
    'Generating insights...'
  ];
  @Input() currentPhase = 0;
}
