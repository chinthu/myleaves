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
        // Create New User (Requires Admin API or Supabase Function usually, but we'll try client-side signup for MVP if allowed, otherwise we need a backend function)
        // NOTE: Client-side signUp signs in the user immediately, which is not what we want for an Admin creating a user.
        // Ideally, we should use a Supabase Edge Function or Admin API.
        // For this MVP, we will simulate it by inserting into public.users and assuming the auth user is created separately or we use a workaround.
        // Workaround: We can't create Auth user from client side without logging out.
        // So, we will just insert into public.users and let the user sign up themselves? No, that breaks the flow.
        // We will use a placeholder message here.

        // REAL IMPLEMENTATION: Call a Supabase Edge Function `create-user`
        // For now, I'll throw an error explaining this limitation or just insert into public.users if Auth is handled externally.

        // Let's try to just insert into public.users for now to show the UI working, 
        // but in reality, we need the Auth ID.

        throw new Error('Creating new users requires a backend function (Supabase Admin API). For this demo, please manually create the user in Supabase Auth and then they will appear here once they log in.');
      }

      this.loadUsers();
      setTimeout(() => this.closeModal(), 1500);

    } catch (err: any) {
      this.error = err.message || 'Operation failed.';
    } finally {
      this.loading = false;
    }
  }
}
