import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';

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
    DropdownModule,
    ToastModule,
    TagModule
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
  private destroy$ = new Subject<void>();

  roles = [
    { label: 'User', value: 'USER' },
    { label: 'Approver', value: 'APPROVER' },
    { label: 'HR Manager', value: 'HR' },
    { label: 'Admin', value: 'ADMIN' }
  ];

  getRoleSeverity(role: string): "success" | "info" | "warning" | "danger" | "secondary" | "contrast" | undefined {
    switch (role) {
      case 'ADMIN': return 'danger';
      case 'HR': return 'warning';
      case 'APPROVER': return 'info';
      case 'SUPER_ADMIN': return 'contrast';
      default: return 'success';
    }
  }

  constructor(private authService: AuthService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (userProfile) => {
        if (userProfile) {
          this.currentUser = userProfile;
          this.isSuperAdmin = this.currentUser.role === 'SUPER_ADMIN';

          if (this.isSuperAdmin) {
            await this.loadOrganizations();
            // Default to first org or user's org
            this.selectedOrgId = this.currentUser.organization_id || (this.organizations.length > 0 ? this.organizations[0].id : null);
          } else {
            this.selectedOrgId = this.currentUser.organization_id;
          }

          if (this.selectedOrgId) {
            this.formData.organization_id = this.selectedOrgId;
            this.loadUsers();
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
      this.formData.organization_id = this.selectedOrgId;
      this.loadUsers();
    }
  }

  async loadUsers() {
    if (!this.selectedOrgId) return;

    const { data, error } = await this.supabase
      .from('users')
      .select('*, organizations(name)')
      .eq('organization_id', this.selectedOrgId)
      .order('created_at', { ascending: false });

    if (data) {
      this.users = data;
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
      setTimeout(() => this.closeModal(), 2000);

    } catch (error: any) {
      console.error('Error saving user:', error);
      this.error = error.message || 'An error occurred';
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
