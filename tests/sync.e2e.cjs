// Test de bout en bout de la synchronisation (étape 2c-3), sur les vrais Supabase + PowerSync.
// Deux « téléphones » (deux navigateurs séparés) connectés au même compte de test.
// Lancer via : bash scripts/e2e.sh sync
const { chromium, devices } = require('playwright');
const { login } = require('./helpers/login.cjs');
const { execFileSync } = require('child_process');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const REF = 'qtfhiehlhowbuweykyyu';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const sql = (q) => JSON.parse(execFileSync('python3', ['scripts/supabase-sql.py', REF, '-'], { input: q }).toString().replace(/^\d+ /, ''));

(async () => {
  const b = await chromium.launch({ proxy });
  const phone = async () => {
    const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
    const p = await ctx.newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push('pageerror: ' + e.message));
    p.on('dialog', (d) => d.accept());
    return p;
  };
  const vis = (p, loc) => loc.filter({ visible: true }).first();
  const field = (p, label) => vis(p, p.getByLabel(label, { exact: true }));
  const allSent = (p) => vis(p, p.getByText('✓ Tout est envoyé au serveur.')).waitFor({ timeout: 45000 });

  // 1. Téléphone A : une visite avec un arbre, puis envoi au serveur
  const A = await phone();
  await A.goto(APP, { waitUntil: 'networkidle' });
  await login(A);
  await A.getByText('+ Nouvelle visite').click();
  await field(A, 'Nom').fill('Mme Sync');
  await field(A, 'Adresse').fill('3 rue des Tamarins');
  await field(A, 'Code postal').fill('97400');
  await field(A, 'Commune').fill('Saint-Denis');
  await vis(A, A.getByText('Enregistrer la visite')).click();
  await vis(A, A.getByText('📒 Fiche client')).waitFor();
  await allSent(A);
  const rows = sql(`select c.name, v.site_city, v.created_by::text = '${'eeeeeeee-0000-4000-8000-00000000e2e0'}' as auteur_ok,
    (select name from companies where id = v.company_id) as entreprise
    from visits v join clients c on c.id = v.client_id where c.name = 'Mme Sync'`);
  console.log('1. A crée une visite → arrivée sur le serveur :', JSON.stringify(rows));
  if (rows.length !== 1 || !rows[0].auteur_ok) throw new Error('visite absente ou mauvais auteur sur le serveur');

  // 2. Une donnée créée au bureau (directement sur le serveur) descend sur A
  sql(`insert into clients (id, company_id, name, created_by)
         select gen_random_uuid(), company_id, 'M. Bureau', user_id from memberships where user_id = 'eeeeeeee-0000-4000-8000-00000000e2e0';
       insert into visits (id, company_id, client_id, visited_at, site_city, created_by)
         select gen_random_uuid(), c.company_id, c.id, now(), 'Le Tampon', c.created_by from clients c where c.name = 'M. Bureau'`);
  await A.goto(APP, { waitUntil: 'networkidle' });
  await vis(A, A.getByText('M. Bureau')).waitFor({ timeout: 45000 });
  console.log('2. visite créée sur le serveur → reçue sur A');

  // 3. Téléphone B (nouveau téléphone, même compte) : tout est récupéré
  const B = await phone();
  await B.goto(APP, { waitUntil: 'networkidle' });
  await login(B);
  await vis(B, B.getByText('Mme Sync')).waitFor({ timeout: 45000 });
  await vis(B, B.getByText('M. Bureau')).waitFor({ timeout: 45000 });
  console.log('3. nouveau téléphone B : les 2 visites sont récupérées');

  // 4. B modifie la visite de Mme Sync → A reçoit la modification
  await vis(B, B.getByText('Mme Sync')).click();
  await vis(B, B.getByText('Modifier', { exact: true })).click();
  await field(B, 'Téléphone').fill('0692 99 88 77');
  await vis(B, B.getByText('Enregistrer les modifications')).click();
  await vis(B, B.getByText('📞 0692 99 88 77')).waitFor();
  await allSent(B);
  await vis(A, A.getByText('Mme Sync')).click();
  await vis(A, A.getByText('📞 0692 99 88 77')).waitFor({ timeout: 45000 });
  console.log('4. B modifie le téléphone → A reçoit la modification');

  // 5. Hors-ligne sur A : la modification attend, puis part au retour du réseau
  await A.context().setOffline(true);
  await vis(A, A.getByText('✓ Marquer la visite comme faite')).click();
  await vis(A, A.getByText(/à envoyer au retour du réseau/)).waitFor({ timeout: 15000 });
  console.log('5. A hors-ligne : la modification attend (« à envoyer au retour du réseau »)');
  await A.context().setOffline(false);
  await allSent(A);
  const st = sql(`select v.status from visits v join clients c on c.id = v.client_id where c.name = 'Mme Sync'`);
  console.log('   retour du réseau → envoyée, statut sur le serveur :', st[0]?.status);
  if (st[0]?.status !== 'faite') throw new Error('statut non envoyé');

  // 6. Déconnexion de A : données retirées du téléphone, puis récupérées à la reconnexion
  await A.goto(APP, { waitUntil: 'networkidle' });
  await allSent(A);
  await vis(A, A.getByLabel('Mon compte')).click();
  await vis(A, A.getByText('Se déconnecter', { exact: true })).click();
  await vis(A, A.getByText('Se connecter', { exact: true })).waitFor({ timeout: 20000 });
  await login(A);
  await vis(A, A.getByText('Mme Sync')).waitFor({ timeout: 45000 });
  console.log('6. déconnexion puis reconnexion de A : les visites reviennent du serveur');

  const errors = [...A.errors, ...B.errors];
  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('ÉCHEC', e.message); process.exit(1); });
