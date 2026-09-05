import { Routes } from '@angular/router';
import { OrganizerComponent } from './organizer.component';

export const routes: Routes = [
  { path: '', component: OrganizerComponent, data: { title: 'Mon studio' } },
  { path: 'create', component: OrganizerComponent, data: { title: 'Créer un événement' } }
];
