// Test de bout en bout de la fiche arbre (étape 4a).
// Lancer via : bash scripts/e2e.sh tree-sheet
const { chromium, devices } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');
const { login } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const XLSX = path.join(__dirname, '..', 'docs', 'Grille_tarifaire_elagage_Reunion_2026.xlsx');
const PHOTO = path.join(__dirname, 'fixtures', 'photo-4000x3000-gps.jpg');
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const CO = `(select company_id from memberships where user_id = 'eeeeeeee-0000-4000-8000-00000000e2e0')`;
const sql = (q) => JSON.parse(execFileSync('python3', ['scripts/supabase-sql.py', 'qtfhiehlhowbuweykyyu', '-'], { input: q }).toString().replace(/^\d+ /, ''));

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
  // Grille de prix (si absente)
  await vis(p.getByLabel('Mon compte')).click();
  await vis(p.getByText('💶 Grille de prix')).click();
  const none = vis(p.getByText('Aucune grille de prix'));
  await Promise.race([none.waitFor({ timeout: 20000 }), vis(p.getByText('Paramètres', { exact: true })).waitFor({ timeout: 20000 })]);
  // Toujours repartir d'une grille neuve (un test précédent a pu changer « mon prix »).
  const input = (await none.isVisible()) ? '📄 Importer mon fichier Excel' : '📄 Importer une nouvelle version (Excel)';
  await p.locator(`input[aria-label="${input}"]`).setInputFiles(XLSX);
  await vis(p.getByText(/^(Enregistrer cette grille|Remplacer la grille actuelle)$/)).click();
  await vis(p.getByText('Paramètres', { exact: true })).waitFor();
  await vis(p.getByText('Prix retenu : 313 € HT')).waitFor();
  await p.goto(APP, { waitUntil: 'load' });

  // 1. Visite sans localisation (comme hors-ligne) → arbre ajouté sans carte
  await vis(p.getByText('+ Nouvelle visite')).click();
  await field('Nom').fill('Mme Arbre');
  await vis(p.getByText('Enregistrer la visite')).click();
  await vis(p.getByText('➕ Ajouter un arbre sans carte (hors-ligne)')).click();
  await vis(p.getByText('Arbre n° 1')).waitFor();
  console.log('1. arbre n° 1 ajouté sans carte → fiche ouverte');

  // 2. Fiche : nom, hauteur → suggestion, diamètre 70 → tronc > 60 cm coché tout seul
  await field('Nom ou essence').fill('Manguier');
  await field('Hauteur (m)').fill('7');
  await field('Diamètre du tronc (cm)').click();
  await vis(p.getByText(/Suggestion pour 7 m : Élagage d'entretien – arbre 5 à 10 m/)).click();
  await vis(p.getByText("Élagage d'entretien – arbre 5 à 10 m", { exact: true })).waitFor();
  await field('Diamètre du tronc (cm)').fill('70');
  await blur();
  await p.waitForFunction(() => document.querySelector('[aria-label^="Tronc de plus de 60 cm"]')?.getAttribute('aria-checked') === 'true' || [...document.querySelectorAll('input[type=checkbox]')].some((c) => c.getAttribute('aria-label')?.startsWith('Tronc de plus de 60 cm') && c.checked), null, { timeout: 10000 });
  console.log('2. hauteur 7 m → intervention suggérée et choisie ; diamètre 70 cm → « tronc > 60 cm » coché tout seul');

  // 3. Contraintes et temps → estimation : 313 × (1 + 30 % + 25 %) + 2 h × 35 + 3 m³ × 60 = 735,15 €
  await vis(p.getByLabel(/^Rétention/)).click();
  await field('Heures homme au sol (portage, protection, nettoyage) (h)').fill('2');
  await field('Déchets verts à évacuer (m³)').fill('3');
  await blur();
  await vis(p.getByText(/^735,15\s€$/)).waitFor({ timeout: 10000 });
  await p.screenshot({ path: 'tests/out-fiche-arbre.png', fullPage: true });
  console.log('3. estimation de l’arbre : 735,15 € HT (prestation majorée + temps + déchets)');

  // 4. Photo de l'arbre
  await p.locator('input[aria-label="Choisir des photos"]').last().setInputFiles(PHOTO); // le dernier = l'écran affiché (fiche arbre)
  await vis(p.getByLabel('Voir la photo')).waitFor({ timeout: 20000 });
  console.log('4. photo de l’arbre ajoutée');

  // 5. Retour à la visite : résumé de l'arbre et estimation de la visite (+ déplacement 45 €)
  await p.goBack();
  await vis(p.getByText(/≈ 735,15\s€ HT/)).waitFor();
  await vis(p.getByText(/Estimation de la visite : ≈ 780,15\s€ HT/)).waitFor();
  console.log('5. visite : arbre résumé (≈ 735,15 €) et estimation de la visite ≈ 780,15 € HT (déplacement inclus)');

  // 6. Données envoyées au serveur
  let row;
  for (let i = 0; i < 20; i++) {
    row = sql(`select species, height_m, trunk_diameter_cm, intervention, retention, big_trunk, estimated_ground_hours, waste_m3,
      (select count(*) from photos ph where ph.owner_id = t.id and ph.storage_path is not null) as photos
      from trees t join visits v on v.id = t.visit_id join clients c on c.id = v.client_id where t.company_id = ${CO} and c.name = 'Mme Arbre'`)[0];
    if (row && row.waste_m3 === 3 && Number(row.photos) === 1) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log('6. serveur :', JSON.stringify(row));
  if (!row || row.big_trunk !== 1 || row.retention !== 1 || row.height_m !== 7 || Number(row.photos) !== 1) throw new Error('fiche incomplète sur le serveur');

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('ÉCHEC', e.message); process.exit(1); });
