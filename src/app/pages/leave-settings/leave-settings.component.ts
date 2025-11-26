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
import { CheckboxModule } from 'primeng/checkbox';
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
    ConfirmDialogModule,
    CheckboxModule
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
    year: new Date().getFullYear(),
    carry_forward_enabled: false,
    year_end_processed: false
  };

  // Year-end processing
  isFirstWeekOfJanuary = false;
  canProcessYearEnd = false;

  // Organization Management (Super Admin)
  organizations: any[] = [];
  selectedOrgId: string | null = null;
  isSuperAdmin = false;
  isAdmin = false;
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
    this.checkIfFirstWeekOfJanuary();
    
    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (userProfile) => {
        if (userProfile) {
          this.user = userProfile;
          this.isSuperAdmin = this.user.role === 'SUPER_ADMIN';
          this.isAdmin = this.user.role === 'ADMIN';

          if (this.isSuperAdmin) {
            await this.loadOrganizations();
            this.selectedOrgId = this.user.organization_id || (this.organizations.length > 0 ? this.organizations[0].id : null);
          } else {
            this.selectedOrgId = this.user.organization_id;
          }

          if (this.selectedOrgId) {
            await this.loadSettings();
            await this.loadCarryForwardSetting(); // Load carry-forward setting from previous year if in first week
            await this.checkCanProcessYearEnd();
          }
        }
      });
  }

  checkIfFirstWeekOfJanuary() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const janFirst = new Date(currentYear, 0, 1); // January 1st
    const janEighth = new Date(currentYear, 0, 8); // January 8th
    
    // Check if current date is between Jan 1 and Jan 7 (first week)
    this.isFirstWeekOfJanuary = now >= janFirst && now < janEighth;
  }

  async checkCanProcessYearEnd() {
    if (!this.isFirstWeekOfJanuary || !this.selectedOrgId) {
      this.canProcessYearEnd = false;
      return;
    }
    
    const previousYear = this.settings.year - 1;
    
    // Check if year-end processing has been done for the previous year
    // Since settings are now one per organization, we check the archives table
    // to see if any archives exist for the previous year
    try {
      const { data: archives, error } = await this.supabase
        .from('leave_archives')
        .select('id')
        .eq('organization_id', this.selectedOrgId)
        .eq('year', previousYear)
        .limit(1);

      // If archives exist for the previous year, year-end has been processed
      // If no archives exist, year-end processing can be done
      this.canProcessYearEnd = !archives || archives.length === 0;
    } catch (error: any) {
      console.error('Error checking year-end processing status:', error);
      // On error, allow processing (safer to allow than block)
      this.canProcessYearEnd = true;
    }
  }

  async loadCarryForwardSetting() {
    // Settings are now one per organization, so carry-forward is loaded with the main settings
    // This method is kept for compatibility but the setting is already loaded in loadSettings()
    // No separate call needed since settings are not year-specific anymore
  }

  async loadOrganizations() {
    const { data } = await this.supabase
      .from('organizations')
      .select('id, name')
      .order('name');
    this.organizations = data || [];
  }

  async onOrgChange() {
    if (this.selectedOrgId) {
      await this.loadSettings();
    }
  }

  async loadSettings() {
    this.loading = true;
    try {
      const { data, error } = await this.supabase
        .from('leave_settings')
        .select('*')
        .eq('organization_id', this.selectedOrgId)
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
          year: new Date().getFullYear(), // Always use current year
          carry_forward_enabled: false,
          year_end_processed: false
        };
      } else if (data) {
        // Settings are one per organization, but year should always be current year
        // (year field is kept for reference but not used in unique constraint)
        this.settings = {
          ...data,
          year: new Date().getFullYear() // Always use current year
        };
      } else {
        // Reset to defaults if no record found
        this.settings = {
          default_casual_leaves: 12,
          default_medical_leaves: 12,
          year: new Date().getFullYear(), // Always use current year
          carry_forward_enabled: false,
          year_end_processed: false
        };
      }
      
      // Settings are now loaded (one per organization, not per year)
      // Note: checkCanProcessYearEnd() is called separately after loadSettings() to avoid duplicate calls
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
        default_casual_leaves: this.settings.default_casual_leaves,
        default_medical_leaves: this.settings.default_medical_leaves
        // Note: carry_forward_enabled is saved separately via toggleCarryForward()
        // Note: year field is kept for reference but not used in unique constraint
      };

      // Check if exists (one per organization)
      const { data: existing } = await this.supabase
        .from('leave_settings')
        .select('id')
        .eq('organization_id', this.selectedOrgId)
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

  async toggleCarryForward() {
    if (!this.selectedOrgId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Error',
        detail: 'Please select an organization first.'
      });
      return;
    }

    // Only Admin and Super Admin can toggle carry-forward
    if (!this.isAdmin && !this.isSuperAdmin) {
      this.messageService.add({
        severity: 'error',
        summary: 'Access Denied',
        detail: 'Only Admin and Super Admin can enable/disable carry-forward.'
      });
      return;
    }

    const action = this.settings.carry_forward_enabled ? 'disable' : 'enable';
    this.confirmationService.confirm({
      message: `Are you sure you want to ${action} carry forward? This will affect how leaves are handled during year-end processing.`,
      header: `${action === 'enable' ? 'Enable' : 'Disable'} Carry Forward`,
      icon: 'pi pi-question-circle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: async () => {
        await this.saveCarryForwardSetting();
        // Reload settings after saving
        await this.loadSettings();
      }
    });
  }

  async saveCarryForwardSetting() {
    if (!this.selectedOrgId) return;

    this.loading = true;
    try {
      // Settings are now one per organization (not per year)
      // Check if settings exist for this organization
      const { data: existing } = await this.supabase
        .from('leave_settings')
        .select('id, default_casual_leaves, default_medical_leaves')
        .eq('organization_id', this.selectedOrgId)
        .single();

      // Get default values from existing settings or use current settings
      const defaultCasual = existing?.default_casual_leaves || this.settings.default_casual_leaves || 12;
      const defaultMedical = existing?.default_medical_leaves || this.settings.default_medical_leaves || 12;

      const newCarryForwardValue = !this.settings.carry_forward_enabled; // Toggle

      let error;
      if (existing) {
        const { error: updateError } = await this.supabase
          .from('leave_settings')
          .update({ carry_forward_enabled: newCarryForwardValue })
          .eq('id', existing.id);
        error = updateError;
      } else {
        // If no settings exist, create new record
        const payload = {
          organization_id: this.selectedOrgId,
          default_casual_leaves: defaultCasual,
          default_medical_leaves: defaultMedical,
          carry_forward_enabled: newCarryForwardValue
        };
        const { error: insertError } = await this.supabase
          .from('leave_settings')
          .insert(payload);
        error = insertError;
      }

      if (error) throw error;

      // Update the displayed setting
      this.settings.carry_forward_enabled = newCarryForwardValue;
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: `Carry forward ${newCarryForwardValue ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to update carry forward setting'
      });
    } finally {
      this.loading = false;
    }
  }

  async processYearEnd() {
    if (!this.selectedOrgId || !this.canProcessYearEnd) {
      return;
    }

    // Settings are now one per organization, so use the current carry-forward setting
    const previousYear = this.settings.year - 1;
    const carryForwardEnabled = this.settings.carry_forward_enabled || false;

    this.confirmationService.confirm({
      message: `Are you sure you want to process year-end for ${previousYear}? This will:\n\n1. Archive all leaves from ${previousYear}\n2. ${carryForwardEnabled ? 'Carry forward remaining casual leaves and add new annual quota (medical leaves will reset to default)' : 'Reset to new annual quota only'}\n3. Lock all previous year's leaves (non-editable)\n\nThis action CANNOT be undone!`,
      header: 'Process Year-End',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: async () => {
        await this.performYearEndProcessing(carryForwardEnabled);
      }
    });
  }

  async performYearEndProcessing(carryForwardEnabled: boolean = false) {
    if (!this.selectedOrgId) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please select an organization' });
      return;
    }

    this.loading = true;
    this.loadingService.show();

    try {
      const previousYear = this.settings.year - 1;
      const currentYear = this.settings.year;
      const startOfPreviousYear = `${previousYear}-01-01`;
      const endOfPreviousYear = `${previousYear}-12-31`;

      // Step 1: Get all users in the organization
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id, balance_casual, balance_medical, balance_compoff')
        .eq('organization_id', this.selectedOrgId);

      if (usersError) throw usersError;
      if (!users || users.length === 0) {
        this.messageService.add({ severity: 'warn', summary: 'No Users', detail: 'No users found in this organization' });
        return;
      }

      // Step 2: For each user, archive their previous year's data
      for (const user of users) {
        // Get all leaves for the previous year
        const { data: previousYearLeaves, error: leavesError } = await this.supabase
          .from('leaves')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_date', startOfPreviousYear)
          .lte('start_date', endOfPreviousYear);

        if (leavesError) {
          console.error(`Error fetching leaves for user ${user.id}:`, leavesError);
          continue;
        }

        // Calculate statistics
        const approvedLeaves = previousYearLeaves?.filter(l => l.status === 'APPROVED') || [];
        const casualTaken = approvedLeaves.filter(l => l.type === 'CASUAL').reduce((sum, l) => sum + (l.days_count || 0), 0);
        const medicalTaken = approvedLeaves.filter(l => l.type === 'MEDICAL').reduce((sum, l) => sum + (l.days_count || 0), 0);
        const compOffTaken = approvedLeaves.filter(l => l.type === 'COMP_OFF').reduce((sum, l) => sum + (l.days_count || 0), 0);
        const totalDaysTaken = approvedLeaves.reduce((sum, l) => sum + (l.days_count || 0), 0);

        // Create archive record
        const archiveData = {
          user_id: user.id,
          organization_id: this.selectedOrgId,
          year: previousYear,
          total_leaves_applied: previousYearLeaves?.length || 0,
          total_leaves_approved: approvedLeaves.length,
          total_leaves_pending: previousYearLeaves?.filter(l => l.status === 'PENDING').length || 0,
          total_leaves_rejected: previousYearLeaves?.filter(l => l.status === 'REJECTED').length || 0,
          total_leaves_cancelled: previousYearLeaves?.filter(l => l.status === 'CANCELLED').length || 0,
          casual_leaves_taken: casualTaken,
          medical_leaves_taken: medicalTaken,
          comp_off_leaves_taken: compOffTaken,
          total_days_taken: totalDaysTaken,
          balance_casual_at_year_end: user.balance_casual || 0,
          balance_medical_at_year_end: user.balance_medical || 0,
          balance_compoff_at_year_end: user.balance_compoff || 0,
          carry_forward_casual: this.settings.carry_forward_enabled ? (user.balance_casual || 0) : 0,
          carry_forward_medical: 0 // Medical leaves are never carried forward
        };

        // Upsert archive (insert or update if exists)
        const { error: archiveError } = await this.supabase
          .from('leave_archives')
          .upsert(archiveData, { onConflict: 'user_id,organization_id,year' });

        if (archiveError) {
          console.error(`Error archiving for user ${user.id}:`, archiveError);
          continue;
        }

        // Step 3: Mark all previous year leaves as archived
        if (previousYearLeaves && previousYearLeaves.length > 0) {
          const leaveIds = previousYearLeaves.map(l => l.id);
          const { error: archiveLeavesError } = await this.supabase
            .from('leaves')
            .update({ is_archived: true, archived_at: new Date().toISOString() })
            .in('id', leaveIds);

          if (archiveLeavesError) {
            console.error(`Error archiving leaves for user ${user.id}:`, archiveLeavesError);
          }
        }

        // Step 4: Update user balances for new year
        const defaultCasual = this.settings.default_casual_leaves || 12;
        const defaultMedical = this.settings.default_medical_leaves || 12;

        let newCasualBalance = defaultCasual;
        let newMedicalBalance = defaultMedical; // Medical always resets to default

        if (this.settings.carry_forward_enabled) {
          // Only carry forward casual leaves, medical always resets to default
          newCasualBalance = defaultCasual + Math.max(0, user.balance_casual || 0);
        }

        const { error: updateError } = await this.supabase
          .from('users')
          .update({
            balance_casual: newCasualBalance,
            balance_medical: newMedicalBalance,
            balance_compoff: 0 // Reset comp off at year end
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`Error updating user ${user.id}:`, updateError);
        }
      }

      // Step 5: Mark year-end processing as complete
      // Update the year_end_processed flag in settings (one per organization)
      // Note: We still check archives to determine if a specific year has been processed
      const { error: updateSettingsError } = await this.supabase
        .from('leave_settings')
        .update({
          year_end_processed: true,
          year_end_processed_at: new Date().toISOString()
        })
        .eq('organization_id', this.selectedOrgId);

      if (updateSettingsError) {
        console.error('Error updating year_end_processed flag:', updateSettingsError);
        // Don't fail the whole operation if this update fails
      }

      // Reload settings and check if year-end processing can still be done
      await this.loadSettings();
      await this.checkCanProcessYearEnd();

      this.messageService.add({
        severity: 'success',
        summary: 'Year-End Processing Complete',
        detail: `Successfully processed year-end for ${previousYear}. All leaves have been archived. ${this.settings.carry_forward_enabled ? 'Casual leaves have been carried forward and added to new annual quota. Medical leaves reset to default.' : 'All user balances have been reset to default annual quota.'}`
      });
    } catch (error: any) {
      console.error('Year-end processing error:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to process year-end'
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
