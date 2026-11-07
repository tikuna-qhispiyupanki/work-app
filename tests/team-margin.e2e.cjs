// Test de bout en bout : « Mon équipe » (coût horaire interne) et marge du devis.
// Lancer via : bash scripts/e2e.sh team-margin
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { login, tab, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const XLSX = path.join(__dirname, '..', 'docs', 'Grille_tarifaire_elagage_Reunion_2026.xlsx');
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const CO = `(select company_id from memberships where user_id = 'eeeeeeee-0000-4000-8000-00000000e2e0')`;
const sql = (q) => JSON.parse(execFileSync('python3', ['scripts/supabase-sql.py', 'qtfhiehlhowbuweykyyu', '-'], { input: q }).toString().replace(/^\d+ /, ''));
const waitSql = async (q, ok, what) => {
  for (let i = 0; i < 30; i++) {
    const r = sql(q);
    if (ok(r)) return r;
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`serveur : ${what} → ${JSON.stringify(sql(q))}`);
};

(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));
  const blur = () => p.locator('body').click({ position: { x: 5, y: 300 } });

  await p.goto(APP, { waitUntil: 'load' });
  await login(p);

  // 1. Mon équipe
  await tab(p, 'Plus').click();
  await vis(p.getByText('Mon équipe', { exact: true })).click();
  for (const [name, trade, cost] of [['Paul Équipe', 'Grimpeur', '28'], ['Léa Équipe', 'Homme au sol', '22']]) {
    await field('Nom').fill(name);
    await vis(p.getByRole('radio', { name: trade, exact: true })).click();
    await field('Coût horaire (€/h)').fill(cost);
    await blur();
    await vis(p.getByRole('button', { name: "Ajouter à l'équipe", exact: true })).click();
    await vis(p.getByText(name, { exact: true })).waitFor();
  }
  await vis(p.getByText(/^28\s€\/h$/)).waitFor();
  await syncState(p, /Tout est envoyé/);
  const costs = await waitSql(
    `select m.name, m.trade, c.hourly_cost_cents from team_members m join team_member_costs c on c.member_id = m.id where m.company_id in ${CO} and m.name like '%Équipe' order by m.name`,
    (r) => r.length === 2,
    'équipe'
  );
  console.log('1. équipe créée et envoyée :', costs.map((r) => `${r.name} (${r.trade}, ${r.hourly_cost_cents / 100} €/h)`).join(' ; '));
  await p.reload({ waitUntil: 'load' });
  await vis(p.getByText('Paul Équipe', { exact: true })).waitFor({ timeout: 20000 });
  console.log('   après rechargement : toujours là (règles de synchronisation OK)');

  // Grille (si absente), visite, 1 arbre, devis
  await p.goto(APP, { waitUntil: 'load' });
  await tab(p, 'Plus').click();
  await vis(p.getByText('Grille de prix', { exact: true })).click();
  const none = vis(p.getByText('Aucune grille de prix'));
  await Promise.race([none.waitFor({ timeout: 20000 }), vis(p.getByText('Paramètres', { exact: true })).waitFor({ timeout: 20000 })]);
  if (await none.isVisible()) {
    await p.locator('input[aria-label="Importer mon fichier Excel"]').setInputFiles(XLSX);
    await vis(p.getByText('Enregistrer cette grille')).click();
    await vis(p.getByText('Paramètres', { exact: true })).waitFor();
  }
  await p.goto(APP, { waitUntil: 'load' });
  await vis(p.getByText('Nouvelle visite', { exact: true })).click();
  await field('Nom').fill('M. Marge');
  await vis(p.getByText('Enregistrer la visite')).click();
  await tab(p, 'Arbres').click();
  await vis(p.getByText('Ajouter un arbre sans carte (hors-ligne)')).click();
  await field('Nom ou essence').fill('Cocotier');
  await vis(p.getByText("Choisir l'intervention")).click();
  await vis(p.getByText('Taille de palmier / cocotier', { exact: true })).click();
  await blur();
  await p.goBack();
  await tab(p, 'Devis').click();
  await vis(p.getByText('Créer le devis')).click();
  await vis(p.getByText('Détail (2 lignes)')).waitFor();

  // 2. Équipe prévue : 2 personnes, 2 h chacune → coût 100 € ; prix HT 222 € → marge 122 € (55 %)
  await vis(p.getByRole('button', { name: 'Ajouter Paul Équipe', exact: true })).click();
  await vis(p.getByRole('button', { name: 'Ajouter Léa Équipe', exact: true })).click();
  await field('Heures de Paul Équipe (h)').fill('2');
  await blur();
  await field('Heures de Léa Équipe (h)').fill('2');
  await blur();
  await vis(p.getByText(/^122\s€ \(55 %\)$/)).waitFor();
  await p.getByText('Équipe prévue et marge (interne)').scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'tests/out-marge.png' });
  console.log('2. équipe prévue (2 × 2 h) : coût 100 €, marge estimée 122 € (55 %) sur 222 € HT');

  // 3. Le PDF du client ne contient rien de l'équipe ni de la marge
  const [download] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), vis(p.getByText('PDF du devis (brouillon)')).click()]);
  const file = path.join(__dirname, 'out-devis-marge.pdf');
  await download.saveAs(file);
  const raw = fs.readFileSync(file).toString('latin1');
  const { inflateSync } = require('zlib');
  let txt = raw;
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      txt += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {}
  }
  if (/Paul|Marge|marge|28,00/.test(txt)) throw new Error('le PDF du client contient des informations internes');
  console.log('3. PDF du devis : ni équipe, ni coût, ni marge');

  await syncState(p, /Tout est envoyé/);
  const crew = await waitSql(`select sum(hours) as h, count(*) as n from quote_crew where company_id in ${CO}`, (r) => r[0]?.n === 2 && r[0]?.h === 4, 'équipe du devis');
  console.log('   serveur : équipe du devis', JSON.stringify(crew[0]));
  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
})().catch((e) => {
  console.error('ÉCHEC', e.message);
  process.exit(1);
});
