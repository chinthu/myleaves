import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { combineLatest, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  user: any = null;
  userEmail: string = '';
  userRole: string = '';
  sidebarOpen: boolean = false;

  // Role flags
  isSuperAdmin = false;
  isAdmin = false;
  isHr = false;
  isApprover = false;
  private destroy$ = new Subject<void>();

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {
    // Combine auth user and profile data deterministically
    combineLatest([
      this.authService.currentUser$,
      this.authService.userProfile$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([authUser, userProfile]) => {
        console.log('MainLayout: State update', { authUser, userProfile });

        if (authUser) {
          // Start with auth user data
          this.user = { ...authUser };
          this.userEmail = authUser.email || '';

          // If we have a profile, merge it and prioritize its role
          if (userProfile) {
            this.user = { ...this.user, ...userProfile };
            this.userRole = userProfile.role;
            this.setRoleFlags(this.userRole);
            
            // Only SUPER_ADMIN is automatically redirected from default route to hr-dashboard
            // HR, APPROVER, and ADMIN can access both personal dashboard and HR dashboard
            const currentUrl = this.router.url;
            if (userProfile.role === 'SUPER_ADMIN' && 
                (currentUrl === '/' || currentUrl === '')) {
              console.log('MainLayout: Redirecting super admin from default route to hr-dashboard');
              setTimeout(() => {
                this.router.navigate(['/hr-dashboard']).catch(err => {
                  console.error('Navigation error:', err);
                });
              }, 100);
            }
          } else if (userProfile === null) {
            // Profile loaded but empty/null -> Default to USER
            console.log('MainLayout: Profile null, defaulting to USER');
            this.userRole = 'USER';
            this.setRoleFlags(this.userRole);
          } else {
            // userProfile is undefined (loading) -> Do not set flags yet, keep loading state
            // This prevents flickering to 'USER' role while waiting for profile
          }

          // Trigger profile load if needed (idempotent in service)
          this.authService.getUserProfile();
        }
      });
  }

  setRoleFlags(role: string) {
    this.isSuperAdmin = role === 'SUPER_ADMIN';
    this.isAdmin = role === 'ADMIN';
    this.isHr = role === 'HR';
    this.isApprover = role === 'APPROVER';
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
