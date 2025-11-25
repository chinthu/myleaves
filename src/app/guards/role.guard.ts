import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take, filter } from 'rxjs/operators';

export const adminOnlyGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.userProfile$.pipe(
    filter(profile => profile !== undefined), // Wait for loading to complete
    take(1),
    map(profile => {
      if (profile && (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN')) {
        return true;
      } else {
        // Redirect to dashboard if not authorized
        return router.createUrlTree(['/']);
      }
    })
  );
};

