import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { NgSelectModule } from '@ng-select/ng-select';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-leave-archives',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CardModule,
    ButtonModule,
    NgSelectModule,
    ToastModule,
    TagModule,
    TooltipModule,
    InputTextModule
  ],
  providers: [MessageService],
  templateUrl: './leave-archives.component.html',
  styleUrls: ['./leave-archives.component.scss']
})
export class LeaveArchivesComponent implements OnInit, OnDestroy {
  supabase: SupabaseClient;
  user: any = null;
  loading = false;

  // Filters
  organizations: any[] = [];
  selectedOrgId: string | null = null;
  isSuperAdmin = false;
  isHR = false;
  isAdmin = false;
  
  selectedYear: number = new Date().getFullYear() - 1; // Default to previous year
  availableYears: any[] = [];
  
  // Archive Data
  archives: any[] = [];
  filteredArchives: any[] = [];
  globalFilter: string = '';
  
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private loadingService: LoadingService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    // Generate available years (current year and 5 years back)
    const currentYear = new Date().getFullYear();
    this.availableYears = [];
    for (let i = 0; i <= 5; i++) {
      const year = currentYear - i;
      this.availableYears.push({ label: year.toString(), value: year });
    }

    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (userProfile) => {
        if (userProfile) {
          this.user = userProfile;
          this.isSuperAdmin = this.user.role === 'SUPER_ADMIN';
          this.isHR = this.user.role === 'HR';
          this.isAdmin = this.user.role === 'ADMIN';

          if (this.isSuperAdmin) {
            await this.loadOrganizations();
            this.selectedOrgId = this.user.organization_id || (this.organizations.length > 0 ? this.organizations[0].id : null);
          } else {
            this.selectedOrgId = this.user.organization_id;
          }

          if (this.selectedOrgId) {
            await this.loadArchives();
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
      this.loadArchives();
    }
  }

  onYearChange() {
    this.loadArchives();
  }

  async loadArchives() {
    if (!this.selectedOrgId) return;

    this.loading = true;
    this.loadingService.show();
    
    try {
      // Get archive records with user details
      const { data, error } = await this.supabase
        .from('leave_archives')
        .select(`
          *,
          users:user_id (
            id,
            full_name,
            email,
            designation
          )
        `)
        .eq('organization_id', this.selectedOrgId)
        .eq('year', this.selectedYear)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.archives = data || [];
      this.applyFilter();
      this.cdr.markForCheck();
    } catch (error: any) {
      console.error('Error loading archives:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to load archive records'
      });
      this.archives = [];
      this.filteredArchives = [];
      this.cdr.markForCheck();
    } finally {
      this.loading = false;
      this.loadingService.hide();
    }
  }

  applyFilter() {
    if (!this.globalFilter) {
      this.filteredArchives = [...this.archives];
      return;
    }

    const filter = this.globalFilter.toLowerCase();
    this.filteredArchives = this.archives.filter(archive => {
      const userName = (archive.users?.full_name || '').toLowerCase();
      const userEmail = (archive.users?.email || '').toLowerCase();
      return userName.includes(filter) || userEmail.includes(filter);
    });
  }

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.globalFilter = value;
    this.applyFilter();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

