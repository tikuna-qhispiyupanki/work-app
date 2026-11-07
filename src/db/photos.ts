import { currentIds } from '@/auth/current';
import { CompressedImage, makeThumbnail } from '@/files/image';
import { deleteFile, saveFile } from '@/files/local-files';

import { db, newId, nowIso } from './database';

export type PhotoKind = 'photo' | 'plan' | 'croquis' | 'signature' | 'logo';
export type PhotoRow = {
  id: string;
  owner_id?: string;
  company_id: string;
  kind: PhotoKind;
  width: number;
  height: number;
  storage_path: string | null;
  taken_at: string;
  lat: number | null;
  lng: number | null;
  caption: string | null;
};

// Chemin dans l'espace de stockage privé : un dossier par entreprise.
export const storagePath = (companyId: string, photoId: string, thumb = false) =>
  `${companyId}/${photoId}${thumb ? '_min' : ''}.jpg`;
export const thumbKey = (photoId: string) => `${photoId}_min`;

type NewPhoto = {
  ownerType: 'visit' | 'tree' | 'job' | 'message' | 'quote' | 'company' | 'sheet';
  ownerId: string;
  kind: PhotoKind;
  image: CompressedImage;
  lat?: number | null;
  lng?: number | null;
  caption?: string;
  replaceSameKind?: boolean; // ex. une seule image de plan active par visite
  stage?: 'avant' | 'pendant' | 'apres' | null; // photos de chantier
};

// Enregistre une photo : fichier + miniature sur le téléphone, ligne en base (synchronisée),
// et mise en file d'envoi du fichier. Fonctionne sans réseau.
export async function addPhoto(p: NewPhoto): Promise<string> {
  const { companyId, userId } = currentIds();
  const id = newId();
  const now = nowIso();
  const thumb = await makeThumbnail(p.image.blob);
  await saveFile(id, p.image.blob);
  await saveFile(thumbKey(id), thumb.blob);
  try {
    await db.writeTransaction(async (tx) => {
      if (p.replaceSameKind) {
        await tx.execute(
          `UPDATE photos SET deleted_at = ?, updated_at = ?
           WHERE owner_type = ? AND owner_id = ? AND kind = ? AND deleted_at IS NULL`,
          [now, now, p.ownerType, p.ownerId, p.kind]
        );
      }
      await tx.execute(
        `INSERT INTO photos (id, company_id, created_at, updated_at, created_by, owner_type, owner_id, kind,
           mime_type, width, height, bytes, taken_at, lat, lng, caption, include_in_report, stage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'image/jpeg', ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [id, companyId, now, now, userId, p.ownerType, p.ownerId, p.kind, p.image.width, p.image.height,
          p.image.blob.size, now, p.lat ?? null, p.lng ?? null, p.caption ?? null, p.stage ?? null]
      );
      await tx.execute('INSERT INTO upload_queue (id, photo_id, attempts, created_at) VALUES (?, ?, 0, ?)', [newId(), id, now]);
    });
  } catch (e) {
    await deleteFile(id);
    await deleteFile(thumbKey(id));
    throw e;
  }
  return id;
}

// Photos : jamais effacées pour de vrai, seulement masquées (le fichier reste sur le serveur).
export async function hidePhoto(id: string) {
  const now = nowIso();
  await db.execute('UPDATE photos SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

export const OWNER_PHOTOS_SQL = `
  SELECT id, company_id, kind, width, height, storage_path, taken_at, lat, lng, caption FROM photos
  WHERE owner_type = ? AND owner_id = ? AND kind = 'photo' AND deleted_at IS NULL
  ORDER BY taken_at`;

export const PHOTO_SQL = `SELECT id, company_id, owner_id, kind, width, height, storage_path, taken_at, lat, lng, caption FROM photos WHERE id = ?`;
