import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.css']
})
export class GroupsComponent implements OnInit {
  supabase: SupabaseClient;
  currentUser: any = null;
  groups: any[] = [];
  users: any[] = [];

  // Modal State
  showModal = false;
  isEditing = false;

  // Form Data
  formData: any = {
    name: '',
    organization_id: ''
  };

  // Members Management
  selectedGroup: any = null;
  showMembersModal = false;
  groupMembers: any[] = [];
  nonMembers: any[] = [];

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
          this.loadGroups();
          this.loadUsers();
        }
      }
    });
  }

  async loadGroups() {
    const { data, error } = await this.supabase
      .from('groups')
      .select('*')
      .eq('organization_id', this.currentUser.organization_id)
      .order('name');

    if (data) {
      this.groups = data;
    }
  }

  async loadUsers() {
    const { data } = await this.supabase
      .from('users')
      .select('id, full_name, email')
      .eq('organization_id', this.currentUser.organization_id);

    if (data) {
      this.users = data;
    }
  }

  // --- Group CRUD ---

  openAddModal() {
    this.isEditing = false;
    this.formData = {
      name: '',
      organization_id: this.currentUser.organization_id
    };
    this.showModal = true;
    this.message = '';
    this.error = '';
  }

  openEditModal(group: any) {
    this.isEditing = true;
    this.formData = { ...group };
    this.showModal = true;
    this.message = '';
    this.error = '';
  }

  closeModal() {
    this.showModal = false;
  }

  async saveGroup() {
    this.loading = true;
    this.message = '';
    this.error = '';

    try {
      if (this.isEditing) {
        const { error } = await this.supabase
          .from('groups')
          .update({ name: this.formData.name })
          .eq('id', this.formData.id);
        if (error) throw error;
        this.message = 'Group updated successfully!';
      } else {
        const { error } = await this.supabase
          .from('groups')
          .insert(this.formData);
        if (error) throw error;
        this.message = 'Group created successfully!';
      }

      this.loadGroups();
      setTimeout(() => this.closeModal(), 1500);

    } catch (err: any) {
      this.error = err.message || 'Operation failed.';
    } finally {
      this.loading = false;
    }
  }

  // --- Members Management ---

  async openMembersModal(group: any) {
    this.selectedGroup = group;
    this.showMembersModal = true;
    await this.loadGroupMembers(group.id);
  }

  closeMembersModal() {
    this.showMembersModal = false;
    this.selectedGroup = null;
  }

  async loadGroupMembers(groupId: string) {
    // 1. Get User IDs in group
    const { data: memberData } = await this.supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    const memberIds = memberData?.map((m: any) => m.user_id) || [];

    // 2. Filter users
    this.groupMembers = this.users.filter(u => memberIds.includes(u.id));
    this.nonMembers = this.users.filter(u => !memberIds.includes(u.id));
  }

  async addMember(userId: string) {
    const { error } = await this.supabase
      .from('group_members')
      .insert({
        user_id: userId,
        group_id: this.selectedGroup.id
      });

    if (!error) {
      this.loadGroupMembers(this.selectedGroup.id);
    }
  }

  async removeMember(userId: string) {
    const { error } = await this.supabase
      .from('group_members')
      .delete()
      .eq('user_id', userId)
      .eq('group_id', this.selectedGroup.id);

    if (!error) {
      this.loadGroupMembers(this.selectedGroup.id);
    }
  }
}
