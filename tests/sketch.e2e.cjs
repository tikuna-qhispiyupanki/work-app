// Test de bout en bout du croquis (étape 4d) : page blanche, sur le plan, retouche.
// Lancer via : bash scripts/e2e.sh sketch
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const { login, tab, menu, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const CO = `(select company_id from memberships where user_id = 'eeeeeeee-0000-4000-8000-00000000e2e0')`;
const sql = (q) => JSON.parse(execFileSync('python3', ['scripts/supabase-sql.py', 'qtfhiehlhowbuweykyyu', '-'], { input: q }).toString().replace(/^\d+ /, ''));

let page;
(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', geolocation: { latitude: -21.0533, longitude: 55.2306, accuracy: 8 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  page = p;
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));
  const draw = async (pts) => {
    const c = vis(p.locator('canvas[aria-label="Zone de dessin du croquis"]'));
    await c.scrollIntoViewIfNeeded();
    const box = await c.boundingBox();
    await p.mouse.move(box.x + box.width * pts[0][0], box.y + box.height * pts[0][1]);
    await p.mouse.down();
    for (const [x, y] of pts.slice(1)) await p.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 6 });
    await p.mouse.up();
  };
  const countSketches = () => p.getByLabel('Voir le croquis').filter({ visible: true }).count();

  await p.goto(APP, { waitUntil: 'load' });
  await login(p);
  await vis(p.getByText('Nouvelle visite', { exact: true })).click();
  await field('Nom').fill('M. Croquis');
  await vis(p.getByText('Me localiser')).click();
  await vis(p.getByText(/Adresse la plus proche/)).waitFor({ timeout: 20000 });
  await p.waitForTimeout(2500); // tuiles de la carte (image du plan enregistrée avec la visite)
  await vis(p.getByText('Enregistrer la visite')).click();
  await tab(p, 'Arbres').click();
  await vis(p.getByAltText('Plan du chantier')).waitFor({ timeout: 20000 });
  await tab(p, 'Croquis').click();

  // 1. Page blanche : un trait annulé, puis deux traits
  await vis(p.getByText('Page blanche')).click();
  await draw([[0.1, 0.1], [0.5, 0.5]]);
  await vis(p.getByText('↶ Annuler')).click();
  await vis(p.getByLabel('Couleur Bleu')).click();
  await draw([[0.2, 0.8], [0.4, 0.3], [0.7, 0.6]]);
  await vis(p.getByText('Épais', { exact: true })).click();
  await draw([[0.6, 0.2], [0.9, 0.2]]);
  await vis(p.getByText('Enregistrer le croquis')).click();
  await vis(p.getByLabel('Voir le croquis')).waitFor({ timeout: 15000 });
  console.log(`1. croquis sur page blanche enregistré (${await countSketches()} croquis)`);

  // 2. Sur le plan (vue aérienne avec repère)
  await vis(p.getByText('Sur le plan')).click();
  await vis(p.locator('canvas[aria-label="Zone de dessin du croquis"]')).waitFor();
  await p.waitForTimeout(800);
  await draw([[0.3, 0.7], [0.5, 0.5], [0.52, 0.48]]); // flèche vers le chantier
  await p.screenshot({ path: 'tests/out-croquis-plan.png' });
  await vis(p.getByText('Enregistrer le croquis')).click();
  await p.waitForFunction(() => document.querySelectorAll('[aria-label="Voir le croquis"]').length >= 2, null, { timeout: 15000 });
  console.log(`2. croquis sur le plan enregistré (${await countSketches()} croquis)`);

  // 3. Retouche : remplace l'ancien croquis
  await p.getByLabel('Voir le croquis').filter({ visible: true }).last().click();
  await vis(p.getByText('Retoucher le croquis')).click();
  await p.waitForTimeout(800);
  await draw([[0.1, 0.1], [0.3, 0.1]]);
  await vis(p.getByText('Enregistrer le croquis')).click();
  await p.goBack();
  await p.waitForTimeout(1500);
  const n = await countSketches();
  console.log(`3. croquis retouché : toujours ${n} croquis (l'ancien version masquée)`);
  if (n !== 2) throw new Error('la retouche devait remplacer le croquis');

  // 4. Serveur : 2 croquis actifs envoyés, 1 masqué
  let r;
  for (let i = 0; i < 20; i++) {
    r = sql(`select count(*) filter (where p.deleted_at is null and p.storage_path is not null) as actifs_envoyes, count(*) filter (where p.deleted_at is not null) as masques
      from photos p join visits v on v.id = p.owner_id join clients c on c.id = v.client_id where p.kind = 'croquis' and c.name = 'M. Croquis' and p.company_id = ${CO}`)[0];
    if (Number(r.actifs_envoyes) === 2 && Number(r.masques) === 1) break;
    await new Promise((res) => setTimeout(res, 3000));
  }
  console.log('4. serveur :', JSON.stringify(r));
  if (Number(r.actifs_envoyes) !== 2 || Number(r.masques) !== 1) throw new Error('croquis mal envoyés');

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch(async (e) => {
  console.error('ÉCHEC', e.message);
  if (page) await page.screenshot({ path: 'tests/out-echec-croquis.png', fullPage: true }).catch(() => {});
  process.exit(1);
});
