import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
    private loadingCount = 0;
    private _loading$ = new BehaviorSubject<boolean>(false);

    /** Observable for components to show/hide a spinner */
    get loading$(): Observable<boolean> {
        return this._loading$.asObservable();
    }

    /** Increment counter and emit true */
    show(): void {
        this.loadingCount++;
        this._loading$.next(true);
    }

    /** Decrement counter and emit false when no pending requests */
    hide(): void {
        if (this.loadingCount > 0) {
            this.loadingCount--;
        }
        if (this.loadingCount === 0) {
            this._loading$.next(false);
        }
    }

    /** Force reset loading state (use with caution - only for error recovery) */
    reset(): void {
        this.loadingCount = 0;
        this._loading$.next(false);
    }

    /** Get current loading count (for debugging) */
    getCount(): number {
        return this.loadingCount;
    }
}
