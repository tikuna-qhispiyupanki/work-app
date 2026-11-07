import { currentIds } from '@/auth/current';
import type { CompressedImage } from '@/files/image';

import { db, newId, nowIso } from './database';
import { addPhoto } from './photos';

export type FindingRow = {
  id: string; company_id: string; job_id: string; found_at: string; network_type: string; description: string | null; damage: string | null;
  actions_taken: string | null; operator_contacted: string | null; reporter_name: string | null; lat: number | null; lng: number | null;
};
export const FINDINGS_SQL = `SELECT * FROM network_findings WHERE job_id = ? AND deleted_at IS NULL ORDER BY found_at DESC`;
export const FINDING_PHOTOS_SQL = `SELECT id, company_id, width, height, storage_path FROM photos WHERE owner_type = 'finding' AND owner_id = ? AND deleted_at IS NULL ORDER BY taken_at`;

// Constat de découverte fortuite (sans réseau) ; photos rattachées au constat.
export async function addFinding(
  jobId: string,
  f: { network_type: string; description: string; damage: string | null; actions_taken: string; operator_contacted: string; reporter_name: string },
  pos: { lat: number; lng: number } | null,
  images: CompressedImage[]
): Promise<string> {
  const { companyId, userId } = currentIds();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO network_findings (id, company_id, created_at, updated_at, created_by, job_id, found_at, network_type, description, damage, actions_taken, operator_contacted, reporter_name, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, companyId, now, now, userId, jobId, now, f.network_type, f.description.trim() || null, f.damage, f.actions_taken.trim() || null, f.operator_contacted.trim() || null, f.reporter_name.trim() || null, pos?.lat ?? null, pos?.lng ?? null]
  );
  for (const image of images) await addPhoto({ ownerType: 'finding', ownerId: id, kind: 'photo', image, lat: pos?.lat, lng: pos?.lng });
  return id;
}

// Récépissés de DT-DICT (photos ou scans) joints au chantier.
export const JOB_DOCS_SQL = `SELECT id, company_id, width, height, storage_path, caption, taken_at FROM photos WHERE owner_type = 'job' AND owner_id = ? AND kind = 'document' AND deleted_at IS NULL ORDER BY taken_at`;
export async function addJobDocument(jobId: string, image: CompressedImage, caption: string) {
  return addPhoto({ ownerType: 'job', ownerId: jobId, kind: 'document', image, caption });
}
