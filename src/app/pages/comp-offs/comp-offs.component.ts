import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-comp-offs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TableModule,
    ButtonModule,
    DialogModule,
    CalendarModule,
    InputTextareaModule,
    DropdownModule,
    MultiSelectModule,
    TagModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './comp-offs.component.html',
  styleUrls: ['./comp-offs.component.scss']
})
export class CompOffsComponent implements OnInit {
  supabase: SupabaseClient;
  user: any = null;
  loading = false;
  compOffs: any[] = [];
  users: any[] = [];

  // Roles
  canManage = false; // HR, ADMIN, SUPER_ADMIN

  // Modal
  showModal = false;
  isEditing = false;
  formData: any = {
    id: null,
    user_ids: [], // Changed to array for multi-select
    work_date: null,
    reason: ''
  };

  constructor(
    private authService: AuthService,
    private messageService: MessageService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async ngOnInit() {
    this.user = await this.authService.getUserProfile();
    if (this.user) {
      this.canManage = ['HR', 'ADMIN', 'SUPER_ADMIN'].includes(this.user.role);
      if (this.canManage) {
        await this.loadUsers();
      }
      this.loadCompOffs();
    }
  }

  async loadUsers() {
    const { data } = await this.supabase
      .from('users')
      .select('id, full_name, email')
      .eq('organization_id', this.user.organization_id)
      .order('full_name');
    this.users = data || [];
  }

  async loadCompOffs() {
    this.loading = true;
    try {
      let query = this.supabase
        .from('user_comp_offs')
        .select('*, users!user_comp_offs_user_id_fkey(full_name, email)')
        .order('work_date', { ascending: false });

      if (!this.canManage) {
        query = query.eq('user_id', this.user.id);
      } else {
        query = query.eq('organization_id', this.user.organization_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      this.compOffs = data || [];
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message });
    } finally {
      this.loading = false;
    }
  }

  openAddModal() {
    this.isEditing = false;
    this.formData = {
      id: null,
      user_ids: [],
      work_date: null,
      reason: ''
    };
    this.showModal = true;
  }

  openEditModal(compOff: any) {
    this.isEditing = true;
    this.formData = {
      id: compOff.id,
      user_ids: [compOff.user_id], // Wrap single user in array for compatibility, though edit usually implies single record
      work_date: new Date(compOff.work_date),
      reason: compOff.reason
    };
    this.showModal = true;
  }

  async saveCompOff() {
    if ((!this.formData.user_ids || this.formData.user_ids.length === 0) || !this.formData.work_date || !this.formData.reason) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please fill all fields' });
      return;
    }

    this.loading = true;
    try {
      if (this.isEditing) {
        // Update existing (Single record update)
        // Note: We don't allow changing the user in edit mode usually, but if we did, it would be complex.
        // Assuming edit is for date/reason only for the specific record.
        const { error } = await this.supabase
          .from('user_comp_offs')
          .update({
            work_date: this.formData.work_date,
            reason: this.formData.reason
          })
          .eq('id', this.formData.id);

        if (error) throw error;
        this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Comp-off updated successfully' });

      } else {
        // Create new (Bulk insert)
        const userIds = this.formData.user_ids;
        const inserts = userIds.map((uid: string) => ({
          user_id: uid,
          organization_id: this.user.organization_id,
          work_date: this.formData.work_date,
          reason: this.formData.reason,
          created_by: this.user.id
        }));

        const { error } = await this.supabase
          .from('user_comp_offs')
          .insert(inserts);

        if (error) throw error;

        // Increment User Balance for ALL selected users
        for (const uid of userIds) {
          await this.updateUserBalance(uid, 1);
        }

        this.messageService.add({ severity: 'success', summary: 'Added', detail: `${userIds.length} Comp-off(s) added and balances updated` });
      }

      this.showModal = false;
      this.loadCompOffs();
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message });
    } finally {
      this.loading = false;
    }
  }

  async deleteCompOff(compOff: any) {
    if (!confirm('Are you sure? This will remove the comp-off and deduct 1 day from the user\'s balance.')) return;

    this.loading = true;
    try {
      const { error } = await this.supabase
        .from('user_comp_offs')
        .delete()
        .eq('id', compOff.id);

      if (error) throw error;

      // Decrement User Balance
      await this.updateUserBalance(compOff.user_id, -1);

      this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Comp-off removed and balance updated' });
      this.loadCompOffs();
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message });
    } finally {
      this.loading = false;
    }
  }

  async updateUserBalance(userId: string, change: number) {
    const { data: userData } = await this.supabase
      .from('users')
      .select('balance_compoff')
      .eq('id', userId)
      .single();

    const newBalance = (userData?.balance_compoff || 0) + change;

    await this.supabase
      .from('users')
      .update({ balance_compoff: newBalance })
      .eq('id', userId);
  }

  getStatusSeverity(status: string): "success" | "info" | "warning" | "danger" | "secondary" | "contrast" | undefined {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'PENDING': return 'warning';
      default: return 'info';
    }
  }
}
