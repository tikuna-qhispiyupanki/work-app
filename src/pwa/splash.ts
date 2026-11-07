// Retire l'écran de démarrage (scripts/splash.html) quand l'application est prête.
// Il reste affiché au moins MIN_MS pour que l'animation ne « clignote » pas.
const MIN_MS = 900;
const started = typeof performance !== 'undefined' ? performance.now() : 0;
let hidden = false;

export function hideSplash() {
  if (hidden || typeof document === 'undefined') return;
  hidden = true;
  const el = document.getElementById('arboject-splash');
  if (!el) return;
  const wait = Math.max(0, MIN_MS - (performance.now() - started));
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 500);
  }, wait);
}
