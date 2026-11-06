// Construit la version web installable (PWA) dans dist/.
// 1. copie les fichiers SQLite de PowerSync, 2. export Expo, 3. ajoute manifeste, icônes et service worker.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('npx powersync-web copy-assets -o public');
run('npx expo export --platform web --clear');

const dist = 'dist';
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!p.endsWith('.map') && !p.endsWith('sw.js')) files.push('/' + relative(dist, p).split('\\').join('/'));
  }
};
walk(dist);

// Version = empreinte du contenu : change à chaque nouvelle construction.
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

const sw = readFileSync('scripts/sw-template.js', 'utf8')
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(files.map((f) => (f === '/index.html' ? '/' : f))));
writeFileSync(join(dist, 'sw.js'), sw);

// Balises pour l'installation sur l'écran d'accueil de l'iPhone.
const head = [
  '<link rel="manifest" href="/manifest.json">',
  '<link rel="apple-touch-icon" href="/icons/icon-180.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Arboject">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="theme-color" content="#2F6B3A">',
].join('');
const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');
html = html.replace('<html lang="en">', '<html lang="fr">').replace('</head>', head + '</head>');
writeFileSync(indexPath, html);

console.log(`PWA prête : ${files.length} fichiers mis en cache hors-ligne, version ${version}`);
