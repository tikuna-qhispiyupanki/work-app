// Vérifie powersync/sync-config.yaml avec le même analyseur que le service PowerSync.
// Usage : npm run check:sync
const fs = require('fs');
const path = require('path');
const { SqlSyncRules } = require('@powersync/service-sync-rules');
const file = process.argv[2] || path.join(__dirname, '..', 'powersync', 'sync-config.yaml');
try {
  const { errors } = SqlSyncRules.fromYaml(fs.readFileSync(file, 'utf8'), { defaultSchema: 'public' });
  for (const e of errors) console.log(`${e.type === 'warning' ? 'Avertissement' : 'Erreur'} : ${e.message}`);
  if (errors.some((e) => e.type !== 'warning')) process.exit(1);
  console.log('Règles de synchronisation valides ✓');
} catch (e) {
  for (const err of e.errors ?? [e]) console.log(`Erreur : ${err.message}`);
  process.exit(1);
}
