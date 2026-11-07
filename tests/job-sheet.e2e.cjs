// Test de bout en bout : chantier créé à la signature, équipe, fiche d'intervention pré-remplie,
// signée par le chef d'entreprise puis par les intervenants, PDF — toute la partie terrain SANS RÉSEAU.
// Lancer via : bash scripts/e2e.sh job-sheet
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { inflateSync } = require('zlib');
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
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', geolocation: { latitude: -21.0533, longitude: 55.2306, accuracy: 8 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  global.pg = p;
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));
  const blur = () => p.locator('body').click({ position: { x: 5, y: 300 } });
  const sign = async (n = 0) => {
    const canvas = p.locator('canvas[aria-label="Zone de signature"]').filter({ visible: true }).nth(n);
    await canvas.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    const box = await canvas.boundingBox();
    await p.mouse.move(box.x + 20, box.y + box.height * 0.7);
    await p.mouse.down();
    for (let i = 0; i <= 15; i++) await p.mouse.move(box.x + 20 + i * 14, box.y + box.height * (0.5 + 0.25 * Math.sin(i / 2)));
    await p.mouse.up();
  };

  // --- Au bureau (avec réseau) : fiche entreprise, grille, visite localisée, devis finalisé
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
  await field('Nom').fill('Mme Chantier');
  await vis(p.getByText('Me localiser')).click();
  await vis(p.getByText(/Adresse la plus proche/)).waitFor({ timeout: 20000 });
  await p.getByRole('switch').filter({ visible: true }).first().click(); // lignes électriques à proximité
  await vis(p.getByText('Enregistrer la visite')).click();
  await tab(p, 'Arbres').click();
  await vis(p.getByAltText('Plan du chantier')).waitFor({ timeout: 20000 });
  await vis(p.getByText('Ajouter un arbre sans carte (hors-ligne)')).click();
  await field('Nom ou essence').fill('Manguier');
  await vis(p.getByText("Choisir l'intervention")).click();
  await vis(p.getByText('Taille de palmier / cocotier', { exact: true })).click();
  await blur();
  await p.goBack();
  await tab(p, 'Devis').click();
  await vis(p.getByText('Créer le devis')).click();
  await vis(p.getByText('Finaliser le devis')).click();
  await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).waitFor({ timeout: 15000 });
  const number = (await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).innerText()).replace('Devis ', '');
  await syncState(p, /Tout est envoyé/);
  console.log(`0. au bureau : visite localisée (lignes électriques), devis ${number} finalisé`);

  // --- Sur le terrain, SANS RÉSEAU
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await ctx.setOffline(true);
  const devisUrl = p.url();
  await tab(p, 'Plus').click().catch(() => {});
  await p.goto(APP, { waitUntil: 'load' }).catch(() => {});
  await tab(p, 'Plus').click();
  await vis(p.getByText('Mon équipe', { exact: true })).click();
  for (const [name, trade] of [['Jean Chef', 'Grimpeur'], ['Lou Sauveteur', 'Homme au sol']]) {
    await field('Nom').fill(name);
    await vis(p.getByRole('radio', { name: trade, exact: true })).click();
    await vis(p.getByRole('button', { name: "Ajouter à l'équipe", exact: true })).click();
    await vis(p.getByText(name, { exact: true })).waitFor();
  }
  await p.goto(devisUrl, { waitUntil: 'load' });
  await vis(p.getByText(`Devis ${number}`)).waitFor({ timeout: 20000 });

  // 1. Signature sur place → chantier créé
  await field('Nom de la personne qui signe').fill('Mme Chantier');
  await sign();
  await vis(p.getByText('Valider la signature (Bon pour accord)')).click();
  await vis(p.getByText('✓ Signé par le client')).waitFor({ timeout: 15000 });
  await vis(p.getByRole('button', { name: 'Voir le chantier', exact: true })).click();
  await vis(p.getByText(/^Mme Chantier – D-/)).waitFor({ timeout: 15000 });
  console.log('1. HORS LIGNE : devis signé sur place → chantier créé tout seul');

  // 2. Planification, DT-DICT, équipe
  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await field('Début prévu').fill(day);
  await vis(p.getByText('⚠ DT-DICT à faire avant les travaux', { exact: false })).waitFor();
  await vis(p.getByRole('button', { name: "DT-DICT faite aujourd'hui", exact: true })).click();
  await vis(p.getByText(/DT-DICT faite le/)).waitFor();
  await tab(p, 'Équipe').click();
  await vis(p.getByRole('button', { name: 'Ajouter Jean Chef au chantier', exact: true })).click();
  await vis(p.getByRole('button', { name: 'Ajouter Lou Sauveteur au chantier', exact: true })).click();
  await vis(p.getByRole('radio', { name: "Jean Chef : Chef d'équipe", exact: true })).click();
  await vis(p.getByRole('radio', { name: 'Lou Sauveteur : Sauveteur désigné', exact: true })).click();
  console.log(`2. chantier planifié le ${day}, DT-DICT notée, équipe : Jean (chef) et Lou (sauveteur)`);

  // 3. Fiche d'intervention pré-remplie
  await tab(p, 'Fiche').click();
  await vis(p.getByRole('button', { name: "Préparer la fiche d'intervention", exact: true })).click();
  await vis(p.getByText(/Version 1 – brouillon/)).waitFor({ timeout: 15000 });
  await p.waitForFunction(() => [...document.querySelectorAll('textarea[aria-label="Travaux"]')].some((e) => /Taille de palmier/.test(e.value)), null, { timeout: 10000 });
  await vis(p.getByAltText('Croquis de la fiche')).waitFor({ timeout: 15000 });
  const powerChecked = await vis(p.getByRole('checkbox', { name: 'Lignes électriques à proximité', exact: true })).getAttribute('aria-checked');
  if (powerChecked !== 'true') throw new Error('risque « lignes électriques » pas coché : ' + powerChecked + ' ' + (await vis(p.getByRole('checkbox', { name: 'Lignes électriques à proximité', exact: true })).evaluate((e) => e.outerHTML.slice(0, 300))));
  await vis(p.getByText(/Jean Chef \(Chef d'équipe\)/)).waitFor();
  console.log('3. fiche pré-remplie : adresse + GPS, travaux du devis, image du plan, risque « lignes électriques » coché, intervenants');
  await field('Date de fin').fill(day);
  await vis(p.getByRole('checkbox', { name: 'Insectes (guêpes, frelons), animaux', exact: true })).click();
  await p.waitForFunction(() => document.querySelector('[aria-label="Insectes (guêpes, frelons), animaux"]')?.getAttribute('aria-checked') === 'true', null, { timeout: 10000 });
  await vis(p.getByRole('button', { name: 'Reprendre les mesures proposées pour les risques cochés', exact: true })).click();
  await p.waitForFunction(() => [...document.querySelectorAll('textarea[aria-label="Mesures de prévention"], input[aria-label="Mesures de prévention"]')].some((e) => /Inspection avant la montée/.test(e.value)), null, { timeout: 10000 });
  await field("Nom du chef d'entreprise").fill('Gérant Test');
  await sign();
  await vis(p.getByRole('button', { name: 'Signer la fiche', exact: true })).click();
  await vis(p.getByText(/Version 1 signée le .* par Gérant Test/)).waitFor({ timeout: 15000 });
  console.log("4. fiche signée par le chef d'entreprise (figée, à garder 2 ans)");

  // 5. Présentée aux intervenants
  for (const name of ['Jean Chef', 'Lou Sauveteur']) {
    await vis(p.getByRole('radio', { name, exact: true })).click();
    await sign();
    await vis(p.getByRole('button', { name: 'Valider : fiche présentée', exact: true })).click();
    await vis(p.getByText(new RegExp(`^${name} – `))).waitFor({ timeout: 15000 });
  }
  await vis(p.getByText('Présentée aux intervenants (2/2)')).waitFor();
  console.log('5. Jean et Lou ont signé pour attester (2/2)');

  // 6. PDF sans réseau
  const [download] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), vis(p.getByText('PDF de la fiche')).click()]);
  const file = path.join(__dirname, 'out-fiche-intervention.pdf');
  await download.saveAs(file);
  const txt = pdfText(fs.readFileSync(file));
  const must = ["FICHE D'INTERVENTION", '1. Emplacement', '2. Croquis', 'Lignes électriques à proximité', 'Insectes', '5. Conduite', '6. Organisation des secours', 'par Gérant Test', 'Jean Chef', 'Lou Sauveteur', '(2 ans)'];
  const missing = must.filter((m) => !txt.includes(m));
  const images = (fs.readFileSync(file).toString('latin1').match(/\/Subtype \/Image/g) || []).length;
  if (missing.length || images < 3) throw new Error(`PDF incomplet : ${missing.join(', ')} ; images ${images}`);
  await p.screenshot({ path: 'tests/out-fiche.png' });
  console.log(`6. PDF de la fiche (hors ligne) : 6 rubriques, croquis + signatures (${images} images distinctes), ${Math.round(fs.statSync(file).size / 1024)} Ko`);

  // 7. Retour du réseau : tout part au serveur, sans doublon de chantier
  await ctx.setOffline(false);
  await syncState(p, /Tout est envoyé/, 90000);
  const srv = await waitSql(
    `select (select count(*) from jobs where company_id in ${CO} and quote_id = q.id) as chantiers,
            (select id = q.id from jobs where company_id in ${CO} and quote_id = q.id limit 1) as meme_id,
            (select count(*) from job_members jm join jobs j on j.id = jm.job_id where j.quote_id = q.id and jm.deleted_at is null) as equipe,
            (select s.status from intervention_sheets s join jobs j on j.id = s.job_id where j.quote_id = q.id limit 1) as fiche,
            (select s.retain_until - current_date > 700 from intervention_sheets s join jobs j on j.id = s.job_id where j.quote_id = q.id limit 1) as garde_2_ans,
            (select count(*) from intervention_sheet_acks a join intervention_sheets s on s.id = a.sheet_id join jobs j on j.id = s.job_id where j.quote_id = q.id) as attestations
     from quotes q where q.company_id in ${CO} and q.number = '${number}'`,
    (r) => r[0]?.attestations === 2,
    'chantier et fiche'
  );
  console.log('7. retour du réseau → serveur :', JSON.stringify(srv[0]));
  if (srv[0].chantiers !== 1 || !srv[0].meme_id || srv[0].fiche !== 'signee' || srv[0].equipe !== 2) throw new Error('données serveur incorrectes');

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
})().catch(async (e) => {
  console.error('ÉCHEC', e.message.split('\n').slice(0, 3).join(' | '));
  if (global.pg) {
    await global.pg.screenshot({ path: 'tests/out-echec.png' }).catch(() => {});
    console.error('page :', (await global.pg.innerText('body').catch(() => '')).slice(0, 400).replace(/\n+/g, ' / '));
  }
  process.exit(1);
});
