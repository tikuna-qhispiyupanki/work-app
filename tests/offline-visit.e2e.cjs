// Test de bout en bout : créer une visite, recharger, couper le réseau, créer une visite hors-ligne.
// Lancer : npm run build:web && npx serve -s dist -l 8081, puis npm run test:offline
const { chromium, devices } = require('playwright');
const { login } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(m.text()) && errors.push('console: ' + m.text())); // hors-ligne : échecs réseau attendus
  const fill = async (label, v) => p.getByLabel(label, { exact: true }).fill(v);

  await p.goto(APP, { waitUntil: 'load' });
  await login(p);
  await p.getByText(/Tout est|en attente|Envoi en cours|Connexion au serveur/).first().waitFor({ timeout: 15000 });
  console.log('1. base locale prête');

  await p.getByText('+ Nouvelle visite').click();
  await fill('Nom', 'Mme Payet');
  await fill('Téléphone', '0692 00 00 00');
  await fill('Adresse', '12 chemin des Filaos');
  await fill('Code postal', '97434');
  await fill('Commune', 'Saint-Gilles-les-Bains');
  await p.getByText('Zone : La Réunion (8,5 %)').waitFor();
  await p.getByRole('switch').click();
  await fill('Notes (tu peux dicter avec le micro du clavier)', 'Manguier 12 m au-dessus de la piscine');
  await p.getByText('Enregistrer la visite').click();
  await p.getByText('Visite du ').waitFor();
  await p.screenshot({ path: 'tests/out-visite.png' });
  console.log('2. visite créée, URL', new URL(p.url()).pathname);

  await p.goto(APP, { waitUntil: 'load' });
  await p.getByText('Mme Payet').waitFor();
  console.log('3. après rechargement : visite toujours là');
  console.log('   bandeau :', await p.getByText(/● En ligne/).first().innerText());

  // Attendre que le service worker contrôle la page, puis couper le réseau.
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.reload({ waitUntil: 'load' });
  const controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await p.reload();
  await p.getByText('Mme Payet').waitFor({ timeout: 15000 });
  console.log('4. HORS LIGNE : application rouverte (SW actif:', controlled + '), visite toujours là');

  await p.getByText('+ Nouvelle visite').click();
  await fill('Nom', 'M. Hoarau');
  await fill('Code postal', '75011');
  await p.getByText('Zone : Hexagone (20 %)').waitFor();
  await p.getByText('Enregistrer la visite').click();
  await p.getByText('Visite du ').waitFor();
  await p.goBack();
  await p.getByText('M. Hoarau').filter({ visible: true }).first().waitFor();
  console.log('5. HORS LIGNE : 2e visite créée');
  console.log('   bandeau :', await p.getByText(/Hors ligne/).innerText());
  await p.screenshot({ path: 'tests/out-accueil-hors-ligne.png' });
  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
})().catch((e) => { console.error('ÉCHEC', e.message); process.exit(1); });
