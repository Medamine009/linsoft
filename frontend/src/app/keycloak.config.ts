// `KeycloakConfig` est une union (serveur Keycloak | fournisseur OIDC générique) :
// annoter avec l'union rendait `config.url` et `config.realm` inaccessibles, car
// la variante OIDC générique ne les porte pas. On type donc précisément la
// variante utilisée ici — un serveur Keycloak — ce qui reste assignable partout
// où `KeycloakConfig` est attendu.
import type { KeycloakServerConfig } from 'keycloak-js';

// L'URL de Keycloak est derivee de l'origine courante :
//  - en local        : http://localhost:8085
//  - sur OpenShift    : la Route keycloak (meme domaine, prefixe eventify- -> keycloak-)
function resolveKeycloakUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8085';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8085';
  return `${window.location.protocol}//${host.replace(/^eventify-/, 'keycloak-')}`;
}

const keycloakConfig: KeycloakServerConfig = {
  url: resolveKeycloakUrl(),
  realm: 'pfe-events',
  clientId: 'pfe-events-frontend'
};

export default keycloakConfig;
