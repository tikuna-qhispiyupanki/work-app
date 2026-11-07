// Test de bout en bout : arbres sur la carte, image du plan avec arbres, carnet clients et historique.
// Nécessite l'accès réseau à data.geopf.fr. Lancer : npx serve -s dist -l 8081, puis npm run test:clients
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
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));

  // 1. Première visite avec localisation
  await p.goto(APP, { waitUntil: 'load' });
  await login(p);
  await p.getByText('Nouvelle visite', { exact: true }).click();
  await field('Nom').fill('Mme Técher');
  await field('Téléphone').fill('0692 12 34 56');
  await p.getByText('Me localiser').click();
  await p.getByText(/Adresse la plus proche/).waitFor({ timeout: 20000 });
  await field('Accès (portail, stationnement, chemin…)').fill('Portail vert, se garer devant');
  await p.getByText('Enregistrer la visite').click();
  await vis(p.getByText(/^Fiche client/)).waitFor();
  console.log('1. visite 1 créée pour Mme Técher');

  // 2. Placer deux arbres en touchant la carte
  await tab(p, 'Arbres').click();
  await vis(p.getByText('Placer des arbres')).click();
  const map = vis(p.locator('[aria-label="Carte du chantier"]'));
  await map.scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await map.click({ position: { x: 90, y: 90 } });
  await vis(p.getByText(/Arbre n° 1 placé/)).waitFor();
  await field("Nom de l'arbre n° 1").fill('Manguier');
  await map.click({ position: { x: 230, y: 190 } });
  await vis(p.getByText(/Arbre n° 2 placé/)).waitFor();
  await field("Nom de l'arbre n° 2").fill('Filao côté piscine');
  await field("Repère pour l'équipe").fill('Au fond à droite');
  await vis(p.getByText('Terminer')).click();
  await vis(p.getByText('Manguier')).waitFor();
  const dots = await p.locator('[aria-label^="Arbre "]').filter({ visible: true }).count();
  console.log(`2. deux arbres placés et nommés (${dots} repères sur la carte)`);

  // 3. Image du plan avec les arbres
  await p.waitForTimeout(1500); // chargement des tuiles de carte (la synchronisation garde une connexion ouverte)
  await vis(p.getByText("Enregistrer l'image du plan avec les arbres")).click();
  await vis(p.getByText('Image du plan enregistrée avec les arbres')).waitFor({ timeout: 20000 });
  const img = vis(p.getByAltText('Plan du chantier'));
  await img.waitFor();
  await p.waitForTimeout(500);
  await img.screenshot({ path: 'tests/out-plan-arbres.png' });
  console.log('3. image du plan enregistrée avec les arbres numérotés');
  await p.getByRole('button', { name: 'Actions de la visite', exact: true }).filter({ visible: true }).first().click();
  await vis(p.getByRole('button', { name: 'Ajouter au calendrier', exact: true })).waitFor();
  await vis(p.getByText('Annuler', { exact: true })).click();
  console.log('   bouton « Ajouter au calendrier » présent');
  await p.screenshot({ path: 'tests/out-visite-arbres.png', fullPage: true });

  // 4. Deuxième visite : le client est proposé, l'adresse reprise
  await p.goto(APP, { waitUntil: 'load' });
  await p.getByText('Nouvelle visite', { exact: true }).click();
  await field('Nom').fill('téch');
  await vis(p.getByText('Déjà dans le carnet :')).waitFor();
  await vis(p.getByText('Mme Técher')).click();
  await vis(p.getByText(/Adresse et accès repris de la visite du/)).waitFor();
  const phone = await field('Téléphone').inputValue();
  const address = await field('Adresse').inputValue();
  console.log(`4. client retrouvé (tél. ${phone}), adresse reprise : « ${address} »`);
  await p.screenshot({ path: 'tests/out-carnet-suggestion.png' });
  await p.getByText('Enregistrer la visite').click();
  await vis(p.getByText(/1 autre visite/)).waitFor();
  console.log('   visite 2 créée, la fiche indique « 1 autre visite »');

  // 5. Carnet et historique
  await vis(p.getByText(/^Fiche client/)).click();
  await vis(p.getByText('Historique (2 visites)')).waitFor();
  console.log('5. fiche client : historique de 2 visites');
  await p.goto(APP, { waitUntil: 'load' });
  await tab(p, 'Clients').click();
  await field('Rechercher (nom, téléphone, commune)').fill('0692 12');
  await vis(p.getByText('2 visites')).waitFor();
  const clientCount = await p.getByText('Mme Técher', { exact: true }).filter({ visible: true }).count();
  console.log(`   carnet : recherche par téléphone → ${clientCount} client (pas de doublon)`);

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length || clientCount !== 1) process.exit(1);
})().catch((e) => { console.error('ÉCHEC', e.message); process.exit(1); });
