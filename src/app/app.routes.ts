import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard } from './guards/auth.guard';
import { adminOnlyGuard } from './guards/role.guard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
            {
                path: '',
                loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
            {
                path: 'leaves/apply',
                loadComponent: () => import('./pages/apply-leave/apply-leave.component').then(m => m.ApplyLeaveComponent)
            },
            {
                path: 'approvals',
                loadComponent: () => import('./pages/approvals/approvals.component').then(m => m.ApprovalsComponent)
            },
            {
                path: 'hr-dashboard',
                loadComponent: () => import('./pages/hr-dashboard/hr-dashboard.component').then(m => m.HrDashboardComponent)
            },
            {
                path: 'comp-offs',
                loadComponent: () => import('./pages/comp-offs/comp-offs.component').then(m => m.CompOffsComponent)
            },
            {
                path: 'users',
                loadComponent: () => import('./pages/users/users.component').then(m => m.UsersComponent)
            },
            {
                path: 'groups',
                loadComponent: () => import('./pages/groups/groups.component').then(m => m.GroupsComponent)
            },
            {
                path: 'organizations',
                loadComponent: () => import('./pages/organizations/organizations.component').then(m => m.OrganizationsComponent)
            },
            {
                path: 'leave-settings',
                loadComponent: () => import('./pages/leave-settings/leave-settings.component').then(m => m.LeaveSettingsComponent),
                canActivate: [authGuard, adminOnlyGuard]
            },
            {
                path: 'public-holidays',
                loadComponent: () => import('./pages/public-holidays/public-holidays.component').then(m => m.PublicHolidaysComponent),
                canActivate: [authGuard]
            },
            {
                path: 'user-dashboard/:userId',
                loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
                canActivate: [authGuard]
            },
            {
                path: 'leave-archives',
                loadComponent: () => import('./pages/leave-archives/leave-archives.component').then(m => m.LeaveArchivesComponent),
                canActivate: [authGuard]
            },
        ]
    },
    { path: '**', redirectTo: '' }
];
