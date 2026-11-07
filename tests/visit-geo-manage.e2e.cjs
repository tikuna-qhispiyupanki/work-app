// Test de bout en bout : « Me localiser », adresse IGN, image du plan, modification, statut « faite », suppression.
// Nécessite l'accès réseau à data.geopf.fr. Lancer : npx serve -s dist -l 8081, puis npm run test:geo
const { chromium, devices } = require('playwright');
const { login, tab, menu, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;

(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({
    ...devices['iPhone 13'],
    locale: 'fr-FR',
    deviceScaleFactor: 2,
    geolocation: { latitude: -21.0533, longitude: 55.2306, accuracy: 8 },
    permissions: ['geolocation'],
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  p.on('dialog', (d) => d.accept()); // confirme la suppression
  const fill = (label, v) => p.getByLabel(label, { exact: true }).fill(v);

  await p.goto(APP, { waitUntil: 'load' });
  await login(p);
  await p.getByText('Nouvelle visite', { exact: true }).click();
  await fill('Nom', 'M. Grondin');
  await p.getByText('Me localiser').click();
  await p.getByText(/Adresse la plus proche/).waitFor({ timeout: 20000 });
  const address = await p.getByLabel('Adresse', { exact: true }).inputValue();
  const cp = await p.getByLabel('Code postal', { exact: true }).inputValue();
  const city = await p.getByLabel('Commune', { exact: true }).inputValue();
  console.log(`1. Me localiser → « ${address}, ${cp} ${city} »`);
  await p.getByText('Zone : La Réunion (8,5 %)').waitFor();
  await p.locator('[aria-label="Carte du chantier"] img').first().waitFor();
  await p.waitForTimeout(1500); // chargement des tuiles de carte (la synchronisation garde une connexion ouverte)
  await p.getByText('Plan', { exact: true }).click();
  await p.waitForTimeout(1500); // chargement des tuiles de carte (la synchronisation garde une connexion ouverte)
  await p.screenshot({ path: 'tests/out-formulaire-carte.png', fullPage: true });
  console.log('2. carte IGN affichée (plan)');

  await p.getByText('Enregistrer la visite').click();
  await tab(p, 'Arbres').click();
  await p.getByAltText('Plan du chantier').waitFor({ timeout: 20000 });
  const size = await p.getByAltText('Plan du chantier').evaluate((img) => `${img.naturalWidth}×${img.naturalHeight}`);
  console.log(`3. visite enregistrée avec l'image du plan (${size})`);
  await p.screenshot({ path: 'tests/out-visite-plan.png', fullPage: true });

  await tab(p, 'Infos').click();
  await p.getByText('Marquer la visite comme faite').click();
  await p.getByText('Faite', { exact: true }).waitFor();
  console.log('4. visite marquée « faite »');

  await menu(p, 'Actions de la visite', 'Modifier la visite');
  await fill('Téléphone', '0693 11 22 33');
  await p.getByLabel('Date de la visite – heure').fill('16:30');
  await p.getByText("L'image du plan déjà enregistrée sera gardée", { exact: false }).waitFor();
  await p.getByText('Enregistrer les modifications').click();
  await p.getByText('Tél. 0693 11 22 33').waitFor();
  await p.getByText(/à 16:30/).waitFor();
  console.log('5. modification enregistrée (téléphone, heure 16:30), plan conservé');

  await menu(p, 'Actions de la visite', 'Supprimer la visite');
  await p.getByText('Nouvelle visite', { exact: true }).waitFor();
  await p.waitForTimeout(500);
  const stillThere = await p.getByText('M. Grondin', { exact: true }).filter({ visible: true }).count();
  const inDom = await p.getByText('M. Grondin').count();
  console.log('   (dans la page, y compris écrans masqués :', inDom, ')');
  console.log(`6. visite supprimée → ${stillThere === 0 ? 'disparue de l’accueil' : 'ENCORE VISIBLE'}`);
  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (stillThere || errors.length) process.exit(1);
})().catch((e) => { console.error('ÉCHEC', e.message); process.exit(1); });
