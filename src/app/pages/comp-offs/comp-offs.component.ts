import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-comp-offs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comp-offs.component.html',
  styleUrls: ['./comp-offs.component.css']
})
export class CompOffsComponent implements OnInit {
  supabase: SupabaseClient;
  user: any = null;
  users: any[] = [];

  // Form Data
  title: string = '';
  description: string = '';
  days: number = 1;
  selectedUserIds: string[] = [];

  loading = false;
  message = '';
  error = '';

  constructor(private authService: AuthService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(async (u) => {
      if (u) {
        this.user = await this.authService.getUserProfile();
        if (this.user && this.user.organization_id) {
          this.loadUsers(this.user.organization_id);
        }
      }
    });
  }

  async loadUsers(orgId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, full_name, email')
      .eq('organization_id', orgId);

    if (data) {
      this.users = data;
    }
  }

  toggleUserSelection(userId: string) {
    const index = this.selectedUserIds.indexOf(userId);
    if (index > -1) {
      this.selectedUserIds.splice(index, 1);
    } else {
      this.selectedUserIds.push(userId);
    }
  }

  async createCompOff() {
    this.loading = true;
    this.message = '';
    this.error = '';

    try {
      if (!this.title || this.days <= 0 || this.selectedUserIds.length === 0) {
        throw new Error('Please fill all required fields and select at least one user.');
      }

      // 1. Create Comp Off Record
      const { data: compOffData, error: compOffError } = await this.supabase
        .from('comp_offs')
        .insert({
          title: this.title,
          description: this.description,
          days: this.days,
          created_by: this.user.id
        })
        .select()
        .single();

      if (compOffError) throw compOffError;

      // 2. Assign to Users
      const userCompOffs = this.selectedUserIds.map(uid => ({
        comp_off_id: compOffData.id,
        user_id: uid,
        is_consumed: false
      }));

      const { error: assignError } = await this.supabase
        .from('user_comp_offs')
        .insert(userCompOffs);

      if (assignError) throw assignError;

      // 3. Update User Balances (Optional, depending on if we track comp off balance separately or just list them)
      // For now, let's assume we just track them in user_comp_offs. 
      // If we wanted to update a 'balance_comp_off' column in users table, we would do it here.

      this.message = 'Comp Off created and assigned successfully!';
      this.resetForm();

    } catch (err: any) {
      this.error = err.message || 'Failed to create comp off.';
    } finally {
      this.loading = false;
    }
  }

  resetForm() {
    this.title = '';
    this.description = '';
    this.days = 1;
    this.selectedUserIds = [];
  }
}
