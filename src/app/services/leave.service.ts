import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async getLeaves(userId: string) {
    return this.supabase
      .from('leaves')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  }

  async applyLeave(leaveData: any) {
    return this.supabase.from('leaves').insert(leaveData);
  }

  async updateLeave(leaveId: string, updates: any) {
    return this.supabase
      .from('leaves')
      .update(updates)
      .eq('id', leaveId);
  }

  async getGroups(organizationId: string) {
    return this.supabase
      .from('groups')
      .select('*')
      .eq('organization_id', organizationId);
  }

  async getPendingApprovals(groupIds: string[]) {
    if (!groupIds || groupIds.length === 0) return { data: [], error: null };

    return this.supabase
      .from('leaves')
      .select('*, users:user_id(full_name, email)')
      .in('assigned_group_id', groupIds)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });
  }

  async approveLeave(leaveId: string, approverId: string) {
    // In a real app, we might log who approved it
    return this.supabase
      .from('leaves')
      .update({ status: 'APPROVED' })
      .eq('id', leaveId);
  }

  async rejectLeave(leaveId: string, reason: string) {
    return this.supabase
      .from('leaves')
      .update({ status: 'REJECTED', rejection_reason: reason })
      .eq('id', leaveId);
  }
  async updateLeaveStatus(leaveId: string, status: 'APPROVED' | 'REJECTED', approverId: string, reason?: string) {
    if (status === 'APPROVED') {
      return this.approveLeave(leaveId, approverId);
    } else {
      return this.rejectLeave(leaveId, reason || 'Rejected by approver');
    }
  }
}
