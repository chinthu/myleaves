import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hr-dashboard.component.html',
  styleUrls: ['./hr-dashboard.component.css']
})
export class HrDashboardComponent implements OnInit {
  supabase: SupabaseClient;
  user: any = null;

  // Stats
  totalUsers = 0;
  leavesToday = 0;
  pendingRequests = 0;

  // Lists
  allLeaves: any[] = [];
  loading = true;

  constructor(private authService: AuthService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(async (u) => {
      if (u) {
        this.user = await this.authService.getUserProfile();
        if (this.user) {
          this.loadStats();
        }
      }
    });
  }

  async loadStats() {
    this.loading = true;
    try {
      // 1. Total Users
      const { count: userCount } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', this.user.organization_id);
      this.totalUsers = userCount || 0;

      // 2. Leaves Today
      const today = new Date().toISOString().split('T')[0];
      const { count: leavesTodayCount } = await this.supabase
        .from('leaves')
        .select('*', { count: 'exact', head: true })
        .lte('start_date', today)
        .gte('end_date', today)
        .eq('status', 'APPROVED');
      this.leavesToday = leavesTodayCount || 0;

      // 3. Pending Requests (All)
      const { count: pendingCount } = await this.supabase
        .from('leaves')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');
      this.pendingRequests = pendingCount || 0;

      // 4. All Leaves List
      const { data: leaves } = await this.supabase
        .from('leaves')
        .select('*, users:user_id(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(20);

      this.allLeaves = leaves || [];

    } catch (error) {
      console.error('Error loading HR stats:', error);
    } finally {
      this.loading = false;
    }
  }
}
