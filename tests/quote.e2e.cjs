// Test de bout en bout du devis (étape 4b) : exemple du calculateur Excel (manguier sur piscine).
// Lancer via : bash scripts/e2e.sh quote
const { chromium, devices } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');
const { login, tab, menu, syncState } = require('./helpers/login.cjs');
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

let page;
(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
  const p = await ctx.newPage();
  page = p;
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));
  const blur = () => p.locator('body').click({ position: { x: 5, y: 300 } });

  await p.goto(APP, { waitUntil: 'load' });
  await login(p);
  // Grille neuve
  await tab(p, 'Plus').click();
  await vis(p.getByText('Grille de prix', { exact: true })).click();
  const none = vis(p.getByText('Aucune grille de prix'));
  await Promise.race([none.waitFor({ timeout: 20000 }), vis(p.getByText('Paramètres', { exact: true })).waitFor({ timeout: 20000 })]);
  await p.locator(`input[aria-label="${(await none.isVisible()) ? 'Importer mon fichier Excel' : 'Importer une nouvelle version (Excel)'}"]`).setInputFiles(XLSX);
  await vis(p.getByText(/^(Enregistrer cette grille|Remplacer la grille actuelle)$/)).click();
  await vis(p.getByText('Prix retenu : 313 € HT')).waitFor();

  // Visite avec 3 arbres = exemple du calculateur Excel
  await p.goto(APP, { waitUntil: 'load' });
  await vis(p.getByText('Nouvelle visite', { exact: true })).click();
  await field('Nom').fill('Mme Devis');
  await field('Adresse').fill('5 allée des Lataniers');
  await field('Code postal').fill('97434');
  await field('Commune').fill('Saint-Gilles');
  await vis(p.getByText('Enregistrer la visite')).click();
  await tab(p, 'Arbres').click();
  const addTree = async (name, item, opts = {}) => {
    await vis(p.getByText('Ajouter un arbre sans carte (hors-ligne)')).click();
    await vis(p.getByText(/^Arbre n° \d+$/)).waitFor();
    await field('Nom ou essence').fill(name);
    await vis(p.getByText("Choisir l'intervention")).click();
    await vis(p.getByText(item, { exact: true })).click();
    if (opts.qty) await field(`Quantité (${opts.unit})`).fill(String(opts.qty));
    if (opts.retention) await vis(p.getByLabel(/^Rétention/)).click();
    if (opts.bigTrunk) await vis(p.getByLabel(/^Tronc de plus de 60 cm/)).click();
    if (opts.ground) await field('Heures homme au sol (portage, protection, nettoyage) (h)').fill(String(opts.ground));
    if (opts.waste) await field('Déchets verts à évacuer (m³)').fill(String(opts.waste));
    await blur();
    await p.waitForTimeout(400);
    await p.goBack();
  };
  await addTree('Manguier', 'Démontage sans rétention', { retention: true, bigTrunk: true, ground: 3, waste: 6 });
  await addTree('Souche', 'Rognage de souche – diamètre 40 à 80 cm');
  await addTree('Cocotiers', 'Taille de palmier / cocotier', { qty: 2, unit: 'arbre' });
  await vis(p.getByText(/Estimation de la visite : ≈ 2\s455,15\s€ HT/)).waitFor();
  console.log('1. visite avec 3 arbres (exemple Excel) : estimation 2 455,15 € HT');

  // Création du devis
  await tab(p, 'Devis').click();
  await vis(p.getByText('Créer le devis')).click();
  await vis(p.getByText('Devis (brouillon)')).waitFor();
  await vis(p.getByText('Détail (6 lignes)')).waitFor();
  await vis(p.getByText('TVA non applicable, art. 293 B du CGI')).waitFor();
  await vis(p.getByText(/^2\s455,15\s€$/)).waitFor();
  console.log('2. devis brouillon : 6 lignes, franchise de TVA, net à payer 2 455,15 € (= calculateur Excel)');

  // Modification : ligne de location
  await vis(p.getByText('Location matériel')).click();
  await vis(p.getByText('Détail (7 lignes)')).waitFor();
  await p.getByLabel('Prix unitaire HT (€)', { exact: true }).filter({ visible: true }).last().fill('150');
  await blur();
  await vis(p.getByText(/^2\s605,15\s€$/)).waitFor();
  console.log('3. ligne « location de matériel » à 150 € ajoutée → 2 605,15 €');

  // Finalisation bloquée tant que la fiche entreprise est incomplète
  await vis(p.getByText(/Pour finaliser, complète la fiche entreprise/)).waitFor();
  await vis(p.getByText('Compléter la fiche entreprise')).click();
  await field("Nom de l'entreprise *").fill('Élagage Test E2E');
  await field('Adresse *').fill('1 rue du Test');
  await field('Code postal *').fill('97400');
  await field('Commune *').fill('Saint-Denis');
  await field('Téléphone *').fill('0692 00 00 01');
  await blur();
  await vis(p.getByText('✓ Fiche suffisante pour émettre des devis.')).waitFor();
  await p.goBack();
  console.log('4. finalisation bloquée sans fiche entreprise → fiche complétée');

  // Finalisation : numéro, dates, verrouillage
  await vis(p.getByText('Finaliser le devis')).click();
  await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).waitFor({ timeout: 15000 });
  const number = (await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).innerText()).replace('Devis ', '');
  const editable = await p.getByText('Ligne libre').filter({ visible: true }).count();
  await p.screenshot({ path: 'tests/out-devis.png', fullPage: true });
  console.log(`5. finalisé : numéro ${number}, plus modifiable (${editable ? 'ENCORE MODIFIABLE' : 'boutons retirés'})`);
  const r = await waitSql(
    `select number, status, subtotal_ht_cents, total_ttc_cents, (select count(*) from quote_lines l where l.quote_id = q.id and l.deleted_at is null) as lignes,
       company_snapshot::json->>'name' as entreprise from quotes q where company_id = ${CO} and number = '${number}'`,
    (r) => r[0]?.status === 'finalise',
    'devis finalisé'
  );
  console.log('   serveur :', JSON.stringify(r[0]));
  if (r[0].total_ttc_cents !== 260515 || Number(r[0].lignes) !== 7 || editable) throw new Error('devis incorrect');

  // Hors-ligne : un nouveau devis est numéroté sans réseau (réserve de numéros du téléphone)
  await p.goto(APP, { waitUntil: 'load' });
  await vis(p.getByText('Mme Devis')).click();
  await tab(p, 'Infos').waitFor(); // page de la visite ouverte (sinon « Devis » = onglet du bas)
  await tab(p, 'Devis').click();
  await vis(p.getByText('Créer un nouveau devis')).waitFor();
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await ctx.setOffline(true);
  await vis(p.getByText('Créer un nouveau devis')).click();
  await vis(p.getByText('Devis (brouillon)')).waitFor();
  await vis(p.getByText('Finaliser le devis')).click();
  await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).waitFor({ timeout: 15000 });
  const number2 = (await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).innerText()).replace('Devis ', '');
  console.log(`6. HORS LIGNE : devis finalisé avec le numéro ${number2}`);
  await ctx.setOffline(false);
  await waitSql(`select status from quotes where company_id = ${CO} and number = '${number2}'`, (r) => r[0]?.status === 'finalise', 'devis hors-ligne envoyé');
  console.log('   retour du réseau → envoyé au serveur');
  if (number2 === number) throw new Error('numéro en double');

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch(async (e) => {
  console.error('ÉCHEC', e.message);
  if (page) await page.screenshot({ path: 'tests/out-echec-devis.png', fullPage: true }).catch(() => {});
  process.exit(1);
});
