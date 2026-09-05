import { APP_INITIALIZER } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import keycloakConfig from './keycloak.config';

export function initializeKeycloak(keycloak: KeycloakService) {
  return () =>
    keycloak.init({
      config: keycloakConfig,
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
        checkLoginIframe: false
      },
      // L'intercepteur intégré de keycloak-angular utilise une Promise hors NgZone,
      // ce qui casse la change detection sur les réponses HTTP. On le désactive et
      // notre auth.interceptor.ts (synchrone) prend le relais.
      enableBearerInterceptor: false
    }).catch((e) => {
      console.warn('Keycloak init failed (continuing as guest):', e);
      return false;
    });
}

export const keycloakProviders = [
  {
    provide: APP_INITIALIZER,
    useFactory: initializeKeycloak,
    multi: true,
    deps: [KeycloakService]
  },
  KeycloakService
];