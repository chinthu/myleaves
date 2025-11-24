import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TableModule, CardModule, TagModule, ButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
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

  constructor(private authService: AuthService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.loadUserData();
  }

  async loadUserData() {
    this.user = await this.authService.getUserProfile();
    if (this.user) {
      this.casualBalance = this.user.balance_casual;
      this.medicalBalance = this.user.balance_medical;
      await this.loadCompOffs();
      this.loadLeaves();
    }
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
}
