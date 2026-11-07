// Fiches clients (création, modification, actions rapides, retrait du carnet) et zoom « loupe » de la carte des arbres.
// Lancer via : bash scripts/e2e.sh clients-manage
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const { login, tab, menu, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const CO = `(select company_id from memberships where user_id = 'eeeeeeee-0000-4000-8000-00000000e2e0')`;
const sql = (q) => JSON.parse(execFileSync('python3', ['scripts/supabase-sql.py', 'qtfhiehlhowbuweykyyu', '-'], { input: q }).toString().replace(/^\d+ /, ''));

(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', geolocation: { latitude: -21.0533, longitude: 55.2306, accuracy: 8 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));

  await p.goto(APP, { waitUntil: 'load' });
  await login(p);

  // 1. Création d'un client professionnel depuis le carnet
  await tab(p, 'Clients').click();
  await vis(p.getByRole('button', { name: 'Nouveau client', exact: true })).click();
  await vis(p.getByText('Professionnel', { exact: true })).click();
  await field('Nom de la société (ou du contact)').fill('Syndic Les Filaos');
  await field('Téléphone').fill('0262 11 22 33');
  await field('E-mail').fill('contact@filaos.example');
  await field('Adresse').fill('8 rue de Paris');
  await field('Code postal').fill('97400');
  await field('Commune').fill('Saint-Denis');
  await vis(p.getByText('Créer la fiche client')).click();
  await vis(p.getByText('Client professionnel')).waitFor();
  for (const a of ['Appeler', 'SMS', 'E-mail', 'Itinéraire']) await vis(p.getByText(a)).waitFor();
  await p.screenshot({ path: 'tests/out-fiche-client.png', fullPage: true });
  console.log('1. client professionnel créé sans visite ; boutons Appeler, SMS, E-mail, Itinéraire présents');

  // 2. Modification
  await vis(p.getByText('Modifier la fiche')).click();
  await field('Notes').fill('Interphone code 1234');
  await vis(p.getByText('Enregistrer', { exact: true })).click();
  await vis(p.getByText('Interphone code 1234')).waitFor();
  console.log('2. fiche modifiée (notes)');

  // 3. Le carnet le montre « Pro », puis retrait du carnet
  await p.goBack();
  await vis(p.getByText('Syndic Les Filaos · Pro')).waitFor();
  await vis(p.getByText('Syndic Les Filaos · Pro')).click();
  await vis(p.getByText('Retirer du carnet')).click();
  await vis(p.getByRole('button', { name: 'Nouveau client', exact: true })).waitFor();
  await p.waitForTimeout(500);
  const still = await p.getByText('Syndic Les Filaos · Pro').filter({ visible: true }).count();
  let row;
  for (let i = 0; i < 15; i++) {
    row = sql(`select kind, notes, deleted_at is not null as retire from clients where company_id = ${CO} and name = 'Syndic Les Filaos'`)[0];
    if (row?.retire) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`3. retiré du carnet (${still ? 'ENCORE VISIBLE' : 'plus visible'}) ; serveur : ${JSON.stringify(row)}`);
  if (still || !row?.retire || row.kind !== 'professionnel') throw new Error('retrait ou fiche incorrects');

  // 4. Zoom « loupe » sur la carte des arbres
  await p.goto(APP, { waitUntil: 'load' });
  await vis(p.getByText('Nouvelle visite', { exact: true })).click();
  await field('Nom').fill('M. Zoom');
  await vis(p.getByText('Me localiser')).click();
  await vis(p.getByText(/Adresse la plus proche/)).waitFor({ timeout: 20000 });
  await vis(p.getByText('Enregistrer la visite')).click();
  await tab(p, 'Arbres').click();
  await vis(p.getByText('Placer des arbres')).click();
  for (let i = 0; i < 3; i++) await p.getByRole('button', { name: '+', exact: true }).filter({ visible: true }).last().click();
  await vis(p.getByText('loupe ×4')).waitFor();
  const map = p.locator('[aria-label="Carte du chantier"]').filter({ visible: true }).last();
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  await map.click({ position: { x: box.width / 2 + 10, y: box.height / 2 } });
  await vis(p.getByText(/Arbre n° 1 placé/)).waitFor();
  await map.click({ position: { x: box.width / 2 + 60, y: box.height / 2 } });
  await vis(p.getByText(/Arbre n° 2 placé/)).waitFor();
  const t = sql(`select t.lat, t.lng from trees t join visits v on v.id = t.visit_id join clients c on c.id = v.client_id where c.name = 'M. Zoom' and t.company_id = ${CO} order by t.number`);
  await p.waitForTimeout(1500);
  await map.screenshot({ path: 'tests/out-carte-loupe.png' });
  // À la loupe ×4 (zoom 21), 50 pixels d'écran ≈ 3,5 m sur le terrain.
  console.log(`4. loupe ×4 : 2 arbres placés à 50 px d'écart${t.length === 2 ? ` → ${(Math.abs(t[1].lng - t[0].lng) * 111320 * Math.cos((21 * Math.PI) / 180)).toFixed(1)} m sur le terrain` : ''}`);

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('ÉCHEC', e.message); process.exit(1); });
