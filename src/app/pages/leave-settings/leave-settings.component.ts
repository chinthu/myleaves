import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'app-leave-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    CardModule,
    ButtonModule,
    InputNumberModule,
    DropdownModule
  ],
  providers: [MessageService],
  templateUrl: './leave-settings.component.html',
  styleUrls: ['./leave-settings.component.scss']
})
export class LeaveSettingsComponent implements OnInit {
  supabase: SupabaseClient;
  user: any = null;
  loading = false;

  // Settings Data
  settings: any = {
    default_casual_leaves: 12,
    default_medical_leaves: 12,
    year: new Date().getFullYear()
  };

  // Organization Management (Super Admin)
  organizations: any[] = [];
  selectedOrgId: string | null = null;
  isSuperAdmin = false;

  years = [
    { label: '2024', value: 2024 },
    { label: '2025', value: 2025 },
    { label: '2026', value: 2026 }
  ];

  constructor(
    private authService: AuthService,
    private messageService: MessageService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async ngOnInit() {
    this.user = await this.authService.getUserProfile();
    if (this.user) {
      this.isSuperAdmin = this.user.role === 'SUPER_ADMIN';

      if (this.isSuperAdmin) {
        await this.loadOrganizations();
        this.selectedOrgId = this.user.organization_id || (this.organizations.length > 0 ? this.organizations[0].id : null);
      } else {
        this.selectedOrgId = this.user.organization_id;
      }

      if (this.selectedOrgId) {
        this.loadSettings();
      }
    }
  }

  async loadOrganizations() {
    const { data } = await this.supabase
      .from('organizations')
      .select('id, name')
      .order('name');
    this.organizations = data || [];
  }

  onOrgChange() {
    if (this.selectedOrgId) {
      this.loadSettings();
    }
  }

  async loadSettings() {
    this.loading = true;
    try {
      const { data, error } = await this.supabase
        .from('leave_settings')
        .select('*')
        .eq('organization_id', this.selectedOrgId)
        .eq('year', this.settings.year)
        .single();

      if (data) {
        this.settings = data;
      } else {
        // Reset to defaults if no record found
        this.settings = {
          default_casual_leaves: 12,
          default_medical_leaves: 12,
          year: this.settings.year
        };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      this.loading = false;
    }
  }

  async saveSettings() {
    this.loading = true;
    try {
      const payload = {
        organization_id: this.selectedOrgId,
        year: this.settings.year,
        default_casual_leaves: this.settings.default_casual_leaves,
        default_medical_leaves: this.settings.default_medical_leaves
      };

      // Check if exists
      const { data: existing } = await this.supabase
        .from('leave_settings')
        .select('id')
        .eq('organization_id', this.selectedOrgId)
        .eq('year', this.settings.year)
        .single();

      let error;
      if (existing) {
        const { error: updateError } = await this.supabase
          .from('leave_settings')
          .update(payload)
          .eq('id', existing.id);
        error = updateError;
      } else {
        const { error: insertError } = await this.supabase
          .from('leave_settings')
          .insert(payload);
        error = insertError;
      }

      if (error) throw error;

      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Settings saved successfully' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message });
    } finally {
      this.loading = false;
    }
  }

  async bulkUpdateUsers() {
    if (!confirm('Are you sure? This will reset leave balances for ALL users in this organization to the current default values. This cannot be undone.')) {
      return;
    }

    this.loading = true;
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          balance_casual: this.settings.default_casual_leaves,
          balance_medical: this.settings.default_medical_leaves
        })
        .eq('organization_id', this.selectedOrgId);

      if (error) throw error;

      this.messageService.add({ severity: 'success', summary: 'Bulk Update Complete', detail: 'All users have been updated to new defaults.' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message });
    } finally {
      this.loading = false;
    }
  }
}
