import { Routes } from '@angular/router';

import { EventsComponent } from './events.component';

export const routes: Routes = [
  {
    path: '',
    component: EventsComponent,
    data: { title: 'Événements' }
  }
];
