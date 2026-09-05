import { test, expect } from '@playwright/test';
import { gotoLoginForm, login, resetSession, USERS } from './support/auth';

/**
 * Authentification et cloisonnement des rôles.
 *
 * <p>C'est le socle de sécurité de la plateforme : chaque rôle doit atteindre
 * son espace, et surtout ne pas atteindre celui des autres. Ces scénarios
 * traversent réellement Keycloak, le gateway et les microservices.</p>
 */
test.describe('Authentification et rôles', () => {

  test.beforeEach(async ({ page }) => {
    await resetSession(page);
  });

  test('un visiteur non authentifié est renvoyé sur la page publique', async ({ page }) => {
    await page.goto('/user');

    // AuthGuard : pas de session -> accueil public, jamais l'espace protégé.
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
  });

  test('un identifiant invalide est refusé par Keycloak', async ({ page }) => {
    await gotoLoginForm(page);

    await page.locator('#username').fill(USERS.participant.username);
    await page.locator('#password').fill('mauvais-mot-de-passe');
    await page.locator('#kc-login').click();

    // On reste sur Keycloak, avec le message d'erreur du realm : aucun accès accordé.
    await expect(page).toHaveURL(/\/realms\/pfe-events/);
    await expect(page.locator('body'))
      .toContainText(/Identifiant ou mot de passe incorrect|Invalid username or password/i);
    // Aucun jeton n'a été délivré : l'application reste inaccessible.
    await page.goto('/user');
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
  });

  test('le participant accède à son espace formation', async ({ page }) => {
    await login(page, 'participant');
    await page.goto('/user');

    await expect(page).toHaveURL(/\/user/);
    await expect(page.getByRole('heading', { name: /Catalogue de formations/i })).toBeVisible();
  });

  test('l’administrateur accède à son tableau de bord', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: /Tableau de bord/i })).toBeVisible();
  });

  test('le formateur accède à son studio', async ({ page }) => {
    await login(page, 'organisateur');
    await page.goto('/organizer');

    await expect(page).toHaveURL(/\/organizer/);
  });

  test('un participant ne peut pas ouvrir le tableau de bord administrateur', async ({ page }) => {
    await login(page, 'participant');

    await page.goto('/admin');

    // Le RoleGuard doit le détourner : il ne doit jamais voir la page admin.
    await expect(page).not.toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: /Modération|Gestion des certificats/i }))
      .toHaveCount(0);
  });

  test('un participant ne peut pas ouvrir la gestion des utilisateurs', async ({ page }) => {
    await login(page, 'participant');

    await page.goto('/users');

    await expect(page).not.toHaveURL(/\/users$/);
  });

  test('un formateur ne peut pas ouvrir la gestion des certificats', async ({ page }) => {
    await login(page, 'organisateur');

    await page.goto('/admin?tab=certificates');

    // La délivrance des certificats est réservée à l'administration.
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
