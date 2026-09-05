import { Page, expect } from '@playwright/test';

/**
 * Comptes du jeu de données de test (scripts/seed-test-data.ps1).
 *
 * Seuls les comptes créés par le script sont utilisés : leur mot de passe est
 * connu et reproductible. Les comptes historiques du projet conservent leur
 * mot de passe d'origine et ne peuvent donc pas servir en automatisation.
 */
export const USERS = {
  admin: { username: 's.benamor', password: 'Linsoft2026!', name: 'Sonia' },
  organisateur: { username: 'k.haddad', password: 'Linsoft2026!', name: 'Karim' },
  /** Participant couvrant les cinq états de certificat. */
  participant: { username: 'y.gharbi', password: 'Linsoft2026!', name: 'Yassine' }
} as const;

export type Role = keyof typeof USERS;

/**
 * Amène le navigateur sur le formulaire Keycloak.
 *
 * <p>L'application s'initialise en `check-sso` : elle ne redirige jamais d'elle
 * même vers Keycloak. Un visiteur non authentifié est envoyé par l'AuthGuard sur
 * la page publique `/welcome`, d'où la connexion est une action explicite
 * (`keycloak.login()`). Le parcours réel est donc : /welcome -> clic -> Keycloak.</p>
 */
/**
 * Écarte l'écran d'accueil animé s'il est présent.
 *
 * <p>`SplashComponent` recouvre l'application au premier chargement et ne
 * révèle son bouton qu'après 1,4 s. Tant qu'il est là, aucun élément de la page
 * en dessous n'est atteignable.</p>
 */
export async function dismissSplash(page: Page): Promise<void> {
  const enter = page.getByRole('button', { name: /Accéder à la plateforme/i });

  // `isVisible()` ne patiente pas : il répond immédiatement. Or le bouton
  // n'apparaît qu'après la phase 2 du splash (1,4 s). Il faut donc réellement
  // attendre son apparition, sinon on conclut à tort qu'il n'y a pas de splash.
  try {
    await enter.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return;   // pas de splash sur cette page
  }

  await enter.click();
  // L'animation de sortie dure 600 ms avant que le splash ne soit retiré du DOM.
  await enter.waitFor({ state: 'detached', timeout: 15_000 }).catch(() => { /* déjà parti */ });
}

export async function gotoLoginForm(page: Page): Promise<void> {
  await page.goto('/welcome');
  await dismissSplash(page);
  await page.getByRole('button', { name: /Se connecter/i }).first().click();
  await page.waitForURL(/\/realms\/pfe-events\/protocol\/openid-connect\/auth/, { timeout: 60_000 });
}

/**
 * Connexion complète via Keycloak.
 *
 * On attend explicitement le retour sur l'application : entre le clic et
 * l'arrivée sur `/dashboard` il y a plusieurs redirections (Keycloak, callback,
 * aiguillage par rôle).
 */
export async function login(page: Page, role: Role): Promise<void> {
  const user = USERS[role];

  await gotoLoginForm(page);

  await page.locator('#username').fill(user.username);
  await page.locator('#password').fill(user.password);
  await page.locator('#kc-login').click();

  // Retour sur l'application : plus aucune URL Keycloak.
  await page.waitForURL(url => !url.href.includes('/realms/'), { timeout: 60_000 });
  // L'aiguilleur /dashboard renvoie vers l'espace du rôle : on attend qu'il ait
  // fini, sinon les assertions porteraient sur une page transitoire.
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => { /* tolérant */ });
}

/** Déconnexion best-effort : on repart d'une session vierge entre scénarios. */
export async function resetSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* origine non accessible */ }
  });
}
