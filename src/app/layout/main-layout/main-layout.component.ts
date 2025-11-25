import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {
  user: any = null;
  userEmail: string = '';
  userRole: string = '';
  sidebarOpen: boolean = false;

  // Role flags
  isSuperAdmin = false;
  isAdmin = false;
  isHr = false;
  isApprover = false;

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {
    // Combine auth user and profile data deterministically
    combineLatest([
      this.authService.currentUser$,
      this.authService.userProfile$
    ]).subscribe(([authUser, userProfile]) => {
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
}
