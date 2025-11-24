import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
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

  constructor(private authService: AuthService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(async (u) => {
      if (u) {
        this.currentUser = await this.authService.getUserProfile();
        if (this.currentUser && this.currentUser.organization_id) {
          this.formData.organization_id = this.currentUser.organization_id;
          this.loadUsers();
        }
      }
    });
  }

  async loadUsers() {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('organization_id', this.currentUser.organization_id)
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
        // IMPORTANT: signUp() will log in the new user, so we need to save the current admin session first

        // Step 1: Get current admin session
        const { data: { session: adminSession } } = await this.supabase.auth.getSession();

        if (!adminSession) {
          throw new Error('Admin session not found. Please login again.');
        }

        // Step 2: Create the new user (this will log them in automatically)
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

        // Step 4: Update the newly created user's profile with role and designation
        if (authData.user) {
          // Wait a bit for the trigger to create the user record
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Update the user record with admin-specified role and designation
          const { error: updateError } = await this.supabase
            .from('users')
            .update({
              role: this.formData.role,
              designation: this.formData.designation,
              balance_casual: 20, // Default casual leave balance
              balance_medical: 12  // Default medical leave balance
            })
            .eq('id', authData.user.id);

          if (updateError) throw updateError;

          this.message = 'User created successfully! They can now login with their email and password.';
        }
      }

      this.loadUsers();
      setTimeout(() => this.closeModal(), 2000);

    } catch (err: any) {
      this.error = err.message || 'Operation failed.';
    } finally {
      this.loading = false;
    }
  }
}
