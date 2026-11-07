import { currentIds } from '@/auth/current';
import { supabase } from '@/auth/supabase';
import { BASE_PATH } from '@/config/base-path';
import type { CompressedImage } from '@/files/image';
import { DEFAULT_ADVICE, orderPhotos, worksFromQuote } from '@/domain/report';

import { db, newId, nowIso } from './database';
import { addPhoto, storagePath } from './photos';

// ---------------------------------------------------------------- Fil du chantier

export type FeedItem = { kind: 'note' | 'photo'; id: string; at: string; body: string | null; author: string | null; stage: string | null; include_in_report: number | null; storage_path: string | null; width: number | null; height: number | null; company_id: string };

export const FEED_SQL = `SELECT 'note' AS kind, id, created_at AS at, body, author_name AS author, NULL AS stage, NULL AS include_in_report, NULL AS storage_path, NULL AS width, NULL AS height, company_id
  FROM job_notes WHERE job_id = ?1 AND deleted_at IS NULL
  UNION ALL
  SELECT 'photo', id, taken_at, caption, NULL, stage, include_in_report, storage_path, width, height, company_id
  FROM photos WHERE owner_type = 'job' AND owner_id = ?1 AND kind = 'photo' AND deleted_at IS NULL
  ORDER BY at DESC`;

export async function addJobNote(jobId: string, body: string, author: string | null) {
  if (!body.trim()) return;
  const { companyId, userId } = currentIds();
  const now = nowIso();
  await db.execute(
    `INSERT INTO job_notes (id, company_id, created_at, updated_at, created_by, job_id, author_name, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), companyId, now, now, userId, jobId, author, body.trim()]
  );
}

export async function addJobPhoto(jobId: string, image: CompressedImage, stage: 'avant' | 'pendant' | 'apres', pos: { lat: number; lng: number } | null) {
  return addPhoto({ ownerType: 'job', ownerId: jobId, kind: 'photo', image, stage, lat: pos?.lat, lng: pos?.lng });
}

export async function setPhotoInReport(photoId: string, on: boolean) {
  await db.execute('UPDATE photos SET include_in_report = ?, updated_at = ? WHERE id = ?', [on ? 1 : 0, nowIso(), photoId]);
}

// ---------------------------------------------------------------- Rapport

export type ReportRow = {
  id: string; company_id: string; job_id: string; status: 'brouillon' | 'signe'; works_done: string | null; remarks: string | null; advice: string | null;
  finished_on: string | null; client_signer_name: string | null; client_signed_at: string | null; client_signature_photo_id: string | null; client_reserves: string | null;
};
export const REPORT_SQL = `SELECT * FROM job_reports WHERE job_id = ? AND deleted_at IS NULL`;
export type ReportField = 'works_done' | 'remarks' | 'advice' | 'finished_on';

// Rapport du chantier (même identifiant que le chantier), pré-rempli avec les travaux du devis.
export async function ensureReport(jobId: string): Promise<string> {
  const existing = await db.getOptional<{ id: string }>(REPORT_SQL, [jobId]);
  if (existing) return existing.id;
  const { companyId, userId } = currentIds();
  const job = await db.get<{ quote_id: string | null; planned_end: string | null }>('SELECT quote_id, planned_end FROM jobs WHERE id = ?', [jobId]);
  const lines = job.quote_id
    ? await db.getAll<{ label: string; kind: string; quantity: number; unit: string | null }>(
        'SELECT label, kind, quantity, unit FROM quote_lines WHERE quote_id = ? AND deleted_at IS NULL ORDER BY position',
        [job.quote_id]
      )
    : [];
  const now = nowIso();
  await db.execute(
    `INSERT INTO job_reports (id, company_id, created_at, updated_at, created_by, job_id, status, works_done, advice, finished_on)
     VALUES (?, ?, ?, ?, ?, ?, 'brouillon', ?, ?, ?)`,
    [jobId, companyId, now, now, userId, jobId, worksFromQuote(lines), DEFAULT_ADVICE, new Date().toISOString().slice(0, 10)]
  );
  return jobId;
}

export async function updateReport(id: string, field: ReportField, value: string | null) {
  const r = await db.get<{ status: string }>('SELECT status FROM job_reports WHERE id = ?', [id]);
  if (r.status !== 'brouillon') throw new Error('Rapport déjà réceptionné par le client : il ne change plus.');
  await db.execute(`UPDATE job_reports SET ${field} = ?, updated_at = ? WHERE id = ?`, [value, nowIso(), id]);
}

// Réception des travaux : signée par le client sur le téléphone (sans réseau). Le chantier passe à « terminé ».
export async function signReport(id: string, signerName: string, reserves: string, image: CompressedImage, pos: { lat: number; lng: number } | null) {
  if (!signerName.trim()) throw new Error('Indique le nom du client qui réceptionne.');
  const r = await db.get<{ status: string; job_id: string }>('SELECT status, job_id FROM job_reports WHERE id = ?', [id]);
  if (r.status !== 'brouillon') throw new Error('Rapport déjà réceptionné.');
  const photoId = await addPhoto({ ownerType: 'job', ownerId: r.job_id, kind: 'signature', image, lat: pos?.lat, lng: pos?.lng });
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE job_reports SET status = 'signe', client_signer_name = ?, client_signed_at = ?, client_signature_photo_id = ?, client_reserves = ?, updated_at = ? WHERE id = ?`,
      [signerName.trim(), now, photoId, reserves.trim() || null, now, id]
    );
    await tx.execute(`UPDATE jobs SET status = 'termine', updated_at = ? WHERE id = ? AND status <> 'annule'`, [now, r.job_id]);
  });
}

