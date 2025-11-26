import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { TagModule } from 'primeng/tag';
import { CalendarModule } from 'primeng/calendar';
import { NgSelectModule } from '@ng-select/ng-select';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { LeaveService } from '../../services/leave.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    CardModule,
    TableModule,
    ButtonModule,
    ChartModule,
    TagModule,
    CalendarModule,
        NgSelectModule,
    DialogModule,
    InputTextareaModule,
    TooltipModule,
    CheckboxModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './hr-dashboard.component.html',
  styleUrls: ['./hr-dashboard.component.scss']
})
export class HrDashboardComponent implements OnInit, OnDestroy {
  supabase: SupabaseClient;
  user: any = null;
  loading = true;
  private destroy$ = new Subject<void>();

  // Today's Leaves
  todaysLeaves: any[] = [];
  todayStats = { total: 0, casual: 0, medical: 0, compOff: 0 };

  // All Leaves
  allLeaves: any[] = [];
  filteredLeaves: any[] = [];

  // Quick Stats
  totalUsers = 0;
  pendingRequests = 0;
  lowBalanceUsers = 0;
  usersWithExcessCasual = 0;

  // Excess Casual Leaves
  usersWithExcessCasualLeaves: any[] = [];

  // Filters
  selectedYear: number = new Date().getFullYear();
  availableYears: any[] = [];
  selectedStatus: string = 'ALL';
  statusOptions = [
    { label: 'All', value: 'ALL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' }
  ];

  // Charts
  leaveTypeChart: any;
  leaveStatusChart: any;
  leaveTrendChart: any;
  topUsersLeavesChart: any;
  chartOptions: any;
  topUsersChartOptions: any;

  // Admin actions
  showEditDialog = false;
  showDeleteDialog = false;
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

