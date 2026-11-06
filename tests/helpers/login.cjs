// Connexion pour les tests de bout en bout : se connecte avec E2E_EMAIL / E2E_PASSWORD
// et crée l'entreprise de test si c'est la première connexion.
module.exports.login = async function login(p) {
  const vis = (loc) => loc.filter({ visible: true }).first();
  const field = (label) => vis(p.getByLabel(label, { exact: true }));
  const home = vis(p.getByText('+ Nouvelle visite'));
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
