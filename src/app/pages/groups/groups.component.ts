import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService, SharedModule } from 'primeng/api';
import { PickListModule } from 'primeng/picklist';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss']
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

  // Organization Filtering (Super Admin)
  organizations: any[] = [];
  selectedOrgId: string | null = null;
  isSuperAdmin = false;

  constructor(private authService: AuthService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(async (u) => {
      if (u) {
        this.currentUser = await this.authService.getUserProfile();
        if (this.currentUser) {
          this.isSuperAdmin = this.currentUser.role === 'SUPER_ADMIN';

          if (this.isSuperAdmin) {
            await this.loadOrganizations();
            this.selectedOrgId = this.currentUser.organization_id || (this.organizations.length > 0 ? this.organizations[0].id : null);
          } else {
            this.selectedOrgId = this.currentUser.organization_id;
          }

          if (this.selectedOrgId) {
            this.formData.organization_id = this.selectedOrgId;
            this.loadGroups();
            this.loadUsers();
          }
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
      this.loadGroups();
      this.loadUsers();
    }
  }

  async loadGroups() {
    if (!this.selectedOrgId) return;

    const { data, error } = await this.supabase
      .from('groups')
      .select('*, group_members(count)')
      .eq('organization_id', this.selectedOrgId)
      .order('name');

    if (data) {
      this.groups = data.map((g: any) => ({
        ...g,
        members_count: g.group_members[0]?.count || 0
      }));
    }
  }

  async loadUsers() {
    if (!this.selectedOrgId) return;

    const { data } = await this.supabase
      .from('users')
      .select('id, full_name, email')
      .eq('organization_id', this.selectedOrgId);

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
