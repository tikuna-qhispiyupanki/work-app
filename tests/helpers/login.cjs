// Connexion pour les tests de bout en bout : se connecte avec E2E_EMAIL / E2E_PASSWORD
// et crée l'entreprise de test si c'est la première connexion.
module.exports.login = async function login(p) {
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));
  const home = vis(p.getByText('Nouvelle visite', { exact: true }));
  const loginBtn = vis(p.getByText('Se connecter', { exact: true }));
  await Promise.race([home.waitFor({ timeout: 20000 }), loginBtn.waitFor({ timeout: 20000 })]);
  if (await home.isVisible()) return;
  await field('E-mail').fill(process.env.E2E_EMAIL);
  await field('Mot de passe').fill(process.env.E2E_PASSWORD);
  await loginBtn.click();
  const welcome = vis(p.getByText('Bienvenue sur Arboject 🌳'));
  await Promise.race([home.waitFor({ timeout: 20000 }), welcome.waitFor({ timeout: 20000 })]);
  if (await welcome.isVisible()) {
    await field("Nom de l'entreprise").fill('Élagage Test E2E');
    await vis(p.getByText('Créer mon entreprise')).click();
    await home.waitFor({ timeout: 20000 });
  }
};

// Onglet (barre du bas ou onglets d'une page, ex. « Arbres » sur la visite).
// (le nom des onglets du bas commence par le caractère de l'icône : on l'ignore)
module.exports.tab = (p, name) =>
  p.getByRole('tab', { name: new RegExp(`^[^\\p{L}]*${name}$`, 'u') }).filter({ visible: true }).first();
// Menu « ⋯ » de l'en-tête d'une page, puis une action.
module.exports.menu = async (p, menuLabel, action) => {
  await p.getByRole('button', { name: menuLabel, exact: true }).filter({ visible: true }).first().click();
  await p.getByRole('button', { name: action, exact: true }).filter({ visible: true }).first().click();
};
// État de la synchronisation : lu dans la pastille de l'en-tête (texte complet dans son aria-label).
module.exports.syncState = (p, re, timeout = 45000) =>
  p.waitForFunction(
    (src) => [...document.querySelectorAll('[aria-label^="Synchronisation : "]')].some((e) => e.checkVisibility() && !e.closest('[aria-hidden="true"]') && new RegExp(src).test(e.getAttribute('aria-label'))),
    re.source,
    { timeout }
  );
