// Configuration Expo : reprend app.json et ajoute le chemin de base pour GitHub Pages.
const base = (process.env.EXPO_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, ...(base ? { baseUrl: base } : {}) },
});
