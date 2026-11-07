// Test de bout en bout : réseaux et voirie sur le chantier — AIPR de l'équipe, aide DT-DICT (infos à copier,
// statut, récépissé), découverte fortuite d'un réseau (consignes, constat PDF, sans réseau), demande d'arrêté de voirie (PDF).
// Lancer via : bash scripts/e2e.sh network-tools
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
  await field('Nom').fill('Mme Reseau');
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
  await field('Nom de la personne qui signe').fill('Mme Reseau');
  await sign();
  await vis(p.getByText('Valider la signature (Bon pour accord)')).click();
  await vis(p.getByRole('button', { name: 'Voir le chantier', exact: true })).click();
  await vis(p.getByText(/^Mme Reseau – D-/)).waitFor({ timeout: 15000 });
  const jobUrl = p.url();
  console.log('0. devis signé → chantier de Mme Reseau');

  // --- 1. Mon équipe : AIPR (une personne expirée)
  await p.goto(APP, { waitUntil: 'load' });
  await tab(p, 'Plus').click();
  await vis(p.getByText('Mon équipe', { exact: true })).click();
  await field('Nom').fill('Noa Aipr');
  await vis(p.getByRole('button', { name: "Ajouter à l'équipe", exact: true })).click();
  await vis(p.getByRole('button', { name: 'Modifier Noa Aipr', exact: true })).click();
  await vis(p.getByRole('radio', { name: 'AIPR Opérateur', exact: true })).click();
  await field("AIPR valable jusqu'au").fill('2026-01-31');
  await vis(p.getByRole('button', { name: 'Terminé', exact: true })).click();
  await vis(p.getByText('AIPR Opérateur expirée depuis le 31/01/2026')).waitFor();
  console.log('1. Mon équipe : AIPR « Opérateur » de Noa notée (expirée → signalée)');

  // --- 2. Chantier : réseaux, DT-DICT
  await p.goto(jobUrl, { waitUntil: 'load' });
  await tab(p, 'Équipe').click();
  await vis(p.getByRole('button', { name: 'Ajouter Noa Aipr au chantier', exact: true })).click();
  await tab(p, 'Infos').click();
  await vis(p.getByRole('checkbox', { name: 'Lignes électriques à proximité du chantier', exact: true })).click();
  await vis(p.getByText(/AIPR manquante ou expirée : Noa Aipr/)).waitFor();
  await vis(p.getByRole('button', { name: 'Infos à saisir sur le guichet (à copier)', exact: true })).click();
  await vis(p.getByRole('button', { name: 'Copier : Nature des travaux', exact: true })).waitFor();
  await vis(p.getByText(/lignes électriques aériennes \(Taille de palmier/)).waitFor();
  await vis(p.getByRole('radio', { name: 'DT-DICT : Déclaration envoyée', exact: true })).click();
  await field('N° de la déclaration (téléservice)').fill('2026110700001X');
  await blur();
  await p.locator('input[aria-label="Choisir des photos"]').first().setInputFiles(PHOTO);
  await vis(p.getByRole('button', { name: 'Voir le récépissé', exact: true })).waitFor({ timeout: 20000 });
  console.log('2. DT-DICT : infos prêtes à copier, statut « envoyée », n° noté, récépissé joint ; alerte AIPR de Noa');

  // --- 3. Découverte fortuite, SANS RÉSEAU
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await ctx.setOffline(true);
  await vis(p.getByRole('button', { name: "J'ai découvert un réseau", exact: true })).click();
  await vis(p.getByText(/Arrêter immédiatement les travaux/)).waitFor();
  await vis(p.getByRole('button', { name: 'Appeler le 18, Pompiers', exact: true })).waitFor();
  await vis(p.getByRole('radio', { name: 'Gaz, hydrocarbures (jaune)', exact: true })).click();
  await field('Description (profondeur, position, état)').fill('Gaine jaune à 40 cm sous la souche');
  await field("Exploitant prévenu (nom, heure, n° d'appel)").fill('Exploitant gaz, 10h05');
  await vis(p.getByRole('button', { name: 'Enregistrer le constat (avec la position GPS)', exact: true })).click();
  await vis(p.getByText(/Gaz, hydrocarbures/).filter({ hasText: '–' })).waitFor({ timeout: 15000 });
  const [d1] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), vis(p.getByText('Constat en PDF (à envoyer)')).click()]);
  const f1 = path.join(__dirname, 'out-constat-reseau.pdf');
  await d1.saveAs(f1);
  const t1 = pdfText(fs.readFileSync(f1));
  if (!t1.includes('DÉCOUVERTE FORTUITE') || !t1.includes('Gaine jaune') || !t1.includes('Exploitant gaz')) throw new Error('constat PDF incomplet');
  console.log('3. HORS LIGNE : consignes, constat de découverte (gaz) enregistré, PDF du constat');
  await p.goBack();

  // --- 4. Arrêté de voirie (toujours sans réseau)
  await vis(p.getByRole('button', { name: 'Préparer une demande d’arrêté de voirie', exact: true })).click();
  await field('Destinataire').fill('Mairie de Saint-Paul');
  await blur();
  await vis(p.getByRole('checkbox', { name: 'Circulation alternée (feux tricolores ou piquets K10)', exact: true })).click();
  await vis(p.getByText(/arrêté temporaire de circulation et de stationnement prévoyant les mesures suivantes : .*Circulation alternée/)).waitFor();
  const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), vis(p.getByText('Demande en PDF (à envoyer à la mairie)')).click()]);
  const f2 = path.join(__dirname, 'out-arrete-voirie.pdf');
  await d2.saveAs(f2);
  const t2 = pdfText(fs.readFileSync(f2));
  if (!t2.includes('Mairie de Saint-Paul') || !t2.includes('Circulation altern')) throw new Error('demande d’arrêté incomplète : ' + t2.slice(0, 300));
  console.log('4. HORS LIGNE : demande d’arrêté de voirie pré-remplie, PDF');

  // --- 5. Retour du réseau
  await ctx.setOffline(false);
  await syncState(p, /Tout est envoyé/, 120000);
  const srv = await waitSql(
    `select (select dt_dict_status || ' ' || dt_dict_reference from jobs where title like 'Mme Reseau%' and company_id in ${CO}) as dtdict,
            (select road_permit like '%Saint-Paul%' from jobs where title like 'Mme Reseau%' and company_id in ${CO}) as voirie,
            (select count(*) from network_findings n join jobs j on j.id = n.job_id where j.title like 'Mme Reseau%' and n.network_type = 'gaz') as constats,
            (select count(*) from photos ph join jobs j on j.id = ph.owner_id where ph.kind = 'document' and j.title like 'Mme Reseau%' and ph.storage_path is not null) as recepisses,
            (select aipr_profile || ' ' || aipr_valid_until from team_members where name = 'Noa Aipr' and company_id in ${CO}) as aipr`,
    (r) => r[0]?.constats === 1 && r[0]?.recepisses === 1,
    'réseaux et voirie'
  );
  console.log('5. serveur :', JSON.stringify(srv[0]));

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
})().catch(async (e) => {
  console.error('ÉCHEC', e.message.split('\n').slice(0, 3).join(' | '));
  if (global.pg) console.error('page :', (await global.pg.innerText('body').catch(() => '')).slice(0, 400).replace(/\n+/g, ' / '));
  process.exit(1);
});
