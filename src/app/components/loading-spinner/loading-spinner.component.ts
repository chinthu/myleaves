import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../services/loading.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-loading-spinner',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="loading" class="loading-overlay">
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
export class LoadingSpinnerComponent implements OnDestroy {
    loading = false;
    private destroy$ = new Subject<void>();

    constructor(
        private loadingService: LoadingService,
        private cdr: ChangeDetectorRef
    ) {
        // Subscribe to loading state and trigger change detection
        this.loadingService.loading$
            .pipe(takeUntil(this.destroy$))
            .subscribe(loading => {
                this.loading = loading;
                this.cdr.markForCheck(); // Trigger change detection
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
