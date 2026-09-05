import { Routes } from '@angular/router';
import { RegistrationsComponent } from './registrations.component';

export const routes: Routes = [
  {
    path: '',
    component: RegistrationsComponent,
    data: { title: 'Inscriptions' }
  }
];
