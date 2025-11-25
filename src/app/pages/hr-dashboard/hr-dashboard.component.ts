import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { DropdownModule } from 'primeng/dropdown';
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
    DropdownModule,
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

  // Filters
  dateRange: Date[] = [];
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
  chartOptions: any;

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
    private confirmationService: ConfirmationService
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  ngOnInit() {
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
    try {
      await Promise.all([
        this.loadTodaysLeaves(),
        this.loadAllLeaves(),
        this.loadQuickStats()
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      this.loading = false;
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
  }

  async loadAllLeaves() {
    const { data } = await this.supabase
      .from('leaves')
      .select('*, users:user_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);

    this.allLeaves = data || [];
    this.applyFilters();
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
  }

  setupCharts() {
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
        }
      }
    };
  }

  getLast6MonthsData() {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

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

    // Date range filter
    if (this.dateRange && this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
      const start = this.dateRange[0].toISOString().split('T')[0];
      const end = this.dateRange[1].toISOString().split('T')[0];
      filtered = filtered.filter(l => l.start_date >= start && l.start_date <= end);
    }

    this.filteredLeaves = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.selectedStatus = 'ALL';
    this.dateRange = [];
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
