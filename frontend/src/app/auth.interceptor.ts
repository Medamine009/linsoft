import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

/**
 * Intercepteur JWT — version SYNCHRONE qui lit le token directement
 * depuis l'instance Keycloak. Évite tout Promise hors zone Angular,
 * ce qui garantit que les réponses HTTP déclenchent la change detection.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloak = inject(KeycloakService);

  // Pas de token pour les requêtes hors-API
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  // Lecture SYNCHRONE du token (pas de Promise)
  let token: string | undefined;
  try {
    token = keycloak.getKeycloakInstance()?.token;
  } catch {
    token = undefined;
  }

  if (token) {
    const authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    return next(authReq);
  }
  return next(req);
};
