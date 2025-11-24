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
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit {
  user: any = null;
  userEmail: string = '';
  userRole: string = '';
  sidebarOpen: boolean = false;

  // Role flags
  isSuperAdmin = false;
  isAdmin = false;
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
