import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Router, RouterLink } from '@angular/router';
import { LeaveService } from '../../services/leave.service';

import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-apply-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CalendarModule, DropdownModule, RadioButtonModule, InputTextareaModule, ToastModule, ButtonModule, CardModule],
  templateUrl: './apply-leave.component.html',
  styleUrls: ['./apply-leave.component.css'],
  providers: [MessageService]
})
export class ApplyLeaveComponent implements OnInit {
  supabase: SupabaseClient;
  user: any = null;
  groups: any[] = [];

  // Form Fields
  leaveType: string = 'CASUAL'; // CASUAL, MEDICAL, COMP_OFF
  duration: string = 'FULL_DAY'; // FULL_DAY, HALF_DAY, LONG_LEAVE
  startDate: string = '';
  endDate: string = '';
  halfDayDate: string = '';
  halfDaySlot: string = 'MORNING'; // MORNING, AFTERNOON
  reason: string = '';
  selectedGroupId: string = '';

  // Calculated
  daysCount: number = 0;

  // UI State
  loading: boolean = false;
  message: string = '';
  error: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private leaveService: LeaveService,
    private messageService: MessageService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(async (u) => {
      if (u) {
        this.user = await this.authService.getUserProfile();
        if (this.user && this.user.organization_id) {
          this.loadGroups(this.user.organization_id);
        }
      }
    });
  }

  async loadGroups(orgId: string) {
    const { data, error } = await this.leaveService.getGroups(orgId);
    if (data) {
      this.groups = data;
    }
  }

  calculateDays() {
    if (this.duration === 'HALF_DAY') {
      this.daysCount = 0.5;
      return;
    }

    if (this.duration === 'FULL_DAY') {
      this.daysCount = 1;
      return;
    }

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      this.daysCount = diffDays > 0 ? diffDays : 0;
    } else {
      this.daysCount = 0;
    }
  }

  async submitLeave() {
    this.loading = true;

    try {
      // Validation
      if (this.duration === 'LONG_LEAVE' && (!this.startDate || !this.endDate)) {
        throw new Error('Please select start and end dates.');
      }
      if (this.duration === 'HALF_DAY' && !this.halfDayDate) {
        throw new Error('Please select a date for half day leave.');
      }
      if (this.duration === 'FULL_DAY' && !this.startDate) {
        throw new Error('Please select a date.');
      }
      if (!this.selectedGroupId) {
        throw new Error('Please select an approval group.');
      }

      // Prepare Payload
      const payload: any = {
        user_id: this.user.id,
        type: this.leaveType,
        status: 'PENDING',
        reason: this.reason,
        days_count: this.daysCount,
        assigned_group_id: this.selectedGroupId
      };

      if (this.duration === 'HALF_DAY') {
        payload.start_date = this.halfDayDate;
        payload.end_date = this.halfDayDate;
        payload.is_half_day = true;
        payload.half_day_slot = this.halfDaySlot;
      } else if (this.duration === 'FULL_DAY') {
        payload.start_date = this.startDate;
        payload.end_date = this.startDate;
        payload.is_half_day = false;
      } else {
        payload.start_date = this.startDate;
        payload.end_date = this.endDate;
        payload.is_half_day = false;
      }

      const { error } = await this.leaveService.applyLeave(payload);
      if (error) throw error;

      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Leave applied successfully!' });
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 1500);

    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to apply leave.' });
    } finally {
      this.loading = false;
    }
  }
}
