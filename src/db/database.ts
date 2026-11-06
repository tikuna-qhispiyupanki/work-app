import { PowerSyncDatabase, WASQLiteVFS } from '@powersync/web';

import { AppSchema } from './schema';

// Base locale du navigateur (version web / iPhone en « application web »).
// Les fichiers techniques de SQLite sont copiés dans public/@powersync par `npm run assets`.
// IndexedDB est utilisé car c'est le stockage le plus fiable sur Safari iPhone.
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'arboject.db',
    vfs: WASQLiteVFS.IDBBatchAtomicVFS,
    worker: '/@powersync/worker.js',
    enableMultiTabs: false,
  },
});

// Demande au navigateur de ne pas effacer nos données pour gagner de la place.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // Le navigateur refuse ou ne sait pas : on continue sans.
  }
  return false;
}

// Entreprise et utilisateur provisoires, en attendant la connexion (étape 2c).
export const LOCAL_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000002';

export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();
