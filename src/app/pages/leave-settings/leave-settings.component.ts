import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { NgSelectModule } from '@ng-select/ng-select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { LoadingService } from '../../services/loading.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
        NgSelectModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './leave-settings.component.html',
  styleUrls: ['./leave-settings.component.scss']
})
export class LeaveSettingsComponent implements OnInit, OnDestroy {
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
  private destroy$ = new Subject<void>();

  years = [
    { label: '2024', value: 2024 },
    { label: '2025', value: 2025 },
    { label: '2026', value: 2026 }
  ];

  constructor(
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private loadingService: LoadingService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (userProfile) => {
        if (userProfile) {
          this.user = userProfile;
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
      });
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

      if (error) {
        // If table doesn't exist, show helpful error
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.error('leave_settings table does not exist. Please run the schema migration.');
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Database Error', 
            detail: 'The leave_settings table does not exist. Please run the SQL migration from leave_settings_schema.sql in your Supabase SQL editor.' 
          });
        }
        // Reset to defaults if no record found (not an error, just no data)
        this.settings = {
          default_casual_leaves: 12,
          default_medical_leaves: 12,
          year: this.settings.year
        };
      } else if (data) {
        this.settings = data;
      } else {
        // Reset to defaults if no record found
        this.settings = {
          default_casual_leaves: 12,
          default_medical_leaves: 12,
          year: this.settings.year
        };
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Database Error', 
          detail: 'The leave_settings table does not exist. Please run the SQL migration from leave_settings_schema.sql in your Supabase SQL editor.' 
        });
      }
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

      if (error) {
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          throw new Error('The leave_settings table does not exist. Please run the SQL migration from leave_settings_schema.sql in your Supabase SQL editor.');
        }
        throw error;
      }

      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Settings saved successfully' });
      // Reload settings after save
      await this.loadSettings();
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to save settings' });
    } finally {
      this.loading = false;
    }
  }

  async bulkUpdateUsers() {
    this.confirmationService.confirm({
      message: 'Are you sure you want to reset all leaves and balances for ALL users in this organization? This will:\n\n1. Delete ALL leaves (pending, approved, cancelled)\n2. Reset all leave balances to default values\n\nThis action CANNOT be undone!',
      header: 'Reset All Leaves and Balances',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.performReset();
      }
    });
  }

  async performReset() {
    if (!this.selectedOrgId) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please select an organization' });
      return;
    }

    this.loading = true;
    this.loadingService.show();
    
    try {
      // Step 1: Reload settings for the selected year to ensure we have the latest values
      await this.loadSettings();

      // Step 2: Get all user IDs in the organization
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id')
        .eq('organization_id', this.selectedOrgId);

      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        this.messageService.add({ severity: 'warn', summary: 'No Users', detail: 'No users found in this organization' });
        return;
      }

      const userIds = users.map(u => u.id);

      // Step 3: Delete all leaves for these users
      const { error: leavesError } = await this.supabase
        .from('leaves')
        .delete()
        .in('user_id', userIds);

      if (leavesError) throw leavesError;

      // Step 4: Reset all user balances to default values from leave settings
      const defaultCasual = this.settings.default_casual_leaves || 12;
      const defaultMedical = this.settings.default_medical_leaves || 12;
      
      // Update all users in the organization
      // Note: This requires an RLS policy that allows HR/ADMIN/SUPER_ADMIN to update users in their organization
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          balance_casual: defaultCasual,
          balance_medical: defaultMedical,
          balance_compoff: 0
        })
        .eq('organization_id', this.selectedOrgId);

      if (updateError) {
        // If bulk update fails due to RLS, try updating individually
        console.warn('Bulk update failed, trying individual updates:', updateError);
        let updateErrors: any[] = [];
        let successCount = 0;
        
        for (const userId of userIds) {
          const { error: individualError } = await this.supabase
            .from('users')
            .update({
              balance_casual: defaultCasual,
              balance_medical: defaultMedical,
              balance_compoff: 0
            })
            .eq('id', userId);

          if (individualError) {
            console.error(`Error updating user ${userId}:`, individualError);
            updateErrors.push({ userId, error: individualError });
          } else {
            successCount++;
          }
        }

        if (updateErrors.length > 0) {
          throw new Error(`Failed to update ${updateErrors.length} user(s). ${successCount} user(s) updated successfully. This may be due to RLS policies. Please ensure HR/ADMIN/SUPER_ADMIN have permission to update users in their organization.`);
        }
      }

      this.messageService.add({ 
        severity: 'success', 
        summary: 'Reset Complete', 
        detail: `Successfully deleted all leaves and reset balances for ${users.length} user(s) in this organization for year ${this.settings.year}.` 
      });
    } catch (error: any) {
      console.error('Reset error:', error);
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Error', 
        detail: error.message || 'Failed to reset leaves and balances' 
      });
    } finally {
      this.loading = false;
      this.loadingService.hide();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
