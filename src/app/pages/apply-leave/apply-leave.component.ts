import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Router, RouterLink } from '@angular/router';
import { LeaveService } from '../../services/leave.service';

import { CalendarModule } from 'primeng/calendar';
import { NgSelectModule } from '@ng-select/ng-select';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-apply-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CalendarModule, NgSelectModule, RadioButtonModule, InputTextareaModule, ToastModule, ButtonModule, CardModule],
  templateUrl: './apply-leave.component.html',
  styleUrls: ['./apply-leave.component.scss'],
  providers: [MessageService]
})
export class ApplyLeaveComponent implements OnInit, OnDestroy {
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
  minDate: Date = new Date(); // Minimum date: one month before today

  // UI State
  loading: boolean = false;
  message: string = '';
  error: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private leaveService: LeaveService,
    private messageService: MessageService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
    // Set minimum date to one month before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneMonthBefore = new Date(today);
    oneMonthBefore.setMonth(today.getMonth() - 1);
    oneMonthBefore.setHours(0, 0, 0, 0);
    this.minDate = oneMonthBefore;

    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((userProfile) => {
        if (userProfile && userProfile.organization_id) {
          this.user = userProfile;
          this.loadGroups(this.user.organization_id);
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
      
      // Validate end date is not before start date
      if (end < start) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid Date Range',
          detail: 'End date cannot be before start date.'
        });
        this.endDate = '';
        this.daysCount = 0;
        return;
      }
      
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      this.daysCount = diffDays > 0 ? diffDays : 0;
    } else {
      this.daysCount = 0;
    }
  }

  getMinDateForEndDate(): Date | null {
    // For end date in long leave, it should be at least the start date
    if (this.duration === 'LONG_LEAVE' && this.startDate) {
      const start = new Date(this.startDate);
      start.setHours(0, 0, 0, 0);
      // Return the later of: start date or one month before today
      return start > this.minDate ? start : this.minDate;
    }
    return this.minDate;
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

      // Validate dates are at least one month before today (can't select dates older than one month)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneMonthBefore = new Date(today);
      oneMonthBefore.setMonth(today.getMonth() - 1);
      oneMonthBefore.setHours(0, 0, 0, 0);

      // Validate start date (or half day date)
      let startDateToValidate: Date | null = null;
      if (this.duration === 'HALF_DAY' && this.halfDayDate) {
        startDateToValidate = new Date(this.halfDayDate);
      } else if ((this.duration === 'FULL_DAY' || this.duration === 'LONG_LEAVE') && this.startDate) {
        startDateToValidate = new Date(this.startDate);
      }

      if (startDateToValidate) {
        startDateToValidate.setHours(0, 0, 0, 0);
        if (startDateToValidate < oneMonthBefore) {
          const minDateStr = oneMonthBefore.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          throw new Error(`Leave can only be applied for dates starting from ${minDateStr} (one month before today). Dates before this cannot be selected.`);
        }
      }

      // Validate end date for long leave
      if (this.duration === 'LONG_LEAVE' && this.endDate) {
        const endDateToValidate = new Date(this.endDate);
        endDateToValidate.setHours(0, 0, 0, 0);
        if (endDateToValidate < oneMonthBefore) {
          const minDateStr = oneMonthBefore.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          throw new Error(`End date must be at least ${minDateStr} (one month before today).`);
        }
        if (startDateToValidate && endDateToValidate < startDateToValidate) {
          throw new Error('End date cannot be before start date.');
        }
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
