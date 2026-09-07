import { test, expect } from '@playwright/test';
import { login, resetSession } from './support/auth';
import * as path from 'path';

/**
 * Captures complémentaires destinées au rapport PFE de l'étudiant.
 *
 * <p>Contrairement à `captures.spec.ts`, qui alimente le dossier `captures/` du
 * dépôt, ce fichier écrit directement dans le dossier `img/` du rapport LaTeX.
 * Il couvre ce qui manquait encore d'illustration : le formulaire d'avis, le
 * certificat au format PDF et la chaîne d'intégration continue GitHub Actions.</p>
 *
 * <p>Exécution : <pre>npm run captures:rapport</pre></p>
 */

const IMG = process.env['RAPPORT_IMG_DIR']
  ?? 'C:/Users/DELL/Desktop/Rapport/Rapport PFE amine/img';

const REPO = 'https://github.com/Medamine009/linsoft';
/** Exécution la plus récente de la chaîne (run #11, tout au vert). */
const RUN_ID = process.env['CI_RUN_ID'] ?? '34137468238';

test.describe('Captures du rapport', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
  });

  // ───────────────────────── Application ─────────────────────────

  test('formulaire de dépôt d\'avis', async ({ page }) => {
    await resetSession(page);
    await login(page, 'participant');
    await page.goto('/user/wallet');
    await expect(page.getByRole('heading', { name: /Mes inscriptions/i })).toBeVisible();

    // On ouvre la fiche d'une session terminée : le formulaire d'avis n'est
    // proposé qu'aux participants ayant effectivement suivi la session.
    await page.getByRole('button', { name: /Voir les détails/i }).last().click();
    await page.waitForTimeout(2500);

    // Le bloc « Avis & notes » est en bas de la fiche : il faut l'amener à l'écran.
    const avis = page.locator('.modal-section-title', { hasText: /Avis/i }).first();
    await avis.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);

    // Note pré-sélectionnée pour que les étoiles soient lisibles sur la capture.
    const etoiles = page.locator('.star-btn');
    if (await etoiles.count() >= 4) { await etoiles.nth(3).click(); }
    await page.waitForTimeout(600);

    await page.screenshot({ path: `${IMG}/avis-formulaire.png` });
  });

  test('téléchargement du certificat', async ({ page }) => {
    await resetSession(page);
    await login(page, 'participant');
    await page.goto('/user/wallet');
    await expect(page.getByRole('heading', { name: /Mes inscriptions/i })).toBeVisible();
    await page.waitForTimeout(1500);

    const bouton = page.getByRole('button', { name: /Télécharger le PDF/i }).first();
    await expect(bouton).toBeVisible({ timeout: 20_000 });

    const attente = page.waitForEvent('download', { timeout: 60_000 });
    await bouton.click();
    const fichier = await attente;
    await fichier.saveAs(path.join(IMG, '..', 'certificat.pdf'));
  });

  // ─────────────────── Intégration continue (dépôt public) ───────────────────

  test('liste des exécutions de la chaîne', async ({ page }) => {
    await page.goto(`${REPO}/actions`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${IMG}/ci-executions.png` });
  });

  test('vue d\'ensemble des tâches du pipeline', async ({ page }) => {
    await page.goto(`${REPO}/actions/runs/${RUN_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${IMG}/ci-pipeline.png` });
  });

  test('graphe d\'exécution du pipeline', async ({ page }) => {
    await page.goto(`${REPO}/actions/runs/${RUN_ID}/workflow`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${IMG}/ci-workflow.png` });
  });
});