// Photos retenues pour le rapport (avant → pendant → après).
export const REPORT_PHOTOS_SQL = `SELECT id, company_id, width, height, stage, caption, storage_path, taken_at FROM photos
  WHERE owner_type = 'job' AND owner_id = ? AND kind = 'photo' AND deleted_at IS NULL AND include_in_report = 1 ORDER BY taken_at`;
export type ReportPhotoRow = { id: string; company_id: string; width: number; height: number; stage: string | null; caption: string | null; storage_path: string | null; taken_at: string };

// ---------------------------------------------------------------- Lien privé du client

export type ReportLinkRow = { id: string; token: string; expires_at: string; opened_at: string | null; created_at: string };
export const REPORT_LINKS_SQL = `SELECT id, token, expires_at, opened_at, created_at FROM report_links WHERE job_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`;
export const LINK_DAYS = 30;

export const reportLink = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}${BASE_PATH}/rapport/${token}`;

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Crée le lien du client : il faut du réseau (les photos doivent être sur le serveur, on fabrique leurs liens signés).
export async function createReportLink(jobId: string): Promise<ReportLinkRow> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Pas de réseau : le lien du client a besoin d’Internet (les photos doivent être envoyées). Réessaie avec du réseau.');
  const { companyId, userId } = currentIds();
  const photos = orderPhotos(await db.getAll<ReportPhotoRow>(REPORT_PHOTOS_SQL, [jobId]));
  const waiting = photos.filter((p) => !p.storage_path).length;
  if (waiting) throw new Error(`${waiting} photo(s) pas encore envoyée(s) au serveur : attends que la pastille indique « Envoyé », puis réessaie.`);
  const list: { url: string; stage: string | null; caption: string | null; width: number; height: number }[] = [];
  for (const p of photos) {
    const { data, error } = await supabase.storage.from('photos').createSignedUrl(storagePath(p.company_id, p.id), LINK_DAYS * 86400);
    if (error || !data) throw new Error(`Lien de photo impossible : ${error?.message ?? 'inconnu'}`);
    list.push({ url: data.signedUrl, stage: p.stage, caption: p.caption, width: p.width, height: p.height });
  }
  const row = { id: newId(), token: newToken(), expires_at: new Date(Date.now() + LINK_DAYS * 86400000).toISOString(), created_at: nowIso(), opened_at: null };
  await db.execute(
    `INSERT INTO report_links (id, company_id, created_at, updated_at, created_by, job_id, token, expires_at, photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, companyId, row.created_at, row.created_at, userId, jobId, row.token, row.expires_at, JSON.stringify(list)]
  );
  return row;
}
