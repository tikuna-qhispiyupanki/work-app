// Chemin de base de l'application en ligne.
// GitHub Pages : « /work-app » (adresse …github.io/work-app/). En local : vide.
// Fixé au moment de la construction par la variable EXPO_PUBLIC_BASE_PATH.
export const BASE_PATH = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
