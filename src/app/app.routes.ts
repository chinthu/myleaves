import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard } from './guards/auth.guard';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ApplyLeaveComponent } from './pages/apply-leave/apply-leave.component';
import { ApprovalsComponent } from './pages/approvals/approvals.component';
import { HrDashboardComponent } from './pages/hr-dashboard/hr-dashboard.component';
import { CompOffsComponent } from './pages/comp-offs/comp-offs.component';
import { UsersComponent } from './pages/users/users.component';
import { GroupsComponent } from './pages/groups/groups.component';
import { OrganizationsComponent } from './pages/organizations/organizations.component';
import { PublicHolidaysComponent } from './pages/public-holidays/public-holidays.component';
import { LeaveSettingsComponent } from './pages/leave-settings/leave-settings.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: '', component: DashboardComponent },
            { path: 'leaves/apply', component: ApplyLeaveComponent },
            { path: 'approvals', component: ApprovalsComponent },
            { path: 'hr-dashboard', component: HrDashboardComponent },
            { path: 'comp-offs', component: CompOffsComponent },
            { path: 'users', component: UsersComponent },
            { path: 'groups', component: GroupsComponent },
            { path: 'organizations', component: OrganizationsComponent },
            {
                path: 'leave-settings',
                loadComponent: () => import('./pages/leave-settings/leave-settings.component').then(m => m.LeaveSettingsComponent),
                canActivate: [authGuard]
            },
            {
                path: 'public-holidays',
                loadComponent: () => import('./pages/public-holidays/public-holidays.component').then(m => m.PublicHolidaysComponent),
                canActivate: [authGuard]
            },
        ]
    },
    { path: '**', redirectTo: '' }
];
