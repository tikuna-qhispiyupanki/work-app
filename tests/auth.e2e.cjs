// Test de bout en bout de la connexion (étape 2c-2), sur le vrai projet Supabase.
// Utilise un compte de test temporaire : E2E_EMAIL / E2E_PASSWORD (variables d'environnement).
// Lancer : npx serve -s dist -l 8081, puis E2E_EMAIL=... E2E_PASSWORD=... npm run test:auth
const { chromium, devices } = require('playwright');
const { tab, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;

(async () => {
  if (!EMAIL || !PASSWORD) throw new Error('E2E_EMAIL et E2E_PASSWORD sont requis');
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));

  // 1. Non connecté → écran de connexion
  await p.goto(APP, { waitUntil: 'load' });
  await vis(p.getByText('Se connecter', { exact: true })).waitFor({ timeout: 15000 });
  await p.screenshot({ path: 'tests/out-connexion.png' });
  console.log("1. sans compte : l'écran de connexion s'affiche");

  // 2. Création de compte : contrôle des deux mots de passe (sans envoyer d'e-mail)
  await vis(p.getByText('Créer un compte', { exact: true })).click();
  await field('E-mail').fill('quelquun@example.com');
  await field('Mot de passe').fill('motdepasse1');
  await field('Mot de passe (encore)').fill('motdepasse2');
  await vis(p.getByText('Créer mon compte')).click();
  await vis(p.getByText('Les deux mots de passe ne sont pas identiques.')).waitFor();
  console.log('2. création de compte : mots de passe différents refusés');
  await vis(p.getByText("J'ai déjà un compte : me connecter")).click();

  // 3. Mauvais mot de passe
  await field('E-mail').fill(EMAIL);
  await field('Mot de passe').fill('mauvais-mot-de-passe');
  await vis(p.getByText('Se connecter', { exact: true })).click();
  await vis(p.getByText('E-mail ou mot de passe incorrect.')).waitFor({ timeout: 15000 });
  console.log('3. mauvais mot de passe : message clair en français');

  // 4. Bonne connexion → création de l'entreprise
  await field('Mot de passe').fill(PASSWORD);
  await vis(p.getByText('Se connecter', { exact: true })).click();
  await vis(p.getByText('Bienvenue sur Arboject 🌳')).waitFor({ timeout: 15000 });
  await field("Nom de l'entreprise").fill('Élagage Test E2E');
  await field('Ton prénom et ton nom').fill('Testeur Automatique');
  await p.screenshot({ path: 'tests/out-entreprise.png' });
  await vis(p.getByText('Créer mon entreprise')).click();
  await vis(p.getByText('Nouvelle visite', { exact: true })).waitFor({ timeout: 15000 });
  console.log("4. connexion OK → entreprise créée → accueil");

  // 5. Une visite créée appartient à la nouvelle entreprise
  await p.getByText('Nouvelle visite', { exact: true }).click();
  await field('Nom').fill('Client test connexion');
  await vis(p.getByText('Enregistrer la visite')).click();
  await vis(p.getByText(/^Fiche client/)).waitFor();
  console.log('5. visite créée une fois connecté');

  // 6. Hors-ligne : l'application s'ouvre directement, sans redemander la connexion
  await p.goto(APP, { waitUntil: 'load' });
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.reload({ waitUntil: 'load' });
  await ctx.setOffline(true);
  await p.reload();
  await vis(p.getByText('Client test connexion')).waitFor({ timeout: 15000 });
  console.log("6. HORS LIGNE : l'application s'ouvre connectée, avec la visite");
  // 6 bis. Déconnexion refusée tant qu'une modification n'est pas envoyée (sinon elle serait perdue)
  await vis(p.getByText('Client test connexion')).click();
  await vis(p.getByText('Marquer la visite comme faite')).click();
  await vis(p.getByText('Faite', { exact: true })).waitFor();
  await p.goBack();
  await tab(p, 'Plus').click();
  await vis(p.getByText('Se déconnecter', { exact: true })).click();
  await vis(p.getByText(/Déconnexion impossible pour l'instant/)).waitFor({ timeout: 15000 });
  console.log('6 bis. HORS LIGNE avec une modification en attente : déconnexion refusée (rien de perdu)');
  await ctx.setOffline(false);
  await syncState(p, /Tout est envoyé/);
  await p.goBack();

  // 7. Mon compte → déconnexion
  await tab(p, 'Plus').click();
  await vis(p.getByText('Élagage Test E2E')).waitFor();
  await vis(p.getByText(/· Gérant$/)).waitFor();
  await p.screenshot({ path: 'tests/out-compte.png' });
  await vis(p.getByText('Se déconnecter', { exact: true })).click();
  await vis(p.getByText('Se connecter', { exact: true })).waitFor({ timeout: 15000 });
  console.log('7. Mon compte : entreprise et rôle « Gérant » affichés, déconnexion OK');

  // 8. Reconnexion : l'entreprise existante est retrouvée (pas de nouvelle création)
  await field('E-mail').fill(EMAIL);
  await field('Mot de passe').fill(PASSWORD);
  await vis(p.getByText('Se connecter', { exact: true })).click();
  await vis(p.getByText('Nouvelle visite', { exact: true })).waitFor({ timeout: 15000 });
  console.log("8. reconnexion : retour direct à l'accueil, entreprise retrouvée");

  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('ÉCHEC', e.message); process.exit(1); });
