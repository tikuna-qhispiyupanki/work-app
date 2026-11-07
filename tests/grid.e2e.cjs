// Test de bout en bout de la grille de prix (étape 3).
// Lancer via : bash scripts/e2e.sh grid
const { chromium, devices } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');
const { login, tab, menu, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const XLSX = path.join(__dirname, '..', 'docs', 'Grille_tarifaire_elagage_Reunion_2026.xlsx');
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const CO = `(select company_id from memberships where user_id = 'eeeeeeee-0000-4000-8000-00000000e2e0')`;
const sql = (q) => JSON.parse(execFileSync('python3', ['scripts/supabase-sql.py', 'qtfhiehlhowbuweykyyu', '-'], { input: q }).toString().replace(/^\d+ /, ''));
const waitSql = async (q, ok, label) => {
  for (let i = 0; i < 30; i++) {
    const r = sql(q);
    if (ok(r)) return r;
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`serveur : ${label}`);
};

(async () => {
  const b = await chromium.launch({ proxy });
  const phone = async () => {
    const p = await (await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' })).newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push('pageerror: ' + e.message));
    p.on('dialog', (d) => d.accept());
    return p;
  };
  const vis = (p, loc) => loc.filter({ visible: true }).first();
  const field = (p, label) => vis(p, p.getByLabel(label, { exact: true }));

  // 1. Import de la grille depuis le fichier Excel
  const A = await phone();
  await A.goto(APP, { waitUntil: 'load' });
  await login(A);
  await tab(A, 'Plus').click();
  await vis(A, A.getByText('Grille de prix', { exact: true })).click();
  await vis(A, A.getByText('Aucune grille de prix')).waitFor();
  await A.locator('input[aria-label="Importer mon fichier Excel"]').setInputFiles(XLSX);
  await vis(A, A.getByText('✓ 23 prestations dans 6 catégories')).waitFor({ timeout: 15000 });
  await vis(A, A.getByText('✓ Prix recalculés identiques à ceux du fichier')).waitFor();
  await A.screenshot({ path: 'tests/out-grille-verification.png' });
  console.log('1. fichier Excel lu : 23 prestations, 6 catégories, prix identiques à Excel');
  await vis(A, A.getByText('Enregistrer cette grille')).click();
  await vis(A, A.getByText("Élagage d'entretien – arbre 5 à 10 m", { exact: true })).waitFor();
  const n = await waitSql(`select count(*) as n from price_items where company_id = ${CO}`, (r) => Number(r[0].n) === 23, '23 prestations');
  console.log(`2. grille enregistrée et envoyée au serveur (${n[0].n} prestations)`);

  // 3. « Mon prix » et paramètre
  await A.screenshot({ path: 'tests/out-grille-avant-prix.png' });
  await field(A, "Mon prix HT – Élagage d'entretien – arbre 5 à 10 m").fill('400');
  await field(A, 'Taux horaire grimpeur (HT) (€)').click(); // quitte le champ : enregistrement
  await vis(A, A.getByText('Prix retenu : 400 € HT')).waitFor();
  await field(A, 'Taux horaire grimpeur (HT) (€)').fill('55');
  await field(A, 'Taux horaire homme au sol (HT) (€)').click();
  await A.screenshot({ path: 'tests/out-grille.png', fullPage: true });
  const r = await waitSql(
    `select (select my_price_cents from price_items where company_id = ${CO} and label like 'Élagage d''entretien – arbre 5 à 10 m') as mon_prix,
            (select rate_climber_cents from price_grids where company_id = ${CO} and is_active = 1) as taux`,
    (r) => r[0].mon_prix === 40000 && r[0].taux === 5500,
    'mon prix / taux'
  );
  console.log(`3. « mon prix » 400 € et taux grimpeur 55 €/h enregistrés et envoyés (serveur : ${r[0].mon_prix} c, ${r[0].taux} c)`);

  // 4. Autre appareil : la grille arrive par la synchronisation
  const B = await phone();
  await B.goto(APP, { waitUntil: 'load' });
  await login(B);
  await tab(B, 'Plus').click();
  await vis(B, B.getByText('Grille de prix', { exact: true })).click();
  await vis(B, B.getByText('Prix retenu : 400 € HT')).waitFor({ timeout: 45000 });
  console.log('4. autre appareil : grille reçue avec « mon prix » à 400 €');

  const errors = [...A.errors, ...B.errors];
  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch(async (e) => { console.error('ÉCHEC', e.message); process.exit(1); });
