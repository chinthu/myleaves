import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LeaveService } from '../../services/leave.service';
import { LoadingService } from '../../services/loading.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/supabase.service';

import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { NgSelectModule } from '@ng-select/ng-select';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, filter, take, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    FormsModule,
    TableModule, 
    CardModule, 
    TagModule, 
    ButtonModule,
    DialogModule,
    CalendarModule,
        NgSelectModule,
    InputTextareaModule,
    ToastModule,
    TooltipModule,
    CheckboxModule,
    ChartModule
  ],
  providers: [MessageService],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  supabase: SupabaseClient;
  user: any = null;

  // Stats
  casualBalance = 0;
  medicalBalance = 0;
  compOffBalance = 0;
  totalLeavesTaken = 0;
  pendingLeaves = 0;
  
  // Leaves taken this year
  casualLeavesTaken = 0;
  medicalLeavesTaken = 0;
  compOffLeavesTaken = 0;
  totalLeavesTakenDays = 0;
  
  // Charts
  monthlyLeavesChart: any;
  chartOptions: any;
  chartLoading = false;

  // Recent Leaves
  recentLeaves: any[] = [];

  // Calendar Year Filter
  selectedYear: number = new Date().getFullYear();
  availableYears: any[] = [];

  // Edit/Cancel Dialog
  showEditDialog = false;
  showCancelDialog = false;
  selectedLeave: any = null;
  editForm: any = {
    start_date: null,
    end_date: null,
    type: '',
    reason: '',
    is_half_day: false,
    half_day_slot: 'MORNING'
  };

  leaveTypes = [
    { label: 'Casual Leave', value: 'CASUAL' },
    { label: 'Medical Leave', value: 'MEDICAL' },
    { label: 'Comp Off', value: 'COMP_OFF' }
  ];

  halfDaySlots = [
    { label: 'First Half', value: 'MORNING' },
    { label: 'Second Half', value: 'AFTERNOON' }
  ];

  // Realtime subscriptions
  private leavesChannel: any;
  private userChannel: any;
  private destroy$ = new Subject<void>();

  // For admin viewing another user's dashboard
  viewingUserId: string | null = null;
  isViewingOtherUser = false;
  viewingUserName = '';

  // Flags to prevent duplicate API calls
  private isDataLoading = false;
  private hasLoadedInitialData = false;

  constructor(
    private authService: AuthService,
    private leaveService: LeaveService,
    private messageService: MessageService,
    private loadingService: LoadingService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private supabaseService: SupabaseService
  ) {
    // Use shared Supabase client instance instead of creating a new one
    this.supabase = this.supabaseService.client;
  }

  setupSubscriptions() {
    // Only setup subscriptions for current user's dashboard, not when viewing other users
    if (this.isViewingOtherUser) {
      return;
    }

    // Subscribe to changes in leaves table
    this.leavesChannel = this.supabase
      .channel('dashboard-leaves')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'leaves', filter: `user_id=eq.${this.user?.id}` },
        (payload) => {
          console.log('Leave change detected:', payload);
          // Run within Angular zone to ensure change detection
          this.ngZone.run(() => {
            // Only reload if not currently loading to prevent duplicate calls
            if (!this.isDataLoading && this.user) {
              this.loadLeaves(false);
            }
          });
        }
      )
      .subscribe();

    // Subscribe to changes in users table (for balance updates)
    this.userChannel = this.supabase
      .channel('dashboard-user')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${this.user?.id}` },
        (payload) => {
          console.log('User balance updated:', payload);
          // Run within Angular zone to ensure change detection
          this.ngZone.run(() => {
            if (payload.new) {
              this.casualBalance = (payload.new as any).balance_casual;
              this.medicalBalance = (payload.new as any).balance_medical;
              this.cdr.markForCheck(); // Trigger change detection
            }
          });
        }
      )
      .subscribe();
  }

  ngOnInit() {
    // Generate available years (current year and 2 years back)
    const currentYear = new Date().getFullYear();
    this.availableYears = [
      { label: currentYear.toString(), value: currentYear },
      { label: (currentYear - 1).toString(), value: currentYear - 1 },
      { label: (currentYear - 2).toString(), value: currentYear - 2 }
    ];
    this.selectedYear = currentYear;

    // Check if we're viewing another user's dashboard
    this.route.params.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged((prev, curr) => prev['userId'] === curr['userId']) // Only fire if userId changes
    ).subscribe(async params => {
      // Reset flags when switching users
      this.hasLoadedInitialData = false;
      this.isDataLoading = false;
      
      if (params['userId']) {
        this.viewingUserId = params['userId'];
        this.isViewingOtherUser = true;
        await this.loadUserData(params['userId']);
      } else {
        // Load current user's dashboard
        this.isViewingOtherUser = false;
        this.viewingUserId = null;
        await this.loadCurrentUserDashboard();
      }
    });
  }

  async loadCurrentUserDashboard() {
    // Prevent duplicate calls
    if (this.isDataLoading || this.hasLoadedInitialData) {
      return;
    }

    // Show loading indicator immediately
    this.loadingService.show();
    this.isDataLoading = true;
    
    this.authService.userProfile$
      .pipe(
        takeUntil(this.destroy$),
        filter(profile => profile !== undefined), // Wait for profile to be defined
        distinctUntilChanged((prev, curr) => prev?.id === curr?.id), // Only fire if user ID changes
        take(1) // Only take the first valid emission
      )
      .subscribe(async (userProfile) => {
        if (userProfile && !this.hasLoadedInitialData) {
          this.user = userProfile;
          this.casualBalance = this.user.balance_casual;
          this.medicalBalance = this.user.balance_medical;
          
          try {
            // Load all data in parallel
            await Promise.all([
              this.loadCompOffs(false),
              this.loadLeaves(false)
            ]);
            this.hasLoadedInitialData = true;
            this.cdr.markForCheck(); // Trigger change detection after data is loaded
          } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.messageService.add({ 
              severity: 'error', 
              summary: 'Error', 
              detail: 'Failed to load dashboard data. Please refresh the page.' 
            });
            this.cdr.markForCheck(); // Trigger change detection on error
          } finally {
            // Hide loading indicator after all data is loaded
            this.loadingService.hide();
            this.isDataLoading = false;
            this.cdr.markForCheck(); // Ensure UI updates
          }
          
          // Only setup subscriptions once user is loaded
          if (!this.leavesChannel) {
            this.setupSubscriptions();
          }
        } else if (userProfile === null) {
          // Profile is null (not loading, but no profile found)
          this.loadingService.hide();
          this.isDataLoading = false;
        }
        // If userProfile is undefined, it's still loading, keep loading indicator
      });
  }

  async loadUserData(userId: string) {
    if (!userId || this.isDataLoading) return;
    
    this.loadingService.show();
    this.isDataLoading = true;
    try {
      // Load user profile
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'User not found' });
        this.router.navigate(['/users']);
        return;
      }

      this.user = userData;
      this.viewingUserName = userData.full_name;
      this.casualBalance = this.user.balance_casual || 0;
      this.medicalBalance = this.user.balance_medical || 0;

      // Load user's data
      await Promise.all([
        this.loadCompOffsForUser(userId, false),
        this.loadLeavesForUser(userId, false)
      ]);
      this.hasLoadedInitialData = true;
      this.cdr.markForCheck(); // Trigger change detection after data is loaded
    } catch (error) {
      console.error('Error in loadUserData:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load user data.'
      });
      this.cdr.markForCheck(); // Trigger change detection on error
    } finally {
      this.loadingService.hide();
      this.isDataLoading = false;
      this.cdr.markForCheck(); // Ensure UI updates
    }
  }

  async loadCompOffsForUser(userId: string, showLoading: boolean = true) {
    if (!userId) return;
    
    if (showLoading) {
      this.loadingService.show();
    }
    try {
      const { data: compOffsWithDays, error } = await this.supabase
        .from('user_comp_offs')
        .select('*, comp_offs(days)')
        .eq('user_id', userId)
        .eq('is_consumed', false);

      if (error) {
        console.error('Error loading comp-offs:', error);
        this.compOffBalance = 0;
        this.cdr.markForCheck(); // Trigger change detection
        return;
      }

      if (compOffsWithDays) {
        this.compOffBalance = compOffsWithDays.reduce((sum: number, item: any) => {
          return sum + (item.comp_offs?.days || 0);
        }, 0);
      } else {
        this.compOffBalance = 0;
      }
      this.cdr.markForCheck(); // Trigger change detection after data update
    } catch (error) {
      console.error('Error in loadCompOffsForUser:', error);
      this.compOffBalance = 0;
      this.cdr.markForCheck(); // Trigger change detection on error
    } finally {
      if (showLoading) {
        this.loadingService.hide();
      }
    }
  }

  async loadLeavesForUser(userId: string, showLoading: boolean = false) {
    if (showLoading) {
      this.loadingService.show();
    }
    try {
      const { data, error } = await this.leaveService.getLeavesByYear(userId, this.selectedYear);

      if (error) {
        console.error('Error loading leaves:', error);
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: 'Failed to load leaves data.' 
        });
        // Initialize empty state on error
        this.processLeavesData([]);
        return;
      }

      if (data) {
        this.processLeavesData(data);
      } else {
        // No data, initialize empty state
        this.processLeavesData([]);
      }
      this.cdr.markForCheck(); // Trigger change detection after processing
    } catch (error: any) {
      console.error('Error in loadLeavesForUser:', error);
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Error', 
        detail: error.message || 'Failed to load leaves data.' 
      });
      // Initialize empty state on error
      this.processLeavesData([]);
    } finally {
      if (showLoading) {
        this.loadingService.hide();
      }
    }
  }

  async loadCompOffs(showLoading: boolean = true) {
    if (!this.user) return;
    await this.loadCompOffsForUser(this.user.id, showLoading);
  }

  async loadLeaves(showLoading: boolean = false) {
    if (!this.user) return;
    await this.loadLeavesForUser(this.user.id, showLoading);
  }

  processLeavesData(data: any[]) {
    try {
      // Update recent leaves immediately
      this.recentLeaves = data || [];
      
      // Calculate stats for the selected year (year-based calculations) - fast operations
      const approvedLeaves = (data || []).filter((l: any) => l.status === 'APPROVED');
      this.totalLeavesTaken = approvedLeaves.length;
      this.pendingLeaves = (data || []).filter((l: any) => l.status === 'PENDING').length;
      
      // Calculate leaves taken by category for the selected year
      this.casualLeavesTaken = approvedLeaves
        .filter((l: any) => l.type === 'CASUAL')
        .reduce((sum: number, l: any) => sum + (l.days_count || 0), 0);
      
      this.medicalLeavesTaken = approvedLeaves
        .filter((l: any) => l.type === 'MEDICAL')
        .reduce((sum: number, l: any) => sum + (l.days_count || 0), 0);
      
      this.compOffLeavesTaken = approvedLeaves
        .filter((l: any) => l.type === 'COMP_OFF')
        .reduce((sum: number, l: any) => sum + (l.days_count || 0), 0);
      
      // Calculate total leaves taken (in days)
      this.totalLeavesTakenDays = approvedLeaves
        .reduce((sum: number, l: any) => sum + (l.days_count || 0), 0);
      
      // Trigger change detection immediately for stats
      this.cdr.markForCheck();
      
      // Setup monthly chart asynchronously to avoid blocking UI
      this.chartLoading = true;
      this.monthlyLeavesChart = null; // Clear previous chart
      this.cdr.markForCheck(); // Update UI to show loading state
      
      // Use requestAnimationFrame for better performance, but run in Angular zone
      this.ngZone.runOutsideAngular(() => {
        requestAnimationFrame(() => {
          // Run chart setup back in Angular zone to trigger change detection
          this.ngZone.run(() => {
            try {
              this.setupMonthlyChart(data || []);
            } catch (error) {
              console.error('Error setting up monthly chart:', error);
            } finally {
              this.chartLoading = false;
              this.cdr.markForCheck(); // Trigger change detection after chart is ready
            }
          });
        });
      });
    } catch (error) {
      console.error('Error processing leaves data:', error);
      this.cdr.markForCheck(); // Trigger change detection on error
    }
    
    // Note: casualBalance and medicalBalance are cumulative (current available balance)
    // The "taken" stats are calculated per year from the leaves data above
  }

  setupMonthlyChart(leaves: any[]) {
    const approvedLeaves = leaves.filter((l: any) => l.status === 'APPROVED');
    const monthlyData = this.getMonthlyLeavesData(approvedLeaves);
    
    this.monthlyLeavesChart = {
      labels: monthlyData.map(m => m.month),
      datasets: [{
        label: 'Leaves Taken (Days)',
        data: monthlyData.map(m => m.days),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    };
  }

  getMonthlyLeavesData(approvedLeaves: any[]) {
    const months: { month: string; days: number }[] = [];
    const currentYear = this.selectedYear;
    
    // Initialize month data
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      months.push({ month: monthName, days: 0 });
    }

    // Pre-calculate month boundaries for performance (as timestamps)
    const monthBoundaries: number[][] = [];
    for (let i = 0; i < 12; i++) {
      const start = new Date(currentYear, i, 1).getTime();
      const end = new Date(currentYear, i + 1, 0, 23, 59, 59, 999).getTime();
      monthBoundaries.push([start, end]);
    }

    // Simplified calculation - use days_count from database and distribute proportionally
    approvedLeaves.forEach(leave => {
      const leaveStartStr = leave.start_date;
      const leaveEndStr = leave.end_date;
      
      // Parse dates
      const [startYear, startMonth, startDay] = leaveStartStr.split('-').map(Number);
      const [endYear, endMonth, endDay] = leaveEndStr.split('-').map(Number);
      
      // Only process leaves from the selected year
      if (startYear !== currentYear) return;
      
      const leaveDays = leave.days_count || 0;
      if (leaveDays === 0) return;
      
      // If it's a single day leave
      if (leaveStartStr === leaveEndStr) {
        const monthIndex = startMonth - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          months[monthIndex].days += leaveDays;
        }
        return;
      }
      
      // For multi-day leaves, find which months it spans
      const startMonthIndex = startMonth - 1;
      const endMonthIndex = endMonth - 1;
      
      // If it's within the same month
      if (startMonthIndex === endMonthIndex && startYear === endYear) {
        months[startMonthIndex].days += leaveDays;
        return;
      }
      
      // For leaves spanning multiple months, distribute days proportionally
      // Calculate total days in the leave period
      const leaveStart = new Date(startYear, startMonth - 1, startDay).getTime();
      const leaveEnd = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999).getTime();
      const totalPeriodDays = Math.ceil((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
      
      // Distribute days across months
      for (let i = startMonthIndex; i <= endMonthIndex && i < 12; i++) {
        const [monthStart, monthEnd] = monthBoundaries[i];
        
        // Calculate overlap
        const overlapStart = leaveStart > monthStart ? leaveStart : monthStart;
        const overlapEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;
        
        if (overlapStart <= overlapEnd) {
          const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
          // Distribute proportionally
          const proportion = overlapDays / totalPeriodDays;
          months[i].days += leaveDays * proportion;
        }
      }
    });

    // Round to 1 decimal place
    return months.map(m => ({ ...m, days: Math.round(m.days * 10) / 10 }));
  }

  async onYearChange() {
    if (!this.user || this.isDataLoading) return;
    
    // Show loading for year change since we're updating multiple things
    this.loadingService.show();
    this.isDataLoading = true;
    this.cdr.markForCheck(); // Update UI to show loading state
    try {
      const userId = this.isViewingOtherUser ? this.viewingUserId! : this.user.id;
      if (!userId) return;
      
      await Promise.all([
        this.loadLeavesForUser(userId, false),
        this.loadCompOffsForUser(userId, false) // Comp offs don't change with year, but reload to be safe
      ]);
      this.cdr.markForCheck(); // Trigger change detection after data is loaded
    } catch (error) {
      console.error('Error in onYearChange:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load data for selected year.'
      });
      this.cdr.markForCheck(); // Trigger change detection on error
    } finally {
      this.loadingService.hide();
      this.isDataLoading = false;
      this.cdr.markForCheck(); // Ensure UI updates
    }
  }

  getSeverity(status: string): any {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'PENDING': return 'warn';
      case 'CANCELLED': return 'info';
      default: return 'info';
    }
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'CASUAL': return 'badge badge-casual';
      case 'MEDICAL': return 'badge badge-medical';
      case 'COMP_OFF': return 'badge badge-compoff';
      default: return 'badge';
    }
  }

  openEditDialog(leave: any) {
    this.selectedLeave = leave;
    this.editForm = {
      start_date: new Date(leave.start_date),
      end_date: new Date(leave.end_date),
      type: leave.type,
      reason: leave.reason || '',
      is_half_day: leave.is_half_day || false,
      half_day_slot: leave.half_day_slot || 'MORNING'
    };
    this.showEditDialog = true;
  }

  openCancelDialog(leave: any) {
    this.selectedLeave = leave;
    this.showCancelDialog = true;
  }

  closeEditDialog() {
    this.showEditDialog = false;
    this.selectedLeave = null;
    this.editForm = {
      start_date: null,
      end_date: null,
      type: '',
      reason: '',
      is_half_day: false,
      half_day_slot: 'MORNING'
    };
  }

  closeCancelDialog() {
    this.showCancelDialog = false;
    this.selectedLeave = null;
  }

  async saveEdit() {
    if (!this.selectedLeave) return;

    // Users can only edit pending leaves, so always reset to pending
    const updates: any = {
      start_date: this.editForm.start_date.toISOString().split('T')[0],
      end_date: this.editForm.end_date.toISOString().split('T')[0],
      type: this.editForm.type,
      reason: this.editForm.reason,
      is_half_day: this.editForm.is_half_day,
      status: 'PENDING' // Reset to pending when user edits
    };

    if (this.editForm.is_half_day) {
      updates.half_day_slot = this.editForm.half_day_slot;
    }

    const { error } = await this.leaveService.editLeave(this.selectedLeave.id, updates);
    
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update leave.' });
    } else {
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Leave updated successfully. It will need to be re-approved.' });
      this.closeEditDialog();
      this.loadLeaves();
      // Reload user profile to update balances
      if (this.user) {
        await this.authService.loadUserProfile(this.user.id, false);
      }
    }
  }

  async confirmCancel() {
    if (!this.selectedLeave) return;

    const { error } = await this.leaveService.cancelLeave(this.selectedLeave.id);
    
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to cancel leave.' });
    } else {
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Leave cancelled successfully.' });
      this.closeCancelDialog();
      this.loadLeaves();
      // Reload user profile to update balances
      if (this.user) {
        await this.authService.loadUserProfile(this.user.id, false);
      }
    }
  }

  canEditOrCancel(leave: any): boolean {
    return leave.status === 'PENDING';
  }

  hasEditableLeaves(): boolean {
    return this.recentLeaves.some(l => this.canEditOrCancel(l));
  }

  ngOnDestroy() {
    // Unsubscribe from Supabase realtime channels
    if (this.leavesChannel) {
      this.supabase.removeChannel(this.leavesChannel);
    }
    if (this.userChannel) {
      this.supabase.removeChannel(this.userChannel);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
