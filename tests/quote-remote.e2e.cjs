// Test de bout en bout : signature du devis à distance (lien personnel), sur deux navigateurs.
// L'artisan envoie le lien ; le « client » (navigateur sans compte) lit le devis et le signe ;
// le devis passe à « Signé » sur le téléphone de l'artisan. Lancer via : bash scripts/e2e.sh quote-remote
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { inflateSync } = require('zlib');
const { login, tab, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const ORIGIN = new URL(APP).origin;
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
const sign = async (p, canvas) => {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await p.mouse.move(box.x + 20, box.y + box.height * 0.7);
  await p.mouse.down();
  for (let i = 0; i <= 20; i++) await p.mouse.move(box.x + 20 + i * 12, box.y + box.height * (0.5 + 0.25 * Math.sin(i / 2)));
  await p.mouse.up();
};

(async () => {
  const b = await chromium.launch({ proxy });
  const errors = [];
  // Téléphone de l'artisan (sans « partager » : le lien est copié / affiché)
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('artisan: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));
  const blur = () => p.locator('body').click({ position: { x: 5, y: 300 } });

  await p.goto(APP, { waitUntil: 'load' });
  await login(p);
  // Fiche entreprise et grille (si pas déjà faites par un autre test)
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

  // Visite, 1 arbre, devis finalisé
  await p.goto(APP, { waitUntil: 'load' });
  await vis(p.getByText('Nouvelle visite', { exact: true })).click();
  await field('Nom').fill('Mme Distance');
  await field('Téléphone').fill('0692 77 66 55');
  await vis(p.getByText('Enregistrer la visite')).click();
  await tab(p, 'Arbres').click();
  await vis(p.getByText('Ajouter un arbre sans carte (hors-ligne)')).click();
  await field('Nom ou essence').fill('Flamboyant');
  await vis(p.getByText("Choisir l'intervention")).click();
  await vis(p.getByText('Taille de palmier / cocotier', { exact: true })).click();
  await blur();
  await p.goBack();
  await tab(p, 'Devis').click();
  await vis(p.getByText('Créer le devis')).click();
  await vis(p.getByText('Finaliser le devis')).click();
  await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).waitFor({ timeout: 15000 });
  const number = (await vis(p.getByText(/^Devis D-\d{4}-\d{4}$/)).innerText()).replace('Devis ', '');
  console.log(`1. devis ${number} finalisé pour Mme Distance`);

  // 2. Envoi du lien
  await vis(p.getByRole('button', { name: 'Envoyer un lien de signature', exact: true })).click();
  const linkEl = vis(p.getByLabel('Lien de signature', { exact: true }));
  await linkEl.waitFor();
  const link = (await linkEl.innerText()).trim();
  if (!/\/signer\/[A-Za-z0-9_-]{43}$/.test(link)) throw new Error('lien incorrect : ' + link);
  await vis(p.getByText(/pas encore ouvert/)).waitFor();
  await syncState(p, /Tout est envoyé/);
  await p.screenshot({ path: 'tests/out-lien-signature.png' });
  console.log('2. lien personnel créé et envoyé au serveur :', link.replace(/[A-Za-z0-9_-]{43}$/, '…(jeton de 43 caractères)'));

  // 3. Le client ouvre le lien (autre navigateur, sans compte)
  const cctx = await b.newContext({ ...devices['Pixel 7'], locale: 'fr-FR', acceptDownloads: true });
  const c = await cctx.newPage();
  global.clientPage = c;
  c.on('pageerror', (e) => errors.push('client: ' + e.message));
  const cvis = (loc) => loc.filter({ visible: true }).first();
  await c.goto(ORIGIN + new URL(link).pathname, { waitUntil: 'load' });
  await cvis(c.getByText(`Devis ${number}`)).waitFor({ timeout: 20000 });
  await cvis(c.getByText('Élagage Test E2E')).waitFor();
  await cvis(c.getByText(/Taille de palmier/)).waitFor();
  await cvis(c.getByText('TVA non applicable, art. 293 B du CGI')).waitFor();
  const local = await c.evaluate(() => ({ idb: indexedDB.databases ? null : null, keys: Object.keys(localStorage) }));
  console.log('3. client : devis affiché sans compte (entreprise, lignes, mention de TVA) ; données gardées sur son appareil :', JSON.stringify(local.keys));
  // (SANS_REGLES=1 : règles PowerSync pas encore déployées → on saute ce que le téléphone reçoit du serveur)
  if (!process.env.SANS_REGLES) {
    await vis(p.getByText(/Lien ouvert par le client le/)).waitFor({ timeout: 45000 });
    console.log('   artisan : « Lien ouvert par le client » affiché');
  }

  // 4. Signature
  await cvis(c.getByRole('button', { name: 'Signer le devis' })).waitFor();
  await cvis(c.getByLabel('J’ai lu et j’accepte ce devis')).click();
  await cvis(c.getByLabel('Votre nom', { exact: true })).fill('Martine Distance');
  await sign(c, cvis(c.locator('canvas[aria-label="Zone de signature"]')));
  await c.screenshot({ path: 'tests/out-signature-client.png', fullPage: true });
  await cvis(c.getByRole('button', { name: 'Signer le devis' })).click();
  await cvis(c.getByText(/Devis signé le .* par Martine Distance/)).waitFor({ timeout: 20000 });
  const [download] = await Promise.all([c.waitForEvent('download', { timeout: 20000 }), cvis(c.getByText('Télécharger mon exemplaire signé (PDF)')).click()]);
  const file = path.join(__dirname, 'out-devis-signe-distance.pdf');
  await download.saveAs(file);
  const txt = pdfText(fs.readFileSync(file));
  const must = [`N° ${number}`, 'Signé le', 'par Martine Distance', 'Signature électronique à distance', 'Empreinte SHA-256'];
  const missing = must.filter((m) => !txt.includes(m));
  if (missing.length) throw new Error('PDF du client incomplet : ' + missing.join(', '));
  console.log(`4. client signe → « Devis signé » ; il télécharge son exemplaire signé (${Math.round(fs.statSync(file).size / 1024)} Ko, preuve imprimée)`);

  const srv = await waitSql(
    `select q.status, q.signer_name, r.status as lien, r.document_hash is not null as empreinte, r.signer_ip is not null as ip, length(r.signature_data) > 1000 as image
     from quotes q join quote_sign_requests r on r.quote_id = q.id where q.company_id in ${CO} and q.number = '${number}'`,
    (r) => r[0]?.status === 'signe',
    'devis signé'
  );
  console.log('   serveur :', JSON.stringify(srv[0]));

  // 5. Le lien ne sert qu'une fois
  await c.reload({ waitUntil: 'load' });
  await cvis(c.getByText(/Devis signé le/)).waitFor({ timeout: 20000 });
  const again = await c.getByRole('button', { name: 'Signer le devis' }).filter({ visible: true }).count();
  if (again) throw new Error('le lien permet encore de signer');
  console.log('5. lien rouvert : « déjà signé », plus de bouton de signature');

  // 6. Côté artisan : le devis passe à « Signé » tout seul, avec la preuve
  await vis(p.getByText('✓ Signé par le client')).waitFor({ timeout: 45000 });
  if (!process.env.SANS_REGLES) await vis(p.getByText(/Signé à distance par le lien personnel/)).waitFor({ timeout: 45000 });
  await p.screenshot({ path: 'tests/out-devis-signe-distance.png', fullPage: true });
  console.log('6. artisan : devis « Signé par le client » (à distance), signature et empreinte affichées');

  // 7. Lien inventé
  await c.goto(ORIGIN + '/signer/' + 'x'.repeat(43), { waitUntil: 'load' });
  await cvis(c.getByText(/Ce lien est inconnu/)).waitFor({ timeout: 20000 });
  console.log('7. lien inventé : « Ce lien est inconnu »');

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
})().catch(async (e) => {
  console.error('ÉCHEC', e.message);
  if (global.clientPage) {
    await global.clientPage.screenshot({ path: 'tests/out-echec-client.png' }).catch(() => {});
    console.error('page client :', (await global.clientPage.innerText('body').catch(() => '')).slice(0, 500));
  }
  process.exit(1);
});
