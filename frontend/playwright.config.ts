import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout — LINSOFT Learning Center.
 *
 * Ils s'exécutent contre une plateforme réellement démarrée (docker compose) :
 * navigateur réel, Keycloak réel, API réelle. C'est le seul étage capable de
 * prouver que la chaîne complète — redirection Keycloak, jeton, gateway,
 * microservice, rendu Angular — fonctionne ensemble.
 *
 * Prérequis :
 *   docker compose up -d
 *   powershell -File scripts/seed-test-data.ps1   (jeu de données de test)
 *
 * Lancement :
 *   npm run e2e            # sans interface
 *   npm run e2e:headed     # en observant le navigateur
 */
export default defineConfig({
  testDir: './e2e',
  // L'authentification Keycloak passe par plusieurs redirections : le défaut
  // de 30 s est trop court sur une machine chargée.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // Un échec en CI vient rarement d'un aléa : on préfère le voir plutôt que de
  // le masquer par des relances. Une seule reprise, pour absorber la latence
  // de démarrage de Keycloak.
  retries: process.env['CI'] ? 1 : 0,

  // Séquentiel : les scénarios partagent le même jeu de données seedé et
  // certains modifient l'état (envoi de certificat).
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],

  reporter: process.env['CI']
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
