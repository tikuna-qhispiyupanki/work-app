import { currentIds } from '@/auth/current';
import { supabase } from '@/auth/supabase';
import { LOCAL_COMPANY_ID, db, newId, nowIso } from '@/db/database';
import { storagePath, thumbKey } from '@/db/photos';
import { makeThumbnail } from '@/files/image';
import { readFile, saveFile } from '@/files/local-files';

// Envoi des fichiers photo vers l'espace de stockage privé (Supabase Storage).
// Les informations de la photo (date, GPS, légende) voyagent avec PowerSync ; le fichier, lui, passe ici.
// - fonctionne avec une file d'attente sur le téléphone (table locale upload_queue) ;
// - réessaie tout seul après une coupure, de plus en plus espacé (jusqu'à 1 h) ;
// - une photo déjà envoyée n'est jamais renvoyée ni écrasée.
// Limite de la version web : pas d'envoi quand l'application est fermée (pas d'arrière-plan sur iPhone).

const BUCKET = 'photos';
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startUploader() {
  if (timer || typeof window === 'undefined') return;
  timer = setInterval(() => void uploadPending(), 20000);
  window.addEventListener('online', kick);
  void uploadPending();
}

export function stopUploader() {
  if (timer) clearInterval(timer);
  timer = null;
  if (typeof window !== 'undefined') window.removeEventListener('online', kick);
}

function kick() {
  void uploadPending();
}
export const kickUploader = kick;

export async function pendingUploads(): Promise<number> {
  const r = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM upload_queue');
  return r.n;
}

// Photos de ce téléphone créées avant la file d'envoi (ex. images de plan) : on les ajoute à la file.
async function backfill() {
  const rows = await db.getAll<{ id: string }>(
    `SELECT id FROM photos WHERE storage_path IS NULL AND deleted_at IS NULL
       AND id NOT IN (SELECT photo_id FROM upload_queue)`
  );
  for (const r of rows) {
    if (!(await readFile(r.id))) continue; // fichier sur un autre téléphone
    await db.execute('INSERT INTO upload_queue (id, photo_id, attempts, created_at) VALUES (?, ?, 0, ?)', [newId(), r.id, nowIso()]);
  }
}

async function putFile(path: string, blob: Blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (!error) return;
  const status = String((error as { statusCode?: string | number }).statusCode ?? '');
  if (status === '409' || /already exists|Duplicate/i.test(error.message)) return; // déjà envoyé : rien à faire
  throw error;
}

export async function uploadPending(): Promise<void> {
  if (running || typeof navigator === 'undefined' || !navigator.onLine) return;
  if (currentIds().companyId === LOCAL_COMPANY_ID) return; // pas encore connecté
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  running = true;
  try {
    await backfill();
    const queue = await db.getAll<{ qid: string; photo_id: string; attempts: number; company_id: string | null; storage_path: string | null }>(
      `SELECT q.id AS qid, q.photo_id, q.attempts, p.company_id, p.storage_path
       FROM upload_queue q LEFT JOIN photos p ON p.id = q.photo_id
       WHERE q.next_try_at IS NULL OR q.next_try_at <= ?
       ORDER BY q.created_at`,
      [nowIso()]
    );
    for (const item of queue) {
      if (!navigator.onLine) break;
      try {
        if (item.storage_path || !item.company_id) {
          await db.execute('DELETE FROM upload_queue WHERE id = ?', [item.qid]);
          continue;
        }
        if (item.company_id === LOCAL_COMPANY_ID) continue;
        const main = await readFile(item.photo_id);
        if (!main) throw new Error('Fichier introuvable sur ce téléphone');
        let thumb = await readFile(thumbKey(item.photo_id));
        if (!thumb) {
          thumb = (await makeThumbnail(main)).blob;
          await saveFile(thumbKey(item.photo_id), thumb);
        }
        await putFile(storagePath(item.company_id, item.photo_id), main);
        await putFile(storagePath(item.company_id, item.photo_id, true), thumb);
        await db.writeTransaction(async (tx) => {
          await tx.execute('UPDATE photos SET storage_path = ?, updated_at = ? WHERE id = ?', [
            storagePath(item.company_id!, item.photo_id), nowIso(), item.photo_id,
          ]);
          await tx.execute('DELETE FROM upload_queue WHERE id = ?', [item.qid]);
        });
      } catch (e) {
        const attempts = item.attempts + 1;
        const delay = Math.min(2 ** attempts * 30, 3600) * 1000; // 1 min, 2 min, 4 min… jusqu'à 1 h
        await db.execute('UPDATE upload_queue SET attempts = ?, last_error = ?, next_try_at = ? WHERE id = ?', [
          attempts, e instanceof Error ? e.message : String(e), new Date(Date.now() + delay).toISOString(), item.qid,
        ]);
      }
    }
  } finally {
    running = false;
  }
}

// Photo venue d'un autre téléphone : téléchargement par lien signé temporaire, puis copie locale.
export async function fetchRemotePhoto(path: string, cacheKey: string): Promise<Blob | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data) return null;
  const res = await fetch(data.signedUrl);
  if (!res.ok) return null;
  const blob = await res.blob();
  await saveFile(cacheKey, blob);
  return blob;
}
