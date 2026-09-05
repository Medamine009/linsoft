import { test, expect } from '@playwright/test';
import { login, resetSession } from './support/auth';

/**
 * Parcours métier complet : suivi de participation et cycle du certificat.
 *
 * <p>Ces scénarios s'appuient sur le jeu de données de
 * `scripts/seed-test-data.ps1`, où le participant `y.gharbi` porte à lui seul
 * les cinq états : session à venir, session en cours, certificat en préparation,
 * en attente de validation, et délivré.</p>
 */
test.describe('Suivi de participation et certificats', () => {

  test.beforeEach(async ({ page }) => {
    await resetSession(page);
  });

  test('le participant voit sa progression et l’état de chaque certificat', async ({ page }) => {
    await login(page, 'participant');
    await page.goto('/user/wallet');

    await expect(page.getByRole('heading', { name: /Mes inscriptions/i })).toBeVisible();

    // Les quatre états du certificat doivent être lisibles tels quels par le
    // participant : c'est le libellé qui fait foi pour lui.
    const body = page.locator('body');
    await expect(body).toContainText(/En préparation/i);
    await expect(body).toContainText(/En attente de validation/i);
    await expect(body).toContainText(/Disponible au téléchargement/i);

    // Le message explicite exigé par le workflow.
    await expect(body).toContainText(/certificat est en cours de préparation/i);
  });

  test('la progression est affichée avec ses jalons', async ({ page }) => {
    await login(page, 'participant');
    await page.goto('/user/wallet');

    const body = page.locator('body');
    await expect(body).toContainText(/Votre progression/i);
    await expect(body).toContainText(/Inscription validée/i);
    await expect(body).toContainText(/Session terminée/i);
    // Une session en cours affiche un pourcentage intermédiaire.
    await expect(body).toContainText(/%/);
  });

  test('le bouton de téléchargement n’apparaît que sur un certificat délivré', async ({ page }) => {
    await login(page, 'participant');
    await page.goto('/user/wallet');

    await expect(page.getByRole('heading', { name: /Mes inscriptions/i })).toBeVisible();

    const download = page.getByRole('button', { name: /Télécharger le PDF/i });
    // Exactement un certificat est à l'état SENT dans le jeu de données.
    await expect(download).toHaveCount(1);
  });

  test('l’administrateur voit la file des certificats à traiter', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin?tab=certificates');

    await expect(page.getByRole('heading', { name: /Gestion des certificats/i })).toBeVisible();

    const body = page.locator('body');
    // La file est groupée par session terminée, avec les deux actions possibles.
    await expect(body).toContainText(/certificat\(s\) à traiter/i);
    await expect(page.getByRole('button', { name: /Envoyer le certificat/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Garder en attente/i }).first()).toBeVisible();
  });

  test('le tableau de bord admin signale les certificats en attente', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: /Tableau de bord/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/Certificats à délivrer/i);
  });

  test('le catalogue liste les sessions publiées', async ({ page }) => {
    await login(page, 'participant');
    await page.goto('/user');

    await expect(page.getByRole('heading', { name: /Catalogue de formations/i })).toBeVisible();
    // Le jeu de données publie 7 sessions ; la 8e est en attente de modération
    // et ne doit donc pas apparaître côté participant.
    await expect(page.locator('body')).toContainText(/Kubernetes Administrator/i);
    await expect(page.locator('body')).not.toContainText(/Terraform sur Azure/i);
  });
});
