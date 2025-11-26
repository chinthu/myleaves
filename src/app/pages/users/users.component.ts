import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';
import { Subject, takeUntil } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { NgSelectModule } from '@ng-select/ng-select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { LeaveService } from '../../services/leave.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
        NgSelectModule,
    ToastModule,
    TagModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit, OnDestroy {
  supabase: SupabaseClient;
  currentUser: any = null;
  users: any[] = [];

  // Modal State
  showModal = false;
  isEditing = false;

  // Form Data
  formData: any = {
    email: '',
    password: '', // Only for new users
    full_name: '',
    role: 'USER',
    designation: '',
    organization_id: ''
  };

  loading = false;
  message = '';
  error = '';

  // Organization Filtering (Super Admin)
  organizations: any[] = [];
  selectedOrgId: string | null = null;
  isSuperAdmin = false;
  isHR = false;
  isApprover = false;
  isAdmin = false;
  
  // For Approver: Get users in their approval groups
  approvalGroupIds: string[] = [];
  
  // Leave Stats View
  showLeaveStats = false;
  selectedYear: number = new Date().getFullYear();
  availableYears: any[] = [];
  userLeaveStats: any[] = [];
  loadingStats = false;
  
  private destroy$ = new Subject<void>();

  roles = [
    { label: 'User', value: 'USER' },
    { label: 'Team Lead', value: 'TEAM_LEAD' },
    { label: 'HR Manager', value: 'HR' },
    { label: 'Admin', value: 'ADMIN' },
    { label: 'CEO', value: 'CEO' }
  ];

  getRoleSeverity(role: string): "success" | "info" | "warning" | "danger" | "secondary" | "contrast" | undefined {
    switch (role) {
      case 'CEO': return 'contrast';
      case 'ADMIN': return 'danger';
      case 'HR': return 'warning';
      case 'TEAM_LEAD': return 'info';
      case 'SUPER_ADMIN': return 'contrast';
      default: return 'success';
    }
  }

  constructor(
    private authService: AuthService,
    private loadingService: LoadingService,
    private leaveService: LeaveService,
    private messageService: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    
    // Generate available years
    const currentYear = new Date().getFullYear();
    this.availableYears = [
      { label: currentYear.toString(), value: currentYear },
      { label: (currentYear - 1).toString(), value: currentYear - 1 },
      { label: (currentYear - 2).toString(), value: currentYear - 2 }
    ];
  }

  ngOnInit() {
    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (userProfile) => {
        if (userProfile) {
          this.currentUser = userProfile;
          this.isSuperAdmin = this.currentUser.role === 'SUPER_ADMIN';
          this.isHR = this.currentUser.role === 'HR';
          this.isApprover = this.currentUser.role === 'TEAM_LEAD';
          this.isAdmin = this.currentUser.role === 'ADMIN' || this.currentUser.role === 'CEO';

          if (this.isSuperAdmin) {
            await this.loadOrganizations();
            // Default to first org or user's org
            this.selectedOrgId = this.currentUser.organization_id || (this.organizations.length > 0 ? this.organizations[0].id : null);
          } else {
            this.selectedOrgId = this.currentUser.organization_id;
          }

          // For Approver: Load their approval groups
          if (this.isApprover) {
            await this.loadApprovalGroups();
          }

          // Load users if we have org ID (for HR/Admin) or if approver
          if (this.selectedOrgId || this.isApprover) {
            if (this.selectedOrgId) {
              this.formData.organization_id = this.selectedOrgId;
            }
            this.loadUsers();
          }
        }
      });
  }

  async loadApprovalGroups() {
    try {
      // Get groups where this user is a member (these are the approval groups)
      const { data: groupMembers, error } = await this.supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', this.currentUser.id);

      if (error) {
        console.error('Error loading approval groups:', error);
        return;
      }

      this.approvalGroupIds = groupMembers?.map((gm: any) => gm.group_id) || [];
    } catch (error) {
      console.error('Error loading approval groups:', error);
    }
  }

  async loadOrganizations() {
    this.loadingService.show();
    try {
      const { data } = await this.supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      this.organizations = data || [];
    } finally {
      this.loadingService.hide();
    }
  }

  onOrgChange() {
    if (this.selectedOrgId) {
      this.formData.organization_id = this.selectedOrgId;
      this.loadUsers();
    }
  }

  async loadUsers() {
    // For approver, we can load users even without selectedOrgId (they use approval groups)
    // For HR/Admin, we need selectedOrgId
    if (!this.selectedOrgId && !this.isApprover) {
      console.warn('Cannot load users: No organization ID and user is not an approver');
      return;
    }

    this.loading = true;
    this.loadingService.show();
    try {
      let query = this.supabase
        .from('users')
        .select('*, organizations(name)');

      // If Approver, filter to only show users in their approval groups
      if (this.isApprover && this.approvalGroupIds.length > 0) {
        // Get user IDs from group members
        const { data: groupMembers, error: gmError } = await this.supabase
          .from('group_members')
          .select('user_id')
          .in('group_id', this.approvalGroupIds);

        if (gmError) throw gmError;

        const userIds = groupMembers?.map((gm: any) => gm.user_id) || [];
        
        if (userIds.length > 0) {
          query = query.in('id', userIds);
        } else {
          // No users in approval groups
          this.users = [];
          this.loading = false;
          return;
        }
      } else if (this.selectedOrgId) {
        // For HR/Admin/Super Admin, filter by organization
        query = query.eq('organization_id', this.selectedOrgId);
      } else {
        // Approver with no approval groups
        this.users = [];
        this.loading = false;
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('Loaded users:', data?.length || 0, 'users');
      
      if (data) {
        this.users = data;
      } else {
        this.users = [];
      }
      this.cdr.markForCheck(); // Trigger change detection after data is loaded
    } catch (error: any) {
      console.error('Error loading users:', error);
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Error', 
        detail: error.message || 'Failed to load users' 
      });
      this.users = [];
      this.cdr.markForCheck(); // Trigger change detection on error
    } finally {
      this.loading = false;
      this.loadingService.hide();
      this.cdr.markForCheck(); // Ensure UI updates
    }
  }

  openAddModal() {
    this.isEditing = false;
    this.formData = {
      email: '',
      password: '',
      full_name: '',
      role: 'USER',
      designation: '',
      organization_id: this.currentUser.organization_id
    };
    this.showModal = true;
    this.message = '';
    this.error = '';
  }

  openEditModal(user: any) {
    this.isEditing = true;
    this.formData = { ...user };
    // Password not editable here directly in this simple flow
    this.showModal = true;
    this.message = '';
    this.error = '';
  }

  closeModal() {
    this.showModal = false;
  }

  async saveUser() {
    this.loading = true;
    this.message = '';
    this.error = '';

    try {
      if (this.isEditing) {
        // Update User Profile
        const { error } = await this.supabase
          .from('users')
          .update({
            full_name: this.formData.full_name,
            role: this.formData.role,
            designation: this.formData.designation
          })
          .eq('id', this.formData.id);

        if (error) throw error;
        this.message = 'User updated successfully!';

      } else {
        // Create New User
        // Step 1: Get current admin session
        const { data: { session: adminSession } } = await this.supabase.auth.getSession();

        if (!adminSession) {
          throw new Error('Admin session not found. Please login again.');
        }

        // Step 2: Create the new user in Auth
        const { data: authData, error: authError } = await this.authService.signUp(
          this.formData.email,
          this.formData.password,
          this.formData.full_name
        );

        if (authError) throw authError;

        // Step 3: Immediately restore admin session
        const { error: sessionError } = await this.supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token
        });

        if (sessionError) throw sessionError;

        // Step 4: Manually insert user into public.users table
        if (authData.user) {
          const { error: insertError } = await this.supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email: this.formData.email,
              full_name: this.formData.full_name,
              role: this.formData.role,
              designation: this.formData.designation,
              organization_id: this.currentUser.organization_id,
              balance_casual: 20,
              balance_medical: 12
            });

          if (insertError) {
            console.error('Error inserting user:', insertError);
            throw insertError;
          }

          this.message = 'User created successfully! They can now login with their email and password.';
        }
      }

      this.loadUsers();
      this.cdr.markForCheck(); // Trigger change detection
      setTimeout(() => this.closeModal(), 2000);

    } catch (error: any) {
      console.error('Error saving user:', error);
      this.error = error.message || 'An error occurred';
      this.cdr.markForCheck(); // Trigger change detection on error
    } finally {
      this.loading = false;
      this.cdr.markForCheck(); // Ensure UI updates
    }
  }

  async loadUserLeaveStats() {
    if (!this.selectedOrgId) return;
    
    this.loadingStats = true;
    try {
      const { data, error } = await this.leaveService.getAllUsersLeaveStats(this.selectedOrgId, this.selectedYear);
      
      if (error) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load leave statistics.' });
        return;
      }
      
      // Get comp off balances for each user
      for (const userStat of data || []) {
        const { data: compOffBalance } = await this.leaveService.getUserCompOffBalance(userStat.id);
        (userStat as any).remainingCompOffs = compOffBalance || 0;
      }
      
      this.userLeaveStats = data || [];
      this.cdr.markForCheck(); // Trigger change detection after data is loaded
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to load leave statistics.' });
      this.cdr.markForCheck(); // Trigger change detection on error
    } finally {
      this.loadingStats = false;
      this.cdr.markForCheck(); // Ensure UI updates
    }
  }

  toggleLeaveStats() {
    this.showLeaveStats = !this.showLeaveStats;
    if (this.showLeaveStats) {
      this.loadUserLeaveStats();
    }
  }

  onYearChange() {
    if (this.showLeaveStats) {
      this.loadUserLeaveStats();
    }
  }

  viewUserDashboard(user: any) {
    this.router.navigate(['/user-dashboard', user.id]);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
