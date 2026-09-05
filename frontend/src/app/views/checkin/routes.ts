import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./checkin.component').then(m => m.CheckinComponent),
    data: { title: 'Check-in' }
  }
];
