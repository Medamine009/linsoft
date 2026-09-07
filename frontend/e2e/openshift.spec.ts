import { test } from '@playwright/test';
import * as fs from 'fs';

/**
 * Illustrations OpenShift du rapport.
 *
 * <p>Piloté par `scripts/captures-openshift.ps1`, qui interroge le cluster et
 * dépose le résultat dans un fichier JSON désigné par `OPENSHIFT_DATA`. Ce
 * fichier ne fabrique rien : il met en forme la sortie réelle de
 * `oc get pods` et ouvre l'application à son URL publique.</p>
 */

type Donnees = { pods: string; url: string; project: string; img: string };

const chemin = process.env['OPENSHIFT_DATA'];
const d: Donnees | null = chemin && fs.existsSync(chemin)
  ? JSON.parse(fs.readFileSync(chemin, 'utf8'))
  : null;

test.describe('Captures OpenShift', () => {

  test.skip(!d, 'Lancer scripts/captures-openshift.ps1 (connexion au cluster requise).');

  test('liste des pods', async ({ page }) => {
    const html = `
      <style>
        body { margin:0; background:#0b1020; font-family:Consolas,'Courier New',monospace; }
        .cadre { padding:26px 30px; }
        .barre { display:flex; align-items:center; gap:8px; padding:10px 14px;
                 background:#1c2333; border-radius:8px 8px 0 0; }
        .pt { width:12px; height:12px; border-radius:50%; }
        .titre { color:#9aa4bf; font-size:13px; margin-left:10px; }
        pre { margin:0; padding:20px 22px; background:#11172b; color:#d6deeb;
              font-size:13.5px; line-height:1.55; border-radius:0 0 8px 8px;
              white-space:pre; overflow:visible; }
        .prompt { color:#7ee787; }
      </style>
      <div class="cadre">
        <div class="barre">
          <span class="pt" style="background:#ff5f57"></span>
          <span class="pt" style="background:#febc2e"></span>
          <span class="pt" style="background:#28c840"></span>
          <span class="titre">oc — projet ${d!.project}</span>
        </div>
        <pre><span class="prompt">$</span> oc get pods -o wide\n\n${
          d!.pods.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        }</pre>
      </div>`;
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.setContent(html);
    const cadre = page.locator('.cadre');
    await cadre.screenshot({ path: `${d!.img}/openshift-pods.png` });
  });

  test('application déployée', async ({ page }) => {
    test.skip(!d!.url, "Aucune route publique : l'application n'est pas exposée.");
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(d!.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    // Laisse l'application s'initialiser (check-sso, chargement du catalogue).
    await page.waitForTimeout(6000);
    const entrer = page.getByRole('button', { name: /Accéder à la plateforme/i });
    if (await entrer.isVisible().catch(() => false)) {
      await entrer.click();
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: `${d!.img}/openshift-app.png` });
  });
});
