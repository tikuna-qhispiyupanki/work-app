// Construit la version web installable (PWA) dans dist/.
// 1. copie les fichiers SQLite de PowerSync, 2. export Expo, 3. ajoute manifeste, icônes et service worker.
// Chemin de base : variable EXPO_PUBLIC_BASE_PATH (ex. « /work-app » pour GitHub Pages, vide en local).
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = (process.env.EXPO_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('npx powersync-web copy-assets -o public');
// Grille de prix de départ (La Réunion 2026), proposée au premier lancement : copie du fichier de docs/.
copyFileSync('docs/Grille_tarifaire_elagage_Reunion_2026.xlsx', 'public/grille-tarifaire-reunion-2026.xlsx');
run('npx expo export --platform web --clear');

const dist = 'dist';

// Manifeste : nom, icônes, couleurs de l'application installée.
const manifest = {
  name: 'Arboject',
  short_name: 'Arboject',
  description: "Visites, devis et chantiers d'élagage",
  lang: 'fr',
  start_url: `${BASE}/`,
  scope: `${BASE}/`,
  display: 'standalone',
  background_color: '#E2DFD3',
  theme_color: '#0E5450',
  icons: [
    { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
    { src: `${BASE}/icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Balises pour l'installation sur l'écran d'accueil de l'iPhone.
const head = [
  `<link rel="manifest" href="${BASE}/manifest.json">`,
  `<link rel="apple-touch-icon" href="${BASE}/icons/icon-180.png">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Arboject">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="theme-color" content="#0E5450">',
].join('');
const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');
html = html.replace('<html lang="en">', '<html lang="fr">').replace('</head>', head + '</head>');
writeFileSync(indexPath, html);
// GitHub Pages n'a pas de « page par défaut » : 404.html = l'application, pour les liens directs.
copyFileSync(indexPath, join(dist, '404.html'));
// Indique à GitHub Pages de ne pas traiter le dossier (fichiers commençant par « _ »).
writeFileSync(join(dist, '.nojekyll'), '');

// Liste des fichiers gardés sur le téléphone pour le hors-ligne.
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!/\.map$|sw\.js$|404\.html$|\.nojekyll$|_headers$/.test(p)) files.push('/' + relative(dist, p).split('\\').join('/'));
  }
};
walk(dist);

// Version = empreinte du contenu : change à chaque nouvelle construction.
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

const precache = files.map((f) => BASE + (f === '/index.html' ? '/' : f));
const sw = readFileSync('scripts/sw-template.js', 'utf8')
  .replace('__VERSION__', version)
  .replace('__HOME__', `${BASE}/`)
  .replace('__PRECACHE__', JSON.stringify(precache));
writeFileSync(join(dist, 'sw.js'), sw);

console.log(`PWA prête (base « ${BASE || '/'} ») : ${files.length} fichiers en cache hors-ligne, version ${version}`);
