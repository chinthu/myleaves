import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { LeaveService } from '../../services/leave.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Subject, takeUntil } from 'rxjs';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, TagModule, ToastModule, CardModule, DialogModule, InputTextareaModule],
  templateUrl: './approvals.component.html',
  styleUrls: ['./approvals.component.scss'],
  providers: [MessageService]
})
export class ApprovalsComponent implements OnInit, OnDestroy {
  supabase: SupabaseClient;
  pendingLeaves: any[] = [];
  loading: boolean = true;
  user: any = null;
  
  // Reject dialog
  showRejectDialog = false;
  selectedLeave: any = null;
  rejectionReason: string = '';
  
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private leaveService: LeaveService,
    private messageService: MessageService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((userProfile) => {
        if (userProfile) {
          this.user = userProfile;
          this.loadPendingApprovals();
        }
      });
  }

  async loadPendingApprovals() {
    this.loading = true;
    try {
      const userRole = this.user.role;
      let query = this.supabase
        .from('leaves')
        .select('*, users:user_id(full_name, email)')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });

      // For Admin, SuperAdmin, and CEO: Show all pending leaves
      if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'CEO') {
        const { data, error } = await query;
        if (error) throw error;
        this.pendingLeaves = data || [];
      } 
      // For Team Lead: Show leaves from groups they belong to
      else if (userRole === 'TEAM_LEAD') {
        // Get groups where this team lead is a member
        const { data: groupMembers, error: gmError } = await this.supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', this.user.id);

        if (gmError) throw gmError;

        const groupIds = groupMembers?.map((gm: any) => gm.group_id) || [];

        if (groupIds.length > 0) {
          // Get pending leaves assigned to these groups
          const { data, error } = await query.in('assigned_group_id', groupIds);
          if (error) throw error;
          this.pendingLeaves = data || [];
        } else {
          this.pendingLeaves = [];
        }
      }
      // For HR: Show all pending leaves (same as Admin)
      else if (userRole === 'HR') {
        const { data, error } = await query;
        if (error) throw error;
        this.pendingLeaves = data || [];
      }
      // For regular users: No approvals to show
      else {
        this.pendingLeaves = [];
      }

    } catch (error) {
      console.error('Error loading approvals:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load approvals.' });
    } finally {
      this.loading = false;
    }
  }

  openRejectDialog(leave: any) {
    this.selectedLeave = leave;
    this.rejectionReason = '';
    this.showRejectDialog = true;
  }

  closeRejectDialog() {
    this.showRejectDialog = false;
    this.selectedLeave = null;
    this.rejectionReason = '';
  }

  async updateStatus(leaveId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const { error } = await this.leaveService.updateLeaveStatus(leaveId, status, this.user.id, reason);
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update status.' });
    } else {
      this.messageService.add({ severity: 'success', summary: 'Success', detail: `Leave ${status.toLowerCase()} successfully.` });
      this.closeRejectDialog();
      this.loadPendingApprovals();
    }
  }

  async confirmReject() {
    if (!this.selectedLeave || !this.rejectionReason.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please provide a rejection reason.' });
      return;
    }
    await this.updateStatus(this.selectedLeave.id, 'REJECTED', this.rejectionReason);
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
    this.destroy$.next();
    this.destroy$.complete();
  }
}
