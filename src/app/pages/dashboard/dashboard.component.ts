import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TableModule, CardModule, TagModule, ButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  supabase: SupabaseClient;
  user: any = null;

  // Stats
  casualBalance = 0;
  medicalBalance = 0;
  compOffBalance = 0;
  totalLeavesTaken = 0;
  pendingLeaves = 0;

  // Recent Leaves
  recentLeaves: any[] = [];

  // Realtime subscriptions
  private leavesChannel: any;
  private userChannel: any;
  private destroy$ = new Subject<void>();

  constructor(private authService: AuthService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  setupSubscriptions() {
    // Subscribe to changes in leaves table
    this.leavesChannel = this.supabase
      .channel('dashboard-leaves')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'leaves' },
        (payload) => {
          console.log('Leave change detected:', payload);
          this.loadLeaves();
        }
      )
      .subscribe();

    // Subscribe to changes in users table (for balance updates)
    this.userChannel = this.supabase
      .channel('dashboard-user')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${this.user?.id}` },
        (payload) => {
          console.log('User balance updated:', payload);
          if (payload.new) {
            this.casualBalance = (payload.new as any).balance_casual;
            this.medicalBalance = (payload.new as any).balance_medical;
          }
        }
      )
      .subscribe();
  }

  ngOnInit() {
    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((userProfile) => {
        if (userProfile) {
          this.user = userProfile;
          this.casualBalance = this.user.balance_casual;
          this.medicalBalance = this.user.balance_medical;
          this.loadCompOffs();
          this.loadLeaves();
          // Only setup subscriptions once user is loaded
          if (!this.leavesChannel) {
            this.setupSubscriptions();
          }
        }
      });
  }

  async loadCompOffs() {
    const { data } = await this.supabase
      .from('user_comp_offs')
      .select('*')
      .eq('user_id', this.user.id)
      .eq('is_consumed', false);

    if (data) {
      // Sum up the days from available comp offs
      // Assuming user_comp_offs links to comp_offs table which has 'days'
      // But wait, the schema might store days directly or link to a comp_off definition.
      // Let's check the schema or assume a simpler model for now.
      // If user_comp_offs has a 'comp_off_id', we need to join.
      // Let's do a join query.

      const { data: compOffsWithDays } = await this.supabase
        .from('user_comp_offs')
        .select('*, comp_offs(days)')
        .eq('user_id', this.user.id)
        .eq('is_consumed', false);

      if (compOffsWithDays) {
        this.compOffBalance = compOffsWithDays.reduce((sum: number, item: any) => {
          return sum + (item.comp_offs?.days || 0);
        }, 0);
      }
    }
  }

  async loadLeaves() {
    const { data, error } = await this.supabase
      .from('leaves')
      .select('*')
      .eq('user_id', this.user.id)
      .order('created_at', { ascending: false });

    if (data) {
      this.recentLeaves = data;
      this.totalLeavesTaken = data.filter((l: any) => l.status === 'APPROVED').length;
      this.pendingLeaves = data.filter((l: any) => l.status === 'PENDING').length;
    }
  }

  getSeverity(status: string): any {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'PENDING': return 'warn';
      default: return 'info';
    }
  }

  ngOnDestroy() {
    // Unsubscribe from Supabase realtime channels
    if (this.leavesChannel) {
      this.supabase.removeChannel(this.leavesChannel);
    }
    if (this.userChannel) {
      this.supabase.removeChannel(this.userChannel);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
