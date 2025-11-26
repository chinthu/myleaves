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

  // Form Fields
  leaveType: string = 'CASUAL'; // CASUAL, MEDICAL, COMP_OFF
  duration: string = 'FULL_DAY'; // FULL_DAY, HALF_DAY, LONG_LEAVE
  startDate: string = '';
  endDate: string = '';
  halfDayDate: string = '';
  halfDaySlot: string = 'MORNING'; // MORNING, AFTERNOON
  reason: string = '';
  userGroupId: string | null = null; // User's group (auto-assigned)

  // Calculated
  daysCount: number = 0;
  minDate: Date = new Date(); // Minimum date: one month before today

  // Comp Off Balance
  compOffBalance: number = 0;
  canApplyCompOff: boolean = false; // Start as false, will be updated after loading balance

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
      .subscribe(async (userProfile) => {
        if (userProfile && userProfile.organization_id) {
          this.user = userProfile;
          // Load comp off balance first to determine if COMP_OFF should be shown
          await this.loadCompOffBalance();
          // Load user's group (for auto-assignment)
          await this.loadUserGroup();
        }
      });
  }

  async loadUserGroup() {
    if (!this.user) return;
    try {
      // Get the first group the user belongs to
      const { data, error } = await this.supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', this.user.id)
        .limit(1)
        .single();

      if (!error && data) {
        this.userGroupId = data.group_id;
      } else if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading user group:', error);
      }
    } catch (error) {
      console.error('Error in loadUserGroup:', error);
    }
  }

  async loadCompOffBalance() {
    if (!this.user) return;
    try {
      const { data, error } = await this.leaveService.getUserCompOffBalance(this.user.id);
      if (!error && data !== null) {
        this.compOffBalance = data;
        this.canApplyCompOff = this.compOffBalance > 0;
        
        // If user has COMP_OFF selected but no balance, switch to CASUAL
        if (this.leaveType === 'COMP_OFF' && !this.canApplyCompOff) {
          this.leaveType = 'CASUAL';
          this.messageService.add({
            severity: 'warn',
            summary: 'Comp Off Not Available',
            detail: 'You do not have any pending comp off balance. Please select a different leave type.'
          });
        }
      } else {
        // If there's an error or no data, ensure COMP_OFF is hidden
        this.canApplyCompOff = false;
        this.compOffBalance = 0;
      }
    } catch (error) {
      console.error('Error loading comp off balance:', error);
      // On error, ensure COMP_OFF is hidden
      this.canApplyCompOff = false;
      this.compOffBalance = 0;
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
          severity: 'error',
          summary: 'Invalid Date Range',
          detail: 'End date cannot be less than start date. Please select a valid end date.'
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

  onLeaveTypeChange() {
    // Only check comp off balance when user tries to select COMP_OFF
    // Medical and Casual leaves should always be available - do nothing for them
    if (this.leaveType === 'COMP_OFF') {
      if (!this.canApplyCompOff) {
        this.messageService.add({
          severity: 'error',
          summary: 'Comp Off Not Available',
          detail: `You do not have any pending comp off balance (Current balance: ${this.compOffBalance} days). Please select a different leave type.`
        });
        // Reset to CASUAL if COMP_OFF is not available
        this.leaveType = 'CASUAL';
      }
    }
    // Medical and Casual leaves are always enabled - no action needed
  }

  getMinDateForEndDate(): Date | null {
    // For end date in long leave, it should be at least the start date
    if (this.duration === 'LONG_LEAVE' && this.startDate) {
      const start = new Date(this.startDate);
      start.setHours(0, 0, 0, 0);
      // Return the start date (end date cannot be less than start date)
      // But also ensure it's not before the minimum allowed date
      return start > this.minDate ? start : this.minDate;
    }
    return this.minDate;
  }

  onStartDateChange() {
    // When start date changes for long leave, reset end date if it's now invalid
    if (this.duration === 'LONG_LEAVE' && this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      if (end < start) {
        this.endDate = '';
        this.daysCount = 0;
        this.messageService.add({
          severity: 'warn',
          summary: 'End Date Reset',
          detail: 'End date has been reset because it was less than the new start date.'
        });
      }
    }
    this.calculateDays();
  }

  isEndDateBeforeStartDate(): boolean {
    if (this.duration === 'LONG_LEAVE' && this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      return end < start;
    }
    return false;
  }

  async submitLeave() {
    this.loading = true;

    try {
      // Validation: Comp Off balance check
      if (this.leaveType === 'COMP_OFF' && !this.canApplyCompOff) {
        throw new Error('You do not have any pending comp off balance. Please select a different leave type.');
      }

      // Validation: Required fields based on leave type
      if (!this.leaveType) {
        throw new Error('Please select a leave type.');
      }

      // Validation: Duration and dates
      if (this.duration === 'LONG_LEAVE') {
        if (!this.startDate || !this.endDate) {
          throw new Error('Please select both start and end dates for long leave.');
        }
        // Validate end date is not less than start date
        const start = new Date(this.startDate);
        const end = new Date(this.endDate);
        if (end < start) {
          throw new Error('End date cannot be less than start date.');
        }
      } else if (this.duration === 'HALF_DAY') {
        if (!this.halfDayDate) {
          throw new Error('Please select a date for half day leave.');
        }
        if (!this.halfDaySlot) {
          throw new Error('Please select a half day slot (Morning or Afternoon).');
        }
      } else if (this.duration === 'FULL_DAY') {
        if (!this.startDate) {
          throw new Error('Please select a date for full day leave.');
        }
      }

      // Validation: Reason (mandatory for all leave types)
      if (!this.reason || this.reason.trim() === '') {
        throw new Error('Please provide a reason for the leave.');
      }

      // Validation: User must belong to a group
      if (!this.userGroupId) {
        throw new Error('You are not assigned to any group. Please contact your administrator to assign you to a group before applying for leave.');
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
        // Additional validation: end date cannot be less than start date
        if (startDateToValidate && endDateToValidate < startDateToValidate) {
          throw new Error('End date cannot be less than start date. Please select a valid end date.');
        }
      }

      // Prepare Payload
      // assigned_group_id is automatically set to user's group
      const payload: any = {
        user_id: this.user.id,
        type: this.leaveType,
        status: 'PENDING',
        reason: this.reason,
        days_count: this.daysCount,
        assigned_group_id: this.userGroupId // Auto-assigned based on user's group
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
