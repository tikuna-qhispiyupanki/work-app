// Service worker d'Arboject (généré par scripts/build-web.mjs, ne pas modifier dans dist/).
const VERSION = '__VERSION__';
const CACHE = `arboject-${VERSION}`;
const PRECACHE = __PRECACHE__;
const HOME = '__HOME__';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('arboject-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fichiers de l'application : d'abord la copie locale, sinon le réseau.
// Pages (navigation) : toujours l'application, même sans réseau.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(HOME, { cacheName: CACHE })));
    return;
  }
  event.respondWith(caches.match(req, { cacheName: CACHE }).then((hit) => hit || fetch(req)));
});
