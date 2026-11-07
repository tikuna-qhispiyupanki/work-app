// Fichiers (images) gardés sur le téléphone, dans IndexedDB.
// Chaque fichier a la même clé que sa ligne dans la table `photos`.
// Miniature : clé « <id>_min ». Envoi vers le serveur : src/sync/uploader.ts. Copie locale
// des photos venues du serveur : même clé (cache).

const DB_NAME = 'arboject-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const saveFile = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id)).then(() => undefined);
export const readFile = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
export const deleteFile = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined);
export const clearFiles = () => run('readwrite', (s) => s.clear()).then(() => undefined);
