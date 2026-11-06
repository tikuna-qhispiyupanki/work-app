import { BASE_PATH } from '@/config/base-path';

// Enregistre le « service worker » : un petit programme du navigateur qui garde
// une copie de l'application sur le téléphone, pour qu'elle s'ouvre sans réseau.
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.hostname === 'localhost' && !location.search.includes('sw=1')) return; // pas en développement
  navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {
    // Sans service worker, l'application marche quand même avec du réseau.
  });
}