  constructor(
    private authService: AuthService,
    private leaveService: LeaveService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
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

    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (userProfile) => {
        if (userProfile) {
          this.user = userProfile;
          await this.loadDashboardData();
          this.setupCharts();
        }
      });
  }

  async loadDashboardData() {
    this.loading = true;
    this.cdr.markForCheck(); // Update UI to show loading state
    try {
      await Promise.all([
        this.loadTodaysLeaves(),
        this.loadAllLeaves(),
        this.loadQuickStats(),
        this.loadExcessCasualLeaves()
      ]);
      this.cdr.markForCheck(); // Trigger change detection after data is loaded
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.cdr.markForCheck(); // Trigger change detection on error
    } finally {
      this.loading = false;
      this.cdr.markForCheck(); // Ensure UI updates
    }
  }

  async loadTodaysLeaves() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await this.supabase
      .from('leaves')
      .select('*, users:user_id(full_name, email)')
      .lte('start_date', today)
      .gte('end_date', today)
      .eq('status', 'APPROVED')
      .order('start_date');

    this.todaysLeaves = data || [];

    // Calculate stats
    this.todayStats = {
      total: this.todaysLeaves.length,
      casual: this.todaysLeaves.filter(l => l.type === 'CASUAL').length,
      medical: this.todaysLeaves.filter(l => l.type === 'MEDICAL').length,
      compOff: this.todaysLeaves.filter(l => l.type === 'COMP_OFF').length
    };
    this.cdr.markForCheck(); // Trigger change detection
  }

  async loadAllLeaves() {
    // Load leaves filtered by selected year for accurate chart data
    const startOfYear = `${this.selectedYear}-01-01`;
    const endOfYear = `${this.selectedYear}-12-31`;
    
    const { data } = await this.supabase
      .from('leaves')
      .select('*, users:user_id(full_name, email)')
      .gte('start_date', startOfYear)
      .lte('start_date', endOfYear)
      .order('created_at', { ascending: false });

    this.allLeaves = data || [];
    this.applyFilters();
    this.cdr.markForCheck(); // Trigger change detection
  }

  async loadQuickStats() {
    // Total users
    const { count: userCount } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    this.totalUsers = userCount || 0;

    // Pending requests
    const { count: pendingCount } = await this.supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');
    this.pendingRequests = pendingCount || 0;

    // Low balance users (less than 3 leaves)
    const { count: lowBalanceCount } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .or('balance_casual.lt.3,balance_medical.lt.3');
    this.lowBalanceUsers = lowBalanceCount || 0;
    this.cdr.markForCheck(); // Trigger change detection
  }

  async loadExcessCasualLeaves() {
    if (!this.user?.organization_id) return;
    
    try {
      const { data, error } = await this.leaveService.getAllUsersExcessCasualLeaves(
        this.user.organization_id,
        this.selectedYear
      );
      
      if (error) {
        console.error('Error loading excess casual leaves:', error);
        this.usersWithExcessCasualLeaves = [];
        this.usersWithExcessCasual = 0;
        return;
      }
      
      this.usersWithExcessCasualLeaves = data || [];
      this.usersWithExcessCasual = this.usersWithExcessCasualLeaves.length;
      this.cdr.markForCheck();
    } catch (error: any) {
      console.error('Error in loadExcessCasualLeaves:', error);
      this.usersWithExcessCasualLeaves = [];
      this.usersWithExcessCasual = 0;
    }
  }

  setupCharts() {
    // Run chart setup outside Angular zone for performance, then trigger change detection
    this.ngZone.runOutsideAngular(() => {
      // Leave Type Distribution (Pie Chart)
      const typeCounts = {
        casual: this.allLeaves.filter(l => l.type === 'CASUAL' && l.status === 'APPROVED').length,
        medical: this.allLeaves.filter(l => l.type === 'MEDICAL' && l.status === 'APPROVED').length,
        compOff: this.allLeaves.filter(l => l.type === 'COMP_OFF' && l.status === 'APPROVED').length
      };

      this.leaveTypeChart = {
        labels: ['Casual Leave', 'Medical Leave', 'Comp Off'],
        datasets: [{
          data: [typeCounts.casual, typeCounts.medical, typeCounts.compOff],
          backgroundColor: ['#667eea', '#f56565', '#48bb78']
        }]
      };

      // Leave Status Distribution (Donut Chart)
      const statusCounts = {
        approved: this.allLeaves.filter(l => l.status === 'APPROVED').length,
        pending: this.allLeaves.filter(l => l.status === 'PENDING').length,
        rejected: this.allLeaves.filter(l => l.status === 'REJECTED').length
      };

      this.leaveStatusChart = {
        labels: ['Approved', 'Pending', 'Rejected'],
        datasets: [{
          data: [statusCounts.approved, statusCounts.pending, statusCounts.rejected],
          backgroundColor: ['#48bb78', '#ed8936', '#f56565']
        }]
      };

      // Top Users by Leaves (Horizontal Stacked Bar Chart)
      this.setupTopUsersLeavesChart();

      // Leave Trend (Last 6 months - Line Chart)
      const last6Months = this.getLast6MonthsData();
      this.leaveTrendChart = {
        labels: last6Months.map(m => m.month),
        datasets: [{
          label: 'Leaves Taken',
          data: last6Months.map(m => m.count),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };

      this.chartOptions = {
        plugins: {
          legend: {
            labels: {
              font: {
                family: 'Roboto'
              }
            }
          },
          tooltip: {
            callbacks: {
              footer: (tooltipItems: any) => {
                const totals = (this.topUsersLeavesChart as any)?.totals;
                if (totals && tooltipItems.length > 0) {
                  const dataIndex = tooltipItems[0].dataIndex;
                  return `Total: ${totals[dataIndex].toFixed(1)} days`;
                }
                return '';
              }
            }
          }
        },
        indexAxis: 'y', // Horizontal bar chart
        scales: {
          x: {
            beginAtZero: true,
            stacked: true,
            ticks: {
              stepSize: 1
            }
          },
          y: {
            stacked: true
          }
        }
      };
      
      // Run back in Angular zone and trigger change detection
      this.ngZone.run(() => {
        this.cdr.markForCheck();
      });
    });
  }

  setupTopUsersLeavesChart() {
    // Group leaves by user and type
    const userLeavesMap: { [key: string]: { name: string; casual: number; medical: number; compOff: number; total: number } } = {};

    this.allLeaves
      .filter(l => l.status === 'APPROVED')
      .forEach(leave => {
        const userId = leave.user_id;
        const userName = leave.users?.full_name || leave.users?.email || 'Unknown';
        
        if (!userLeavesMap[userId]) {
          userLeavesMap[userId] = {
            name: userName,
            casual: 0,
            medical: 0,
            compOff: 0,
            total: 0
          };
        }

        const days = leave.days_count || (leave.is_half_day ? 0.5 : 1);
        
        if (leave.type === 'CASUAL') {
          userLeavesMap[userId].casual += days;
        } else if (leave.type === 'MEDICAL') {
          userLeavesMap[userId].medical += days;
        } else if (leave.type === 'COMP_OFF') {
          userLeavesMap[userId].compOff += days;
        }
        
        userLeavesMap[userId].total += days;
      });

    // Convert to array and sort by total (descending)
    const userLeavesArray = Object.values(userLeavesMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10 users

    // Prepare chart data
    const labels = userLeavesArray.map(u => u.name);
    const casualData = userLeavesArray.map(u => u.casual);
    const medicalData = userLeavesArray.map(u => u.medical);
    const compOffData = userLeavesArray.map(u => u.compOff);
    const totalData = userLeavesArray.map(u => u.total);

    this.topUsersLeavesChart = {
      labels: labels,
      datasets: [
        {
          label: 'Casual Leave',
          data: casualData,
          backgroundColor: '#667eea',
          borderColor: '#667eea',
          borderWidth: 1
        },
        {
          label: 'Medical Leave',
          data: medicalData,
          backgroundColor: '#f56565',
          borderColor: '#f56565',
          borderWidth: 1
        },
        {
          label: 'Comp Off',
          data: compOffData,
          backgroundColor: '#48bb78',
          borderColor: '#48bb78',
          borderWidth: 1
        }
      ]
    };

    // Store totals for display
    (this.topUsersLeavesChart as any).totals = totalData;

    // Set up chart options for horizontal stacked bar
    this.topUsersChartOptions = {
      indexAxis: 'y', // Horizontal bar chart
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              family: 'Roboto',
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            footer: (tooltipItems: any) => {
              const totals = (this.topUsersLeavesChart as any)?.totals;
              if (totals && tooltipItems.length > 0) {
                const dataIndex = tooltipItems[0].dataIndex;
                return `Total: ${totals[dataIndex].toFixed(1)} days`;
              }
              return '';
            }
          }
        },
        // Custom plugin to show total at end of each bar
        afterDatasetsDraw: (chart: any) => {
          const ctx = chart.ctx;
          const totals = (this.topUsersLeavesChart as any)?.totals;
          if (!totals) return;

          // Get the first dataset to draw labels once per bar
          const meta = chart.getDatasetMeta(0);
          meta.data.forEach((element: any, index: number) => {
            const total = totals[index];
            if (total > 0) {
              // Get the rightmost position of the stacked bar
              const xScale = chart.scales.x;
              const yScale = chart.scales.y;
              const xPos = xScale.getPixelForValue(total);
              const yPos = element.y;
              
              ctx.save();
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.font = 'bold 12px Roboto';
              ctx.fillStyle = '#1A1A1A';
              // Draw text slightly to the right of the bar end
              ctx.fillText(`${total.toFixed(1)}`, xPos + 8, yPos);
              ctx.restore();
            }
          });
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          stacked: true,
          ticks: {
            stepSize: 1,
            font: {
              family: 'Roboto'
            }
          },
          title: {
            display: true,
            text: 'Days',
            font: {
              family: 'Roboto',
              size: 12
            }
          }
        },
        y: {
          stacked: true,
          ticks: {
            font: {
              family: 'Roboto'
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  getLast6MonthsData() {
    const months = [];
    const selectedYear = this.selectedYear;

    // Get last 6 months of the selected year (July to December)
    for (let i = 5; i >= 0; i--) {
      const date = new Date(selectedYear, 11 - i, 1); // Start from December and go back
      const monthName = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      // Count leaves in this month for the selected year
      const count = this.allLeaves.filter(l =>
        l.start_date >= startDate &&
        l.start_date <= endDate &&
        l.status === 'APPROVED'
      ).length;

      months.push({ month: `${monthName} ${year}`, count });
    }

    return months;
  }

  applyFilters() {
    let filtered = [...this.allLeaves];

    // Status filter
    if (this.selectedStatus !== 'ALL') {
      filtered = filtered.filter(l => l.status === this.selectedStatus);
    }

    // Year filter is already applied in loadAllLeaves, but we can add additional filtering here if needed
    // All leaves in allLeaves are already filtered by selectedYear

    this.filteredLeaves = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  async onYearChange() {
    // Reload data when year changes
    await Promise.all([
      this.loadAllLeaves(),
      this.loadExcessCasualLeaves()
    ]);
    this.setupCharts();
  }

  clearFilters() {
    this.selectedStatus = 'ALL';
    // Year remains the same, only clear status filter
    this.applyFilters();
  }

  getStatusSeverity(status: string): any {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'PENDING': return 'warning';
      default: return 'info';
    }
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'CASUAL': return 'badge-casual';
      case 'MEDICAL': return 'badge-medical';
      case 'COMP_OFF': return 'badge-compoff';
      default: return '';
    }
  }

  // Admin actions
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

  async saveEdit() {
    if (!this.selectedLeave) return;

    const updates: any = {
      start_date: this.editForm.start_date.toISOString().split('T')[0],
      end_date: this.editForm.end_date.toISOString().split('T')[0],
      type: this.editForm.type,
      reason: this.editForm.reason,
      is_half_day: this.editForm.is_half_day
    };

    // Admin can edit any leave - if it was approved, keep it approved (balance already handled in service)
    // If it was pending, keep it pending
    if (this.selectedLeave.status === 'APPROVED') {
      updates.status = 'APPROVED'; // Keep approved status for admin edits
    }

    if (this.editForm.is_half_day) {
      updates.half_day_slot = this.editForm.half_day_slot;
    }

    const { error } = await this.leaveService.editLeave(this.selectedLeave.id, updates);
    
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update leave.' });
    } else {
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Leave updated successfully.' });
      this.closeEditDialog();
      await this.loadDashboardData();
      this.setupCharts();
    }
  }

  confirmCancel(leave: any) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to cancel this leave?',
      header: 'Cancel Leave',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        const { error } = await this.leaveService.cancelLeave(leave.id);
        if (error) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to cancel leave.' });
        } else {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Leave cancelled successfully.' });
          await this.loadDashboardData();
          this.setupCharts();
        }
      }
    });
  }

  confirmDelete(leave: any) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this leave? This action cannot be undone.',
      header: 'Delete Leave',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        const { error } = await this.leaveService.deleteLeave(leave.id);
        if (error) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete leave.' });
        } else {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Leave deleted successfully.' });
          await this.loadDashboardData();
          this.setupCharts();
        }
      }
    });
  }

  isAdmin(): boolean {
    return this.user?.role === 'SUPER_ADMIN' || this.user?.role === 'HR' || this.user?.role === 'ADMIN';
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
