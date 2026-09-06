import { test, expect } from '@playwright/test';
import { login, resetSession, dismissSplash } from './support/auth';

/**
 * Captures d'écran pour le rapport PFE.
 *
 * <p>Ce fichier ne teste rien : il produit les illustrations du rapport à partir
 * de la plateforme réellement démarrée et du jeu de données seedé. Les images
 * sont donc toujours conformes à l'état courant de l'application, contrairement
 * à des captures prises à la main qui vieillissent en silence.</p>
 *
 * <p>Exécution (hors suite de tests habituelle) :</p>
 * <pre>npm run captures</pre>
 */

const DIR = '../rapport-pfe/captures';

test.describe('Captures pour le rapport', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await resetSession(page);
  });

  test('accueil public', async ({ page }) => {
    await page.goto('/welcome');
    await dismissSplash(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${DIR}/01-accueil-public.png` });
  });

  test('connexion Keycloak', async ({ page }) => {
    await page.goto('/welcome');
    await dismissSplash(page);
    await page.getByRole('button', { name: /Se connecter/i }).first().click();
    await page.waitForURL(/\/realms\/pfe-events/, { timeout: 60_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${DIR}/02-connexion-keycloak.png` });
  });

  test('catalogue participant', async ({ page }) => {
    await login(page, 'participant');
    await page.goto('/user');
    await expect(page.getByRole('heading', { name: /Catalogue de formations/i })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/03-catalogue.png`, fullPage: true });
  });

  test('suivi de participation et certificats', async ({ page }) => {
    await login(page, 'participant');
    await page.goto('/user/wallet');
    await expect(page.getByRole('heading', { name: /Mes inscriptions/i })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/04-suivi-certificats.png`, fullPage: true });
  });

  test('tableau de bord administrateur', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Tableau de bord/i })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/05-admin-dashboard.png`, fullPage: true });
  });

  test('gestion des certificats', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin?tab=certificates');
    await expect(page.getByRole('heading', { name: /Gestion des certificats/i })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/06-gestion-certificats.png`, fullPage: true });
  });

  test('moderation des sessions', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin?tab=review');
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${DIR}/07-moderation.png`, fullPage: true });
  });

  // ─── Supervision : hors application, pas d'authentification applicative ───

  test('cibles Prometheus', async ({ page }) => {
    await page.goto('http://localhost:9090/targets', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${DIR}/08-prometheus-cibles.png`, fullPage: true });
  });

  test('tableau de bord Grafana', async ({ page }) => {
    // Connexion Grafana (identifiants de démonstration locale).
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.locator('input[name="user"]').fill('admin');
    await page.locator('input[name="password"]').fill('admin');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    await page.goto('http://localhost:3000/d/linsoft-plateforme?from=now-3h&to=now&kiosk',
                    { waitUntil: 'networkidle' });
    // Laisse le temps aux panneaux d'interroger Prometheus et de se dessiner.
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${DIR}/09-grafana-plateforme.png`, fullPage: true });
  });

  test('boite de reception MailHog', async ({ page }) => {
    await page.goto('http://localhost:8025/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${DIR}/10-mailhog.png` });
  });

  test('tableau de bord Eureka', async ({ page }) => {
    await page.goto('http://localhost:8761/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/11-eureka.png`, fullPage: true });
  });

  test('interface RabbitMQ', async ({ page }) => {
    await page.goto('http://localhost:15672/', { waitUntil: 'networkidle' });
    const user = page.locator('input[name="username"]');
    if (await user.isVisible().catch(() => false)) {
      await user.fill('guest');
      await page.locator('input[name="password"]').fill('guest');
      await page.locator('input[type="submit"]').click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: `${DIR}/12-rabbitmq.png` });
  });
});
