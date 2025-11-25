import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { LoadingService } from './loading.service';

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  private supabase: SupabaseClient;

  constructor(private loadingService: LoadingService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async getLeaves(userId: string, year?: number) {
    this.loadingService.show();
    try {
      let query = this.supabase
        .from('leaves')
        .select('*')
        .eq('user_id', userId);

      // Filter by calendar year if provided
      if (year) {
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;
        query = query
          .gte('start_date', startOfYear)
          .lte('start_date', endOfYear);
      }

      return await query.order('created_at', { ascending: false });
    } finally {
      this.loadingService.hide();
    }
  }

  async getLeavesByYear(userId: string, year: number) {
    return this.getLeaves(userId, year);
  }

  async applyLeave(leaveData: any) {
    this.loadingService.show();
    try {
      return await this.supabase.from('leaves').insert(leaveData);
    } finally {
      this.loadingService.hide();
    }
  }

  async updateLeave(leaveId: string, updates: any) {
    this.loadingService.show();
    try {
      return await this.supabase
        .from('leaves')
        .update(updates)
        .eq('id', leaveId);
    } finally {
      this.loadingService.hide();
    }
  }

  async getGroups(organizationId: string) {
    this.loadingService.show();
    try {
      return await this.supabase
        .from('groups')
        .select('*')
        .eq('organization_id', organizationId);
    } finally {
      this.loadingService.hide();
    }
  }

  async getPendingApprovals(groupIds: string[]) {
    if (!groupIds || groupIds.length === 0) return { data: [], error: null };

    this.loadingService.show();
    try {
      return await this.supabase
        .from('leaves')
        .select('*, users:user_id(full_name, email)')
        .in('assigned_group_id', groupIds)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });
    } finally {
      this.loadingService.hide();
    }
  }

  async approveLeave(leaveId: string, approverId: string) {
    this.loadingService.show();
    try {
      // Step 1: Get leave details to calculate days and user
      const { data: leaveData, error: leaveError } = await this.supabase
        .from('leaves')
        .select('user_id, start_date, end_date, type, is_half_day, days_count')
        .eq('id', leaveId)
        .single();

      if (leaveError || !leaveData) {
        return { data: null, error: leaveError || new Error('Leave not found') };
      }

      // Step 2: Use days_count from database (already calculated correctly with half days)
      const leaveDays = leaveData.days_count || 0;

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
    } finally {
      this.loadingService.hide();
    }
  }

  async rejectLeave(leaveId: string, reason: string) {
    this.loadingService.show();
    try {
      return await this.supabase
        .from('leaves')
        .update({ status: 'REJECTED', rejection_reason: reason })
        .eq('id', leaveId);
    } finally {
      this.loadingService.hide();
    }
  }
  async updateLeaveStatus(leaveId: string, status: 'APPROVED' | 'REJECTED', approverId: string, reason?: string) {
    if (status === 'APPROVED') {
      return this.approveLeave(leaveId, approverId);
    } else {
      return this.rejectLeave(leaveId, reason || 'Rejected by approver');
    }
  }

  async cancelLeave(leaveId: string) {
    this.loadingService.show();
    try {
      // Get leave details to check if it was approved (need to restore balance)
      const { data: leaveData, error: leaveError } = await this.supabase
        .from('leaves')
        .select('user_id, start_date, end_date, type, status, days_count')
        .eq('id', leaveId)
        .single();

      if (leaveError || !leaveData) {
        return { data: null, error: leaveError || new Error('Leave not found') };
      }

      // If leave was approved, restore the balance
      if (leaveData.status === 'APPROVED') {
        // Use days_count from database (already calculated correctly with half days)
        const leaveDays = leaveData.days_count || 0;

        const balanceField = leaveData.type === 'CASUAL' ? 'balance_casual' : 'balance_medical';

        // Get current balance
        const { data: userData, error: userError } = await this.supabase
          .from('users')
          .select(balanceField)
          .eq('id', leaveData.user_id)
          .single();

        if (userError) return { data: null, error: userError };

        const currentBalance = (userData as any)[balanceField] || 0;
        const newBalance = currentBalance + leaveDays;

        // Update balance
        const { error: updateBalanceError } = await this.supabase
          .from('users')
          .update({ [balanceField]: newBalance })
          .eq('id', leaveData.user_id);

        if (updateBalanceError) {
          return { data: null, error: updateBalanceError };
        }
      }

      // Update leave status to CANCELLED
      const { error: updateError } = await this.supabase
        .from('leaves')
        .update({ status: 'CANCELLED' })
        .eq('id', leaveId);

      if (updateError) {
        return { data: null, error: updateError };
      }

      return { data: { success: true }, error: null };
    } finally {
      this.loadingService.hide();
    }
  }

  async deleteLeave(leaveId: string) {
    this.loadingService.show();
    try {
      // Get leave details to check if it was approved (need to restore balance)
      const { data: leaveData, error: leaveError } = await this.supabase
        .from('leaves')
        .select('user_id, start_date, end_date, type, status, days_count')
        .eq('id', leaveId)
        .single();

      if (leaveError || !leaveData) {
        return { data: null, error: leaveError || new Error('Leave not found') };
      }

      // If leave was approved, restore the balance
      if (leaveData.status === 'APPROVED') {
        // Use days_count from database (already calculated correctly with half days)
        const leaveDays = leaveData.days_count || 0;

        const balanceField = leaveData.type === 'CASUAL' ? 'balance_casual' : 'balance_medical';

        // Get current balance
        const { data: userData, error: userError } = await this.supabase
          .from('users')
          .select(balanceField)
          .eq('id', leaveData.user_id)
          .single();

        if (userError) return { data: null, error: userError };

        const currentBalance = (userData as any)[balanceField] || 0;
        const newBalance = currentBalance + leaveDays;

        // Update balance
        const { error: updateBalanceError } = await this.supabase
          .from('users')
          .update({ [balanceField]: newBalance })
          .eq('id', leaveData.user_id);

        if (updateBalanceError) {
          return { data: null, error: updateBalanceError };
        }
      }

      // Delete the leave
      const { error: deleteError } = await this.supabase
        .from('leaves')
        .delete()
        .eq('id', leaveId);

      if (deleteError) {
        return { data: null, error: deleteError };
      }

      return { data: { success: true }, error: null };
    } finally {
      this.loadingService.hide();
    }
  }

  async editLeave(leaveId: string, updates: any) {
    this.loadingService.show();
    try {
      // Get current leave details
      const { data: currentLeave, error: getError } = await this.supabase
        .from('leaves')
        .select('user_id, start_date, end_date, type, status, days_count, is_half_day')
        .eq('id', leaveId)
        .single();

      if (getError || !currentLeave) {
        return { data: null, error: getError || new Error('Leave not found') };
      }

      // Calculate new leave days
      let newLeaveDays = 0;
      if (updates.is_half_day) {
        newLeaveDays = 0.5;
      } else {
        const newStartDate = new Date(updates.start_date || currentLeave.start_date);
        const newEndDate = new Date(updates.end_date || currentLeave.end_date);
        const newDiffTime = Math.abs(newEndDate.getTime() - newStartDate.getTime());
        newLeaveDays = Math.ceil(newDiffTime / (1000 * 60 * 60 * 24)) + 1;
      }

      // If leave was approved, we need to restore old balance and deduct new balance
      // This handles both user edits (which reset to pending) and admin edits (which may keep approved)
      if (currentLeave.status === 'APPROVED' && updates.status === 'APPROVED') {
        // Admin editing an approved leave - need to adjust balance
        // Use old days_count from database
        const oldLeaveDays = currentLeave.days_count || 0;

        const oldBalanceField = currentLeave.type === 'CASUAL' ? 'balance_casual' : 'balance_medical';
        const newBalanceField = (updates.type || currentLeave.type) === 'CASUAL' ? 'balance_casual' : 'balance_medical';

        // Get current balance
        const { data: userData, error: userError } = await this.supabase
          .from('users')
          .select('balance_casual, balance_medical')
          .eq('id', currentLeave.user_id)
          .single();

        if (userError) return { data: null, error: userError };

        let newCasualBalance = userData.balance_casual || 0;
        let newMedicalBalance = userData.balance_medical || 0;

        // Restore old balance
        if (oldBalanceField === 'balance_casual') {
          newCasualBalance += oldLeaveDays;
        } else {
          newMedicalBalance += oldLeaveDays;
        }

        // Deduct new balance
        if (newBalanceField === 'balance_casual') {
          newCasualBalance = Math.max(0, newCasualBalance - newLeaveDays);
        } else {
          newMedicalBalance = Math.max(0, newMedicalBalance - newLeaveDays);
        }

        // Update balance
        const { error: updateBalanceError } = await this.supabase
          .from('users')
          .update({ 
            balance_casual: newCasualBalance,
            balance_medical: newMedicalBalance
          })
          .eq('id', currentLeave.user_id);

        if (updateBalanceError) {
          return { data: null, error: updateBalanceError };
        }
      } else if (currentLeave.status === 'APPROVED' && updates.status === 'PENDING') {
        // User editing an approved leave - restore balance since it's going back to pending
        const oldLeaveDays = currentLeave.days_count || 0;
        const balanceField = currentLeave.type === 'CASUAL' ? 'balance_casual' : 'balance_medical';

        // Get current balance
        const { data: userData, error: userError } = await this.supabase
          .from('users')
          .select(balanceField)
          .eq('id', currentLeave.user_id)
          .single();

        if (userError) return { data: null, error: userError };

        const currentBalance = (userData as any)[balanceField] || 0;
        const newBalance = currentBalance + oldLeaveDays;

        // Update balance
        const { error: updateBalanceError } = await this.supabase
          .from('users')
          .update({ [balanceField]: newBalance })
          .eq('id', currentLeave.user_id);

        if (updateBalanceError) {
          return { data: null, error: updateBalanceError };
        }
      }

      // Update leave with calculated days_count
      const { error: updateError } = await this.supabase
        .from('leaves')
        .update({ 
          ...updates,
          days_count: newLeaveDays
        })
        .eq('id', leaveId);

      if (updateError) {
        return { data: null, error: updateError };
      }

      return { data: { success: true }, error: null };
    } finally {
      this.loadingService.hide();
    }
  }

  // Get user leave statistics for a specific calendar year
  async getUserLeaveStats(userId: string, year: number) {
    this.loadingService.show();
    try {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      // Get all leaves for the year
      const { data: leaves, error } = await this.supabase
        .from('leaves')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startOfYear)
        .lte('start_date', endOfYear);

      if (error) {
        return { data: null, error };
      }

      // Calculate statistics
      const stats = {
        totalApplied: leaves?.length || 0,
        pending: leaves?.filter(l => l.status === 'PENDING').length || 0,
        approved: leaves?.filter(l => l.status === 'APPROVED').length || 0,
        rejected: leaves?.filter(l => l.status === 'REJECTED').length || 0,
        cancelled: leaves?.filter(l => l.status === 'CANCELLED').length || 0,
        casualLeaves: leaves?.filter(l => l.type === 'CASUAL' && l.status === 'APPROVED').reduce((sum, l) => sum + (l.days_count || 0), 0) || 0,
        medicalLeaves: leaves?.filter(l => l.type === 'MEDICAL' && l.status === 'APPROVED').reduce((sum, l) => sum + (l.days_count || 0), 0) || 0,
        compOffLeaves: leaves?.filter(l => l.type === 'COMP_OFF' && l.status === 'APPROVED').reduce((sum, l) => sum + (l.days_count || 0), 0) || 0,
        totalDaysTaken: leaves?.filter(l => l.status === 'APPROVED').reduce((sum, l) => sum + (l.days_count || 0), 0) || 0
      };

      return { data: stats, error: null };
    } finally {
      this.loadingService.hide();
    }
  }

  // Get all users with their leave statistics (for HR/Admin)
  async getAllUsersLeaveStats(organizationId: string, year: number) {
    this.loadingService.show();
    try {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      // Get all users in the organization
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id, full_name, email, balance_casual, balance_medical, organization_id')
        .eq('organization_id', organizationId);

      if (usersError) {
        return { data: null, error: usersError };
      }

      // Get all leaves for the year for these users
      const userIds = users?.map(u => u.id) || [];
      if (userIds.length === 0) {
        return { data: [], error: null };
      }

      const { data: leaves, error: leavesError } = await this.supabase
        .from('leaves')
        .select('*')
        .in('user_id', userIds)
        .gte('start_date', startOfYear)
        .lte('start_date', endOfYear);

      if (leavesError) {
        return { data: null, error: leavesError };
      }

      // Calculate stats for each user
      const userStats = users?.map(user => {
        const userLeaves = leaves?.filter(l => l.user_id === user.id) || [];
        const approvedLeaves = userLeaves.filter(l => l.status === 'APPROVED');
        
        return {
          ...user,
          totalApplied: userLeaves.length,
          pending: userLeaves.filter(l => l.status === 'PENDING').length,
          approved: approvedLeaves.length,
          rejected: userLeaves.filter(l => l.status === 'REJECTED').length,
          cancelled: userLeaves.filter(l => l.status === 'CANCELLED').length,
          casualLeavesTaken: approvedLeaves.filter(l => l.type === 'CASUAL').reduce((sum, l) => sum + (l.days_count || 0), 0),
          medicalLeavesTaken: approvedLeaves.filter(l => l.type === 'MEDICAL').reduce((sum, l) => sum + (l.days_count || 0), 0),
          compOffLeavesTaken: approvedLeaves.filter(l => l.type === 'COMP_OFF').reduce((sum, l) => sum + (l.days_count || 0), 0),
          totalDaysTaken: approvedLeaves.reduce((sum, l) => sum + (l.days_count || 0), 0),
          remainingCasual: user.balance_casual || 0,
          remainingMedical: user.balance_medical || 0
        };
      }) || [];

      return { data: userStats, error: null };
    } finally {
      this.loadingService.hide();
    }
  }

  // Get comp off balance for a user
  async getUserCompOffBalance(userId: string) {
    this.loadingService.show();
    try {
      const { data: compOffsWithDays } = await this.supabase
        .from('user_comp_offs')
        .select('*, comp_offs(days)')
        .eq('user_id', userId)
        .eq('is_consumed', false);

      const balance = compOffsWithDays?.reduce((sum: number, item: any) => {
        return sum + (item.comp_offs?.days || 0);
      }, 0) || 0;

      return { data: balance, error: null };
    } finally {
      this.loadingService.hide();
    }
  }
}
