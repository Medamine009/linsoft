import { Routes } from '@angular/router';
import { UserComponent } from './user.component';

export const routes: Routes = [
  { path: '', component: UserComponent, data: { title: 'Explorer' } },
  { path: 'planning', component: UserComponent, data: { title: 'Planning' } },
  { path: 'wallet', component: UserComponent, data: { title: 'Mes inscriptions' } }
];
