import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { primaryRole } from './shared/role';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private keycloak: KeycloakService, private router: Router) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const allowedRoles = ((route.data['roles'] as string[]) || []).map(r => r.toUpperCase());
    const isLoggedIn = await this.keycloak.isLoggedIn();
    if (!isLoggedIn) {
      this.router.navigate(['/welcome']);
      return false;
    }

    // On raisonne sur le rôle EFFECTIF (le plus élevé), pas sur "possède le rôle" :
    // un admin/organisateur possède aussi PARTICIPANT mais ne doit pas voir l'espace participant.
    const role = primaryRole(await this.keycloak.getUserRoles(true));
    if (allowedRoles.includes(role)) {
      return true;
    }

    await this.router.navigate(['/dashboard']);
    return false;
  }
}