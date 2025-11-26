import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../services/loading.service';

@Component({
    selector: 'app-loading-spinner',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="loading$ | async" class="loading-overlay">
      <div class="spinner"></div>
    </div>
  `,
    styles: [
        `
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }
      .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `
    ]
})
export class LoadingSpinnerComponent {
    // ✅ BEST PRACTICE: Use async pipe - Angular handles subscription and change detection automatically
    loading$ = this.loadingService.loading$;

    constructor(private loadingService: LoadingService) {
        // No manual subscription needed! Async pipe handles everything:
        // - Automatic subscription/unsubscription
        // - Automatic change detection
        // - Better performance
    }
}
