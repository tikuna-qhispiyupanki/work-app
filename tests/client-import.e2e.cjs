// Test de bout en bout : import de clients depuis un CSV (Excel France) puis un .xlsx. Données FICTIVES.
// Lancer via : bash scripts/e2e.sh client-import
const { chromium, devices } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');
const { login, tab, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const CSV = path.join(__dirname, 'fixtures', 'clients-excel-fr.csv');
const XLSX = path.join(__dirname, 'fixtures', 'clients.xlsx');
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
const NAMES = `('Payet Jean', 'Hoarau Marie', 'Syndic Océan', 'Grondin Lucie', 'M. et Mme Rivière', 'Mairie de Test')`;

(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const pick = (file) => p.locator('input[aria-label="Choisir le fichier (Excel ou CSV)"]').setInputFiles(file);
  const importBtn = (n) => vis(p.getByRole('button', { name: n === 0 ? 'Aucun nouveau client à importer' : `Importer ${n} client${n > 1 ? 's' : ''}`, exact: true }));

  await p.goto(APP, { waitUntil: 'load' });
  await login(p);
  await tab(p, 'Clients').click();
  await vis(p.getByRole('button', { name: 'Importer (Excel, CSV)', exact: true })).click();

  // 1. CSV « Excel France » : point-virgule, accents en Windows-1252
  await pick(CSV);
  await vis(p.getByText('clients-excel-fr.csv')).waitFor();
  await vis(p.getByLabel(/^Colonne pour Téléphone : D · Portable$/)).waitFor();
  await vis(p.getByLabel(/^Colonne pour Autre téléphone : E · Tél\. fixe$/)).waitFor();
  await vis(p.getByText('Syndic Océan · Pro')).waitFor();
  await vis(p.getByText(/0262 33 44 55/)).waitFor();
  await importBtn(4).waitFor();
  await tab(p, 'Doublons').click();
  await vis(p.getByText('Deux fois dans le fichier (même téléphone)')).waitFor();
  await tab(p, 'Sans nom').click();
  await vis(p.getByText('Pas de nom')).waitFor();
  console.log('1. CSV lu : colonnes reconnues (portable, fixe…), accents corrects, 4 nouveaux, 1 doublon dans le fichier, 1 ligne sans nom');

  // 2. Changer une colonne : « Notes » non utilisée
  await vis(p.getByLabel(/^Colonne pour Notes : K · Remarques$/)).click();
  await vis(p.getByRole('button', { name: 'Ne pas utiliser', exact: true })).click();
  await vis(p.getByLabel('Colonne pour Notes : non utilisé')).waitFor();
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'tests/out-import-clients.png' });
  console.log('2. colonne « Notes » retirée à la main');

  // 3. Import
  await importBtn(4).click();
  await vis(p.getByText('4 clients ajoutés au carnet.')).waitFor({ timeout: 15000 });
  await syncState(p, /Tout est envoyé/);
  const rows = await waitSql(
    `select name, kind, phone, address, notes from clients where company_id in ${CO} and name in ${NAMES} order by name`,
    (r) => r.length === 4,
    '4 clients importés'
  );
  const syndic = rows.find((r) => r.name === 'Syndic Océan');
  const payet = rows.find((r) => r.name === 'Payet Jean');
  if (syndic?.kind !== 'professionnel' || syndic.phone !== '0692 44 55 66' || payet?.notes !== '') throw new Error('import incorrect : ' + JSON.stringify(rows));
  console.log('3. 4 clients importés et envoyés au serveur :', rows.map((r) => `${r.name} (${r.kind}, ${r.phone})`).join(' ; '));

  // 4. Même fichier une 2e fois : tout est repéré comme doublon
  await vis(p.getByRole('button', { name: 'Voir le carnet', exact: true })).click();
  await vis(p.getByRole('button', { name: 'Importer (Excel, CSV)', exact: true })).click();
  await pick(CSV);
  await importBtn(0).waitFor();
  await tab(p, 'Doublons').click();
  await vis(p.getByText('Déjà dans le carnet (même téléphone)')).waitFor();
  console.log('4. même fichier réimporté : 0 nouveau, tous repérés « déjà dans le carnet »');

  // 5. Fichier Excel avec un titre au-dessus du tableau, téléphone sans le 0 (perdu par Excel)
  await vis(p.getByRole('button', { name: 'Choisir un autre fichier', exact: true })).click();
  await pick(XLSX);
  await vis(p.getByText('Ligne des titres : 2')).waitFor();
  await vis(p.getByText(/0692 12 34 99/)).waitFor();
  await importBtn(2).click();
  await vis(p.getByText('2 clients ajoutés au carnet.')).waitFor({ timeout: 15000 });
  await vis(p.getByRole('button', { name: 'Voir le carnet', exact: true })).click();
  await vis(p.getByText('Mairie de Test · Pro')).waitFor();
  await syncState(p, /Tout est envoyé/);
  const all = await waitSql(`select count(*) as n from clients where company_id in ${CO} and name in ${NAMES}`, (r) => r[0].n === 6, '6 clients');
  console.log(`5. Excel : titre au-dessus repéré, « 692123499 » → « 0692 12 34 99 », 2 nouveaux (Grondin Lucie déjà là) → ${all[0].n} clients au total sur le serveur`);

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
})().catch((e) => {
  console.error('ÉCHEC', e.message);
  process.exit(1);
});
