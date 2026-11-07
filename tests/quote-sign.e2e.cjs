// Test de bout en bout : ligne offerte, signature du client, PDF du devis (étape 4c).
// Lancer via : bash scripts/e2e.sh quote-sign
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { inflateSync } = require('zlib');
const { execFileSync } = require('child_process');
const { login } = require('./helpers/login.cjs');
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
const pdfText = (buf) => {
  const raw = buf.toString('latin1');
  let out = raw;
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try { out += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch {}
  }
  return [...out.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join(' ');
};

let page;
(async () => {
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', acceptDownloads: true });
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
  // Fiche entreprise (si vide) et grille
  await vis(p.getByLabel('Mon compte')).click();
  await vis(p.getByText('🏢 Fiche entreprise (identité sur les devis)')).click();
  await field("Nom de l'entreprise *").fill('Élagage Test E2E');
  await field('Adresse *').fill('1 rue du Test');
  await field('Code postal *').fill('97400');
  await field('Commune *').fill('Saint-Denis');
  await field('Téléphone *').fill('0692 00 00 01');
  await field('SIRET').fill('123 456 789 00011');
  await blur();
  await vis(p.getByText('✓ Fiche suffisante pour émettre des devis.')).waitFor();
  await p.goBack();
  await vis(p.getByText('💶 Grille de prix')).click();
  const none = vis(p.getByText('Aucune grille de prix'));
  await Promise.race([none.waitFor({ timeout: 20000 }), vis(p.getByText('Paramètres', { exact: true })).waitFor({ timeout: 20000 })]);
  if (await none.isVisible()) {
    await p.locator('input[aria-label="📄 Importer mon fichier Excel"]').setInputFiles(XLSX);
    await vis(p.getByText('Enregistrer cette grille')).click();
    await vis(p.getByText('Paramètres', { exact: true })).waitFor();
  }

  // Visite : 1 arbre → devis
  await p.goto(APP, { waitUntil: 'load' });
  await vis(p.getByText('+ Nouvelle visite')).click();
  await field('Nom').fill('M. Signature');
  await vis(p.getByText('Enregistrer la visite')).click();
  await vis(p.getByText('➕ Ajouter un arbre sans carte (hors-ligne)')).click();
  await field('Nom ou essence').fill('Filao');
  await vis(p.getByText("Choisir l'intervention")).click();
  await vis(p.getByText('Taille de palmier / cocotier', { exact: true })).click();
  await blur();
  await p.goBack();
  await vis(p.getByText('📄 Créer le devis')).click();
  await vis(p.getByText('Détail (2 lignes)')).waitFor();

  // 1. Déplacement offert
  await p.getByRole('switch', { name: '🎁 Offrir' }).filter({ visible: true }).last().click();
  await vis(p.getByText(/^Offert \(valeur 45\s€ HT\)$/)).waitFor();
  await vis(p.getByText(/Geste commercial : 45\s€ HT offerts/)).waitFor();
  await vis(p.getByText(/^177\s€$/)).waitFor();
  console.log('1. déplacement offert : hors total (177 €), « Geste commercial : 45 € HT offerts »');

  // 2. Finalisation puis signature au doigt
  await vis(p.getByText('✓ Finaliser le devis')).click();
  await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).waitFor({ timeout: 15000 });
  const number = (await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).innerText()).replace('Devis ', '');
  await vis(p.getByText('✍️ Signature du client')).waitFor();
  await field('Nom de la personne qui signe').fill('Jean Signature');
  const pad = vis(p.locator('canvas[aria-label="Zone de signature"]'));
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  await p.mouse.move(box.x + 20, box.y + box.height * 0.7);
  await p.mouse.down();
  for (let i = 0; i <= 20; i++) await p.mouse.move(box.x + 20 + i * 12, box.y + box.height * (0.5 + 0.25 * Math.sin(i / 2)));
  await p.mouse.up();
  await vis(p.getByText('✍️ Valider la signature (Bon pour accord)')).click();
  await vis(p.getByText('✓ Signé par le client')).waitFor({ timeout: 15000 });
  await vis(p.getByText(/par Jean Signature\./)).waitFor();
  await p.screenshot({ path: 'tests/out-devis-signe.png', fullPage: true });
  console.log(`2. devis ${number} finalisé puis signé au doigt par « Jean Signature »`);
  const r = await waitSql(
    `select status, signer_name, signed_at is not null as date_ok, (select storage_path is not null from photos ph where ph.id = q.signature_photo_id) as image_envoyee
     from quotes q where company_id = ${CO} and number = '${number}'`,
    (r) => r[0]?.status === 'signe' && r[0]?.image_envoyee === true,
    'signature'
  );
  console.log('   serveur :', JSON.stringify(r[0]));

  // 3. PDF du devis signé
  const [download] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), vis(p.getByText('📄 PDF du devis')).click()]);
  const file = path.join(__dirname, 'out-devis-signe.pdf');
  await download.saveAs(file);
  const txt = pdfText(fs.readFileSync(file));
  const must = ['DEVIS', `N° ${number}`, 'Devis gratuit', 'SIRET 12345678900011', 'M. Signature', 'TVA non applicable, art. 293 B du CGI', 'Offert', 'Geste commercial', 'Bon pour accord', 'Signé le', 'par Jean Signature'];
  const missing = must.filter((m) => !txt.includes(m));
  const hasImage = fs.readFileSync(file).toString('latin1').includes('/Subtype /Image');
  console.log(`3. PDF téléchargé : « ${download.suggestedFilename()} », ${Math.round(fs.statSync(file).size / 1024)} Ko ; mentions ${missing.length ? 'MANQUANTES : ' + missing.join(', ') : 'toutes présentes'} ; image de la signature ${hasImage ? 'présente' : 'ABSENTE'}`);
  if (missing.length || !hasImage) throw new Error('PDF incomplet');

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch(async (e) => {
  console.error('ÉCHEC', e.message);
  if (page) await page.screenshot({ path: 'tests/out-echec-signature.png', fullPage: true }).catch(() => {});
  process.exit(1);
});
