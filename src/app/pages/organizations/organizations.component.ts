import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './organizations.component.html',
  styleUrls: ['./organizations.component.scss']
})
export class OrganizationsComponent implements OnInit, OnDestroy {
  supabase: SupabaseClient;
  currentUser: any = null;
  organizations: any[] = [];

  // Modal State
  showModal = false;
  isEditing = false;

  // Form Data
  formData: any = {
    name: '',
    domain: ''
  };

  loading = false;
  message = '';
  error = '';
  private destroy$ = new Subject<void>();

  constructor(private authService: AuthService) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((userProfile) => {
        if (userProfile && userProfile.role === 'SUPER_ADMIN') {
          this.currentUser = userProfile;
          this.loadOrganizations();
        }
      });
  }

  async loadOrganizations() {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .order('name');

    if (data) {
      this.organizations = data;
    }
  }

  openAddModal() {
    this.isEditing = false;
    this.formData = {
      name: '',
      domain: ''
    };
    this.showModal = true;
    this.message = '';
    this.error = '';
  }

  openEditModal(org: any) {
    this.isEditing = true;
    this.formData = { ...org };
    this.showModal = true;
    this.message = '';
    this.error = '';
  }

  closeModal() {
    this.showModal = false;
  }

  async saveOrganization() {
    this.loading = true;
    this.message = '';
    this.error = '';

    try {
      if (this.isEditing) {
        const { error } = await this.supabase
          .from('organizations')
          .update({
            name: this.formData.name,
            domain: this.formData.domain
          })
          .eq('id', this.formData.id);
        if (error) throw error;
        this.message = 'Organization updated successfully!';
      } else {
        const { error } = await this.supabase
          .from('organizations')
          .insert(this.formData);
        if (error) throw error;
        this.message = 'Organization created successfully!';
      }

      this.loadOrganizations();
      setTimeout(() => this.closeModal(), 1500);

    } catch (err: any) {
      this.error = err.message || 'Operation failed.';
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
