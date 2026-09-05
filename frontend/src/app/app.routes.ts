import { Routes } from '@angular/router';
import { RoleGuard } from './role.guard';
import { AuthGuard } from './auth.guard';

export const routes: Routes = [
  {
    path: 'welcome',
    loadComponent: () => import('./views/welcome/welcome.component').then(m => m.WelcomeComponent),
    data: { title: 'Bienvenue' }
  },
  {
    path: 'ticket/:id',
    loadComponent: () => import('./views/ticket-view/ticket-view.component').then(m => m.TicketViewComponent),
    data: { title: 'Mon billet' }
  },
  {
    path: '',
    loadComponent: () => import('./layout').then(m => m.DefaultLayoutComponent),
    canActivate: [AuthGuard],
    data: { title: 'LINSOFT Learning Center' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadChildren: () => import('./views/dashboard/routes').then(m => m.routes) },
      // Accueil commun (role-aware) à tous les collaborateurs authentifiés
      { path: 'home', loadChildren: () => import('./views/home/routes').then(m => m.routes) },
      // Pages d'administration — ADMIN uniquement
      {
        path: 'events',
        loadChildren: () => import('./views/events/routes').then(m => m.routes),
        canActivate: [RoleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'users',
        loadChildren: () => import('./views/users/routes').then(m => m.routes),
        canActivate: [RoleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'formateurs',
        loadChildren: () => import('./views/formateurs/routes').then(m => m.routes),
        canActivate: [RoleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'registrations',
        loadChildren: () => import('./views/registrations/routes').then(m => m.routes),
        canActivate: [RoleGuard], data: { roles: ['ADMIN'] }
      },
      // Pages communes à tous les rôles authentifiés
      { path: 'profile', loadChildren: () => import('./views/profile/routes').then(m => m.routes) },
      {
        path: 'admin',
        loadChildren: () => import('./views/admin/routes').then(m => m.routes),
        canActivate: [RoleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'organizer',
        loadChildren: () => import('./views/organizer/routes').then(m => m.routes),
        canActivate: [RoleGuard], data: { roles: ['ORGANISATEUR'] }
      },
      {
        path: 'checkin',
        loadChildren: () => import('./views/checkin/routes').then(m => m.routes),
        canActivate: [RoleGuard], data: { roles: ['ORGANISATEUR', 'ADMIN'] }
      },
      {
        path: 'user',
        loadChildren: () => import('./views/user/routes').then(m => m.routes),
        canActivate: [RoleGuard], data: { roles: ['PARTICIPANT'] }
      }
    ]
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./views/pages/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    data: { title: 'Bienvenue' }
  },
  { path: '**', redirectTo: 'welcome' }
];
