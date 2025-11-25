import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { LeaveService } from '../../services/leave.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule, ToastModule, CardModule],
  templateUrl: './approvals.component.html',
  styleUrls: ['./approvals.component.scss'],
  providers: [MessageService]
})
export class ApprovalsComponent implements OnInit {
  supabase: SupabaseClient;
  pendingLeaves: any[] = [];
  loading: boolean = true;
  user: any = null;

  constructor(
    private authService: AuthService,
    private leaveService: LeaveService,
    private messageService: MessageService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(async (u) => {
      if (u) {
        this.user = await this.authService.getUserProfile();
        if (this.user) {
          this.loadPendingApprovals();
        }
      }
    });
  }

  async loadPendingApprovals() {
    this.loading = true;
    try {
      const { data: groupMembers, error: gmError } = await this.supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', this.user.id);

      if (gmError) throw gmError;

      const groupIds = groupMembers.map((gm: any) => gm.group_id);

      if (groupIds.length > 0) {
        const { data, error } = await this.leaveService.getPendingApprovals(groupIds);
        if (error) throw error;
        this.pendingLeaves = data || [];
      } else {
        this.pendingLeaves = [];
      }

    } catch (error) {
      console.error('Error loading approvals:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load approvals.' });
    } finally {
      this.loading = false;
    }
  }

  async updateStatus(leaveId: string, status: 'APPROVED' | 'REJECTED') {
    const { error } = await this.leaveService.updateLeaveStatus(leaveId, status, this.user.id);
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update status.' });
    } else {
      this.messageService.add({ severity: 'success', summary: 'Success', detail: `Leave ${status.toLowerCase()} successfully.` });
      this.loadPendingApprovals();
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
