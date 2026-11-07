// Test de bout en bout : fil du chantier (notes, photos avant / après, sans réseau), rapport de fin de chantier,
// réception signée par le client, PDF, puis lien privé ouvert par le client (sans compte).
// Lancer via : bash scripts/e2e.sh job-report   (SANS_REGLES=1 : saute le lien, qui a besoin des règles PowerSync)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { inflateSync } = require('zlib');
const { login, tab, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const ORIGIN = new URL(APP).origin;
const XLSX = path.join(__dirname, '..', 'docs', 'Grille_tarifaire_elagage_Reunion_2026.xlsx');
const PHOTO = path.join(__dirname, 'fixtures', 'photo-4000x3000-gps.jpg');
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
function pdfText(buf) {
  const raw = Buffer.from(buf).toString('latin1');
  let out = raw;
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      out += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {}
  }
  return [...out.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join(' ');
}

(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', acceptDownloads: true });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  const p = await ctx.newPage();
  global.pg = p;
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));
  const blur = () => p.locator('body').click({ position: { x: 5, y: 300 } });
  const sign = async () => {
    const canvas = vis(p.locator('canvas[aria-label="Zone de signature"]'));
    await canvas.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    const box = await canvas.boundingBox();
    await p.mouse.move(box.x + 20, box.y + box.height * 0.7);
    await p.mouse.down();
    for (let i = 0; i <= 15; i++) await p.mouse.move(box.x + 20 + i * 14, box.y + box.height * (0.5 + 0.25 * Math.sin(i / 2)));
    await p.mouse.up();
  };

  // --- Préparation : fiche entreprise, grille, visite, devis signé sur place → chantier
  await p.goto(APP, { waitUntil: 'load' });
  await login(p);
  await tab(p, 'Plus').click();
  await vis(p.getByText('Fiche entreprise', { exact: true })).click();
  await field("Nom de l'entreprise *").fill('Élagage Test E2E');
  await field('Adresse *').fill('1 rue du Test');
  await field('Code postal *').fill('97400');
  await field('Commune *').fill('Saint-Denis');
  await field('Téléphone *').fill('0692 00 00 01');
  await blur();
  await vis(p.getByText('✓ Fiche suffisante pour émettre des devis.')).waitFor();
  await p.goBack();
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
  await field('Nom').fill('Mme Rapport');
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
  await vis(p.getByText('Finaliser le devis')).click();
  await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).waitFor({ timeout: 15000 });
  await field('Nom de la personne qui signe').fill('Mme Rapport');
  await sign();
  await vis(p.getByText('Valider la signature (Bon pour accord)')).click();
  await vis(p.getByRole('button', { name: 'Voir le chantier', exact: true })).click();
  await vis(p.getByText(/^Mme Rapport – D-/)).waitFor({ timeout: 15000 });
  const jobUrl = p.url();
  console.log('0. devis signé → chantier de Mme Rapport');

  // --- 1. Fil du chantier, SANS RÉSEAU
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await ctx.setOffline(true);
  await tab(p, 'Fil').click();
  await field('Note (tu peux dicter avec le micro du clavier)').fill('Portail vert, clé chez la voisine');
  await vis(p.getByRole('button', { name: 'Ajouter la note', exact: true })).click();
  await vis(p.getByText('Portail vert, clé chez la voisine')).waitFor();
  for (const stage of ['Avant', 'Après']) {
    await vis(p.getByRole('radio', { name: `Photo ${stage}`, exact: true })).click();
    await p.locator('input[aria-label="Choisir des photos"]').setInputFiles(PHOTO);
    await vis(p.getByText(stage, { exact: true }).locator('xpath=..')).waitFor({ timeout: 20000 });
  }
  await p.waitForFunction(() => document.querySelectorAll('[aria-label="Voir la photo du chantier"]').length === 2, null, { timeout: 20000 });
  console.log('1. HORS LIGNE : note et 2 photos (avant, après) dans le fil du chantier');

  // --- 2. Rapport, réception signée par le client, PDF — toujours sans réseau
  await tab(p, 'Rapport').click();
  await vis(p.getByRole('button', { name: 'Préparer le rapport', exact: true })).click();
  await p.waitForFunction(() => [...document.querySelectorAll('textarea[aria-label="Travaux réalisés"]')].some((e) => /Taille de palmier/.test(e.value)), null, { timeout: 15000 });
  await vis(p.getByText(/2 photos dans le rapport/)).waitFor();
  await field("Remarques (ce qui a été fait en plus, points d'attention…)").fill('Bois laissé en bûches au fond du jardin, à la demande de la cliente.');
  await blur();
  await field('Réserves éventuelles (laisser vide si aucune)').fill('');
  await sign();
  await vis(p.getByRole('button', { name: 'Valider la réception', exact: true })).click();
  await vis(p.getByText('Travaux réceptionnés')).waitFor({ timeout: 15000 });
  const [download] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), vis(p.getByText('PDF du rapport (SMS, WhatsApp, e-mail…)')).click()]);
  const file = path.join(__dirname, 'out-rapport.pdf');
  await download.saveAs(file);
  const txt = pdfText(fs.readFileSync(file));
  const must = ['RAPPORT DE FIN DE CHANTIER', 'Travaux réalisés', 'Taille de palmier', 'Bois laissé en bûches', 'Avant', 'Après', "Conseils d'entretien", 'par Mme Rapport', 'Sans réserve'];
  const missing = must.filter((m) => !txt.includes(m));
  const images = (fs.readFileSync(file).toString('latin1').match(/\/Subtype \/Image/g) || []).length;
  if (missing.length || images < 2) throw new Error(`PDF du rapport incomplet : ${missing.join(', ')} ; images ${images}`);
  console.log(`2. HORS LIGNE : rapport pré-rempli (travaux du devis), réception signée par la cliente, PDF ${Math.round(fs.statSync(file).size / 1024)} Ko (photos + signature)`);
  await tab(p, 'Infos').click();
  await vis(p.getByRole('radio', { name: 'Terminé', exact: true })).waitFor();
  const done = await vis(p.getByRole('radio', { name: 'Terminé', exact: true })).getAttribute('aria-checked');
  if (done !== 'true') throw new Error('chantier pas passé à « Terminé »');
  console.log('   chantier passé à « Terminé »');

  // --- 3. Retour du réseau : tout part au serveur
  await ctx.setOffline(false);
  await syncState(p, /Tout est envoyé/, 120000);
  const srv = await waitSql(
    `select (select count(*) from job_notes n join jobs j on j.id = n.job_id where j.company_id in ${CO} and j.title like 'Mme Rapport%') as notes,
            (select count(*) from photos ph join jobs j on j.id = ph.owner_id where ph.owner_type = 'job' and ph.kind = 'photo' and ph.storage_path is not null and j.title like 'Mme Rapport%') as photos,
            (select string_agg(ph.stage, ',' order by ph.stage) from photos ph join jobs j on j.id = ph.owner_id where ph.owner_type = 'job' and ph.kind = 'photo' and j.title like 'Mme Rapport%') as etapes,
            (select r.status from job_reports r join jobs j on j.id = r.job_id where j.title like 'Mme Rapport%' and j.company_id in ${CO}) as rapport,
            (select status from jobs where title like 'Mme Rapport%' and company_id in ${CO}) as chantier`,
    (r) => r[0]?.photos === 2 && r[0]?.rapport === 'signe',
    'fil et rapport'
  );
  console.log('3. retour du réseau → serveur :', JSON.stringify(srv[0]));

  // --- 4. Lien privé du client
  if (process.env.SANS_REGLES) {
    console.log('   (lien du client sauté : règles PowerSync pas encore déployées)');
  } else {
    await p.goto(jobUrl, { waitUntil: 'load' });
    await tab(p, 'Rapport').click();
    await vis(p.getByRole('button', { name: 'Envoyer un lien pour voir le rapport en ligne', exact: true })).click();
    const linkEl = vis(p.getByLabel('Lien du rapport', { exact: true }));
    await linkEl.waitFor({ timeout: 20000 });
    const link = (await linkEl.innerText()).trim();
    await syncState(p, /Tout est envoyé/);
    const cctx = await b.newContext({ ...devices['Pixel 7'], locale: 'fr-FR', acceptDownloads: true });
    const c = await cctx.newPage();
    c.on('pageerror', (e) => errors.push('client: ' + e.message));
    await c.goto(ORIGIN + new URL(link).pathname, { waitUntil: 'load' });
    await c.getByText('Rapport de fin de chantier').first().waitFor({ timeout: 20000 });
    await c.getByText(/Bois laissé en bûches/).first().waitFor();
    await c.waitForFunction(() => [...document.images].filter((i) => i.naturalWidth > 0 && /token=/.test(i.src)).length === 2, null, { timeout: 30000 });
    const [cd] = await Promise.all([c.waitForEvent('download', { timeout: 30000 }), c.getByText('Télécharger le rapport (PDF)').first().click()]);
    const cfile = path.join(__dirname, 'out-rapport-client.pdf');
    await cd.saveAs(cfile);
    const ctext = pdfText(fs.readFileSync(cfile));
    if (!ctext.includes('RAPPORT DE FIN DE CHANTIER') || !ctext.includes('Mme Rapport')) throw new Error('PDF du client incomplet');
    await c.screenshot({ path: 'tests/out-rapport-client.png', fullPage: true });
    console.log('4. client (sans compte) : rapport, 2 photos affichées, PDF téléchargé');
    await c.goto(ORIGIN + '/rapport/' + 'x'.repeat(43), { waitUntil: 'load' });
    await c.getByText(/Ce lien est inconnu/).first().waitFor({ timeout: 20000 });
    console.log('   lien inventé : « Ce lien est inconnu »');
  }

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
})().catch(async (e) => {
  console.error('ÉCHEC', e.message.split('\n').slice(0, 3).join(' | '));
  if (global.pg) console.error('page :', (await global.pg.innerText('body').catch(() => '')).slice(0, 400).replace(/\n+/g, ' / '));
  process.exit(1);
});
