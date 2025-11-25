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
    // Step 1: Get leave details to calculate days and user
    const { data: leaveData, error: leaveError } = await this.supabase
      .from('leaves')
      .select('user_id, start_date, end_date, type')
      .eq('id', leaveId)
      .single();

    if (leaveError || !leaveData) {
      return { data: null, error: leaveError || new Error('Leave not found') };
    }

    // Step 2: Calculate number of leave days
    const startDate = new Date(leaveData.start_date);
    const endDate = new Date(leaveData.end_date);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const leaveDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates

    // Step 3: Update leave status to APPROVED
    const { error: updateError } = await this.supabase
      .from('leaves')
      .update({ status: 'APPROVED' })
      .eq('id', leaveId);

    if (updateError) {
      return { data: null, error: updateError };
    }

    // Step 4: Deduct from user's leave balance
    const balanceField = (leaveData as any).type === 'CASUAL' ? 'balance_casual' : 'balance_medical';

    // Get current balance
    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .select(balanceField)
      .eq('id', leaveData.user_id)
      .single();

    if (userError) return { data: null, error: userError };

    const currentBalance = (userData as any)[balanceField] || 0;
    const newBalance = Math.max(0, currentBalance - leaveDays);

    // Update balance
    const { error: updateBalanceError } = await this.supabase
      .from('users')
      .update({ [balanceField]: newBalance })
      .eq('id', leaveData.user_id);

    if (updateBalanceError) {
      return { data: null, error: updateBalanceError };
    }

    return { data: { success: true }, error: null };
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
