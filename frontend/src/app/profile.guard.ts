import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { ApiService } from './services/api.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfileGuard implements CanActivate {
  private keycloakService = inject(KeycloakService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
    const loggedIn = await this.keycloakService.isLoggedIn();
    
    if (!loggedIn) {
      // On ne force plus la redirection automatique pour éviter les plantages
      return true; 
    }
    
    try {
      const profile = await this.keycloakService.loadUserProfile();
      if (!profile || !profile.id) return false;
      
      const user = await firstValueFrom(this.apiService.getUserByKeycloakId(profile.id));
      const isComplete = !!(user && user.profileComplete);
      
      if (isComplete) {
        if (state.url.includes('onboarding')) {
          this.router.navigate(['/dashboard']);
          return false;
        }
        return true;
      } else {
        if (state.url.includes('onboarding')) return true;
        this.router.navigate(['/onboarding']);
        return false;
      }
    } catch (error) {
      if (state.url.includes('onboarding')) return true;
      this.router.navigate(['/onboarding']);
      return false;
    }
  }
}
