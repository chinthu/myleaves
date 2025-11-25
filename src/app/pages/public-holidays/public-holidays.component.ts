import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SharedModule } from 'primeng/api';

@Component({
  selector: 'app-public-holidays',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    CalendarModule,
    DropdownModule,
    ToastModule,
    TagModule
  ],
  templateUrl: './public-holidays.component.html',
  styleUrls: ['./public-holidays.component.scss'],
  providers: [MessageService]
})
export class PublicHolidaysComponent implements OnInit {
  supabase: SupabaseClient;
  user: any = null;
  canManage = false;

  holidays: any[] = [];
  filteredHolidays: any[] = [];
  loading = false;

  // Dialog
  showDialog = false;
  isEditing = false;
  currentHoliday: any = {};

  // Filters
  selectedYear: number = new Date().getFullYear();
  years: number[] = [];

  // Organization Filter (Super Admin)
  organizations: any[] = [];
  selectedOrgId: string | null = null;

  // Holiday types
  holidayTypes = [
    { label: 'Mandatory', value: 'MANDATORY' },
    { label: 'Optional', value: 'OPTIONAL' },
    { label: 'Normal', value: 'NORMAL' }
  ];

  constructor(
    private authService: AuthService,
    private messageService: MessageService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    // Generate years (current - 1 to current + 2)
    const currentYear = new Date().getFullYear();
    for (let i = -1; i <= 2; i++) {
      this.years.push(currentYear + i);
    }
  }

  async ngOnInit() {
    this.user = await this.authService.getUserProfile();
    this.canManage = ['HR', 'ADMIN', 'SUPER_ADMIN'].includes(this.user?.role);

    if (this.user?.role === 'SUPER_ADMIN') {
      await this.loadOrganizations();
    } else {
      this.selectedOrgId = this.user.organization_id;
    }

    this.loadHolidays();
  }

  async loadOrganizations() {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('id, name')
      .order('name');

    if (data) {
      this.organizations = data;
      // Default to first org or user's org if available
      this.selectedOrgId = this.user.organization_id || (data.length > 0 ? data[0].id : null);
    }
  }

  async loadHolidays() {
    if (!this.selectedOrgId && this.user.role !== 'SUPER_ADMIN') return;

    this.loading = true;
    try {
      let query = this.supabase
        .from('public_holidays')
        .select('*')
        .eq('year', this.selectedYear)
        .order('date', { ascending: true });

      // Filter by organization
      if (this.selectedOrgId) {
        query = query.eq('organization_id', this.selectedOrgId);
      }

      const { data, error } = await query;

      if (error) throw error;
      this.holidays = data || [];
      this.filteredHolidays = [...this.holidays];
    } catch (error) {
      console.error('Error loading holidays:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load public holidays'
      });
    } finally {
      this.loading = false;
    }
  }

  onYearChange() {
    this.loadHolidays();
  }

  onOrgChange() {
    this.loadHolidays();
  }

  openAddDialog() {
    this.currentHoliday = {
      name: '',
      date: new Date(),
      type: 'NORMAL',
      description: '',
      year: this.selectedYear,
      organization_id: this.user.organization_id
    };
    this.isEditing = false;
    this.showDialog = true;
  }

  openEditDialog(holiday: any) {
    this.currentHoliday = {
      ...holiday,
      date: new Date(holiday.date)
    };
    this.isEditing = true;
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
    this.currentHoliday = {};
  }

  async saveHoliday() {
    if (!this.currentHoliday.name || !this.currentHoliday.date) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Please fill in all required fields'
      });
      return;
    }

    try {
      const holidayData = {
        name: this.currentHoliday.name,
        date: this.formatDate(this.currentHoliday.date),
        year: this.currentHoliday.date.getFullYear(),
        type: this.currentHoliday.type,
        description: this.currentHoliday.description,
        organization_id: this.user.organization_id,
        created_by: this.user.id
      };

      if (this.isEditing) {
        const { error } = await this.supabase
          .from('public_holidays')
          .update(holidayData)
          .eq('id', this.currentHoliday.id);

        if (error) throw error;
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Holiday updated successfully'
        });
      } else {
        const { error } = await this.supabase
          .from('public_holidays')
          .insert([holidayData]);

        if (error) throw error;
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Holiday added successfully'
        });
      }

      this.closeDialog();
      this.loadHolidays();
    } catch (error: any) {
      console.error('Error saving holiday:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to save holiday'
      });
    }
  }

  async deleteHoliday(holiday: any) {
    if (!confirm(`Are you sure you want to delete "${holiday.name}"?`)) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('public_holidays')
        .delete()
        .eq('id', holiday.id);

      if (error) throw error;

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Holiday deleted successfully'
      });
      this.loadHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete holiday'
      });
    }
  }

  getTypeSeverity(type: string): any {
    switch (type) {
      case 'MANDATORY': return 'danger';
      case 'OPTIONAL': return 'info';
      case 'NORMAL': return 'success';
      default: return 'info';
    }
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
