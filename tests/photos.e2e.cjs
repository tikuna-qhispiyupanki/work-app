// Test de bout en bout des photos (étape 2d), sur les vrais Supabase + PowerSync.
// Lancer via : bash scripts/e2e.sh photos
const { chromium, devices } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');
const { login, tab, menu, syncState } = require('./helpers/login.cjs');
const APP = process.argv[2] || 'http://localhost:8081/?sw=1';
const PHOTO = path.join(__dirname, 'fixtures', 'photo-4000x3000-gps.jpg');
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const CO = `(select company_id from memberships where user_id = 'eeeeeeee-0000-4000-8000-00000000e2e0')`;
const sql = (q) => JSON.parse(execFileSync('python3', ['scripts/supabase-sql.py', 'qtfhiehlhowbuweykyyu', '-'], { input: q }).toString().replace(/^\d+ /, ''));

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
  const serverFiles = () => Number(sql(`select count(*) as n from storage.objects o join photos p on o.name in (p.storage_path, replace(p.storage_path, '.jpg', '_min.jpg')) where o.bucket_id = 'photos' and p.kind = 'photo' and p.company_id = ${CO}`)[0].n);
  const waitServerFiles = async (n) => {
    for (let i = 0; i < 40; i++) {
      if (serverFiles() >= n && Number(sql(`select count(*) as n from photos where company_id = ${CO} and kind = 'photo' and storage_path is null and deleted_at is null`)[0].n) === 0) return;
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error(`le serveur n'a pas reçu ${n} fichiers`);
  };
  const photosSent = (p) => p.waitForFunction(() => [...document.querySelectorAll('[aria-label^="Synchronisation : "]')].every((e) => !/photo.? (en cours d’envoi|à envoyer)/.test(e.getAttribute('aria-label'))), null, { timeout: 60000 });

  // 1. A : visite + photo choisie dans la galerie
  const A = await phone();
  await A.goto(APP, { waitUntil: 'load' });
  await login(A);
  await A.getByText('Nouvelle visite', { exact: true }).click();
  await field(A, 'Nom').fill('M. Photo');
  await vis(A, A.getByText('Enregistrer la visite')).click();
  await tab(A, 'Photos').click();
  await vis(A, A.getByText('Prendre une photo')).waitFor();
  await A.locator('input[aria-label="Choisir des photos"]').setInputFiles(PHOTO);
  await vis(A, A.getByLabel('Voir la photo')).waitFor({ timeout: 20000 });
  console.log('1. photo ajoutée : miniature affichée tout de suite');

  // 2. Envoi vers le stockage privé
  await waitServerFiles(2);
  await photosSent(A);
  const files = sql(`select o.name from storage.objects o join photos p on o.name in (p.storage_path, replace(p.storage_path, '.jpg', '_min.jpg')) where o.bucket_id = 'photos' and p.kind = 'photo' and p.company_id = ${CO}`).map((r) => r.name);
  const row = sql(`select width, height, bytes, storage_path, lat is not null as gps_en_base from photos where kind = 'photo' and company_id = ${CO}`)[0];
  console.log(`2. envoyée : ${files.length} fichiers dans le dossier de l'entreprise (photo + miniature) ; en base ${row.width}×${row.height}, ${Math.round(row.bytes / 1024)} Ko`);
  if (files.length !== 2 || !row.storage_path || Math.max(row.width, row.height) !== 1600) throw new Error('envoi ou compression incorrects');

  // 3. B (autre appareil) : la photo est téléchargée depuis le serveur, sans GPS dans le fichier
  const B = await phone();
  await B.goto(APP, { waitUntil: 'load' });
  await login(B);
  await vis(B, B.getByText('M. Photo')).click();
  await tab(B, 'Photos').click();
  await vis(B, B.getByLabel('Voir la photo')).click();
  const img = vis(B, B.getByAltText('Photo'));
  await img.waitFor({ timeout: 30000 });
  await B.waitForFunction(() => [...document.images].some((i) => i.alt === 'Photo' && i.naturalWidth > 0), null, { timeout: 30000 });
  const info = await B.evaluate(async () => {
    const i = [...document.images].find((x) => x.alt === 'Photo' && x.naturalWidth > 0);
    const buf = new Uint8Array(await (await fetch(i.src)).arrayBuffer());
    const text = new TextDecoder('latin1').decode(buf);
    return { w: i.naturalWidth, h: i.naturalHeight, kb: Math.round(buf.length / 1024), exif: text.includes('Exif'), model: text.includes('iPhone Test') };
  });
  console.log(`3. autre appareil : photo téléchargée (${info.w}×${info.h}, ${info.kb} Ko), métadonnées EXIF/GPS dans le fichier : ${info.exif || info.model ? 'PRÉSENTES → ÉCHEC' : 'aucune ✓'}`);
  if (info.exif || info.model || info.w !== 1600) throw new Error('fichier non conforme');

  // 4. Hors-ligne : la photo attend, puis part au retour du réseau
  await A.context().setOffline(true);
  await A.locator('input[aria-label="Choisir des photos"]').setInputFiles(PHOTO);
  await syncState(A, /1 photo à envoyer au retour du réseau/, 20000);
  console.log('4. HORS LIGNE : « 1 photo à envoyer au retour du réseau »');
  await A.context().setOffline(false);
  await waitServerFiles(4);
  await photosSent(A);
  const n = serverFiles();
  console.log(`   retour du réseau → envoyée (${n} fichiers sur le serveur)`);
  if (Number(n) !== 4) throw new Error('photo hors-ligne non envoyée');

  // 5. Haute définition
  await vis(A, A.getByLabel('Haute définition')).click();
  await A.locator('input[aria-label="Choisir des photos"]').setInputFiles(PHOTO);
  await A.waitForTimeout(3000);
  const hd = sql(`select max(greatest(width, height)) as m from photos where kind = 'photo' and company_id = ${CO}`)[0].m;
  console.log(`5. option haute définition : ${hd} px sur le plus grand côté`);
  if (Number(hd) !== 3200) throw new Error('HD incorrecte');
  await photosSent(A);

  const errors = [...A.errors, ...B.errors];
  console.log('Erreurs :', errors.length ? errors : 'aucune');
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('ÉCHEC', e.message); process.exit(1); });
