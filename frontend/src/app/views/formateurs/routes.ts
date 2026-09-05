import { Routes } from '@angular/router';
import { FormateursComponent } from './formateurs.component';

export const routes: Routes = [
  {
    path: '',
    component: FormateursComponent,
    data: { title: 'Formateurs' }
  }
];
