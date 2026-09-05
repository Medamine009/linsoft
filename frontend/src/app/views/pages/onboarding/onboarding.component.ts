import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { ApiService } from '../../../services/api.service';
import { 
  CardModule, 
  GridModule, 
  FormModule, 
  ButtonModule, 
  AvatarModule,
  TooltipModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    CardModule, 
    GridModule, 
    FormModule, 
    ButtonModule, 
    AvatarModule,
    IconDirective,
    TooltipModule
  ],
  templateUrl: './onboarding.component.html'
})
export class OnboardingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private keycloakService = inject(KeycloakService);
  private router = inject(Router);

  onboardingForm: FormGroup = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9+ ]+$')]],
    bio: ['', [Validators.required, Validators.minLength(20)]],
    photoUrl: ['']
  });

  previewUrl: string | null = null;
  loading = false;
  userEmail: string = '';
  keycloakId: string = '';

  async ngOnInit() {
    const profile = await this.keycloakService.loadUserProfile();
    this.userEmail = profile.email || '';
    this.keycloakId = profile.id || '';
    
    this.onboardingForm.patchValue({
      firstName: profile.firstName,
      lastName: profile.lastName
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewUrl = e.target.result;
        this.onboardingForm.patchValue({ photoUrl: e.target.result });
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    if (this.onboardingForm.valid) {
      this.loading = true;
      const roles = this.keycloakService.getUserRoles();
      const formData = {
        ...this.onboardingForm.value,
        email: this.userEmail,
        keycloakId: this.keycloakId,
        profileComplete: true,
        role: roles.includes('ADMIN') ? 'ADMIN' : 
              roles.includes('ORGANISATEUR') ? 'ORGANISATEUR' : 'PARTICIPANT'
      };

      this.apiService.updateUser(this.keycloakId, formData).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          // Si l'utilisateur n'existe pas encore dans notre DB, on le crée
          this.apiService.createUser(formData).subscribe({
            next: () => this.router.navigate(['/dashboard']),
            error: () => this.loading = false
          });
        }
      });
    }
  }
}
