import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LeaveService } from '../../services/leave.service';
import { LoadingService } from '../../services/loading.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
    DropdownModule,
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

  constructor(
    private authService: AuthService,
    private leaveService: LeaveService,
    private messageService: MessageService,
    private loadingService: LoadingService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  setupSubscriptions() {
    // Subscribe to changes in leaves table
    this.leavesChannel = this.supabase
      .channel('dashboard-leaves')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'leaves' },
        (payload) => {
          console.log('Leave change detected:', payload);
          this.loadLeaves();
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
          if (payload.new) {
            this.casualBalance = (payload.new as any).balance_casual;
            this.medicalBalance = (payload.new as any).balance_medical;
          }
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
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(async params => {
      if (params['userId']) {
        this.viewingUserId = params['userId'];
        this.isViewingOtherUser = true;
        await this.loadUserData(params['userId']);
      } else {
        // Load current user's dashboard
        this.loadCurrentUserDashboard();
      }
    });
  }

  async loadCurrentUserDashboard() {
    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (userProfile) => {
        if (userProfile) {
          this.user = userProfile;
          this.casualBalance = this.user.balance_casual;
          this.medicalBalance = this.user.balance_medical;
          
          // Load all data in parallel with loading indicator
          this.loadingService.show();
          try {
            await Promise.all([
              this.loadCompOffs(false),
              this.loadLeaves(false)
            ]);
          } finally {
            this.loadingService.hide();
          }
          
          // Only setup subscriptions once user is loaded
          if (!this.leavesChannel) {
            this.setupSubscriptions();
          }
        }
      });
  }

  async loadUserData(userId: string) {
    this.loadingService.show();
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
    } finally {
      this.loadingService.hide();
    }
  }

  async loadCompOffsForUser(userId: string, showLoading: boolean = true) {
    if (showLoading) {
      this.loadingService.show();
    }
    try {
      const { data: compOffsWithDays } = await this.supabase
        .from('user_comp_offs')
        .select('*, comp_offs(days)')
        .eq('user_id', userId)
        .eq('is_consumed', false);

      if (compOffsWithDays) {
        this.compOffBalance = compOffsWithDays.reduce((sum: number, item: any) => {
          return sum + (item.comp_offs?.days || 0);
        }, 0);
      }
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

      if (data) {
        this.processLeavesData(data);
      }
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
    // Update recent leaves immediately
    this.recentLeaves = data;
    
    // Calculate stats for the selected year (year-based calculations) - fast operations
    const approvedLeaves = data.filter((l: any) => l.status === 'APPROVED');
    this.totalLeavesTaken = approvedLeaves.length;
    this.pendingLeaves = data.filter((l: any) => l.status === 'PENDING').length;
    
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
    
    // Setup monthly chart asynchronously to avoid blocking UI
    this.chartLoading = true;
    this.monthlyLeavesChart = null; // Clear previous chart
    
    // Use setTimeout to defer chart calculation
    setTimeout(() => {
      this.setupMonthlyChart(data);
      this.chartLoading = false;
    }, 0);
    
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
    if (!this.user) return;
    
    // Show loading for year change since we're updating multiple things
    this.loadingService.show();
    try {
      const userId = this.isViewingOtherUser ? this.viewingUserId! : this.user.id;
      await this.loadLeavesForUser(userId, false);
      // Comp offs don't change with year, but reload to be safe
      await this.loadCompOffsForUser(userId, false);
    } finally {
      this.loadingService.hide();
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
