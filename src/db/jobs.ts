import { currentIds } from '@/auth/current';
import type { CompressedImage } from '@/files/image';
import { missingSheetFields, prefillSheet, retainUntil } from '@/domain/intervention';
import type { Transaction } from '@powersync/web';

import { db, newId, nowIso } from './database';
import { addPhoto } from './photos';

export type JobStatus = 'a_planifier' | 'planifie' | 'en_cours' | 'termine' | 'annule';
export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  a_planifier: 'À planifier', planifie: 'Planifié', en_cours: 'En cours', termine: 'Terminé', annule: 'Annulé',
};
export type JobRow = {
  id: string; company_id: string; quote_id: string | null; visit_id: string | null; client_id: string | null; title: string | null;
  site_address: string | null; site_lat: number | null; site_lng: number | null; status: JobStatus; planned_start: string | null;
  planned_end: string | null; near_power_lines: number; dt_dict_done_on: string | null; notes: string | null;
  quote_number?: string | null; client_name?: string | null;
};

export const JOBS_ACTIVE_SQL = `SELECT j.*, q.number AS quote_number, c.name AS client_name FROM jobs j
  LEFT JOIN quotes q ON q.id = j.quote_id LEFT JOIN clients c ON c.id = j.client_id
  WHERE j.deleted_at IS NULL AND j.status NOT IN ('termine', 'annule')
  ORDER BY j.planned_start IS NULL, j.planned_start, j.created_at`;
export const JOB_SQL = `SELECT j.*, q.number AS quote_number, c.name AS client_name FROM jobs j
  LEFT JOIN quotes q ON q.id = j.quote_id LEFT JOIN clients c ON c.id = j.client_id WHERE j.id = ?`;
export const JOB_TEAM_SQL = `SELECT jm.id, jm.member_id, jm.role_on_job, m.name, m.trade FROM job_members jm
  JOIN team_members m ON m.id = jm.member_id WHERE jm.job_id = ? AND jm.deleted_at IS NULL ORDER BY jm.role_on_job = 'chef' DESC, m.name`;
export type JobMemberRow = { id: string; member_id: string; role_on_job: 'chef' | 'equipier' | 'sauveteur'; name: string; trade: string };
export const ROLE_ON_JOB_LABEL = { chef: "Chef d'équipe", equipier: 'Équipier', sauveteur: 'Sauveteur désigné' } as const;

// Chantier du devis signé : même identifiant que le devis (le serveur fait pareil quand le client signe
// par le lien ; il ne crée rien si le chantier existe déjà). À appeler AVANT de passer le devis à « signé ».
export async function createJobForQuote(tx: Transaction, quoteId: string) {
  const { companyId, userId } = currentIds();
  const exists = await tx.getOptional<{ id: string }>('SELECT id FROM jobs WHERE id = ?', [quoteId]);
  if (exists) return;
  const q = await tx.get<{ visit_id: string | null; client_id: string | null; number: string | null; site_address: string | null; client_snapshot: string | null }>(
    'SELECT visit_id, client_id, number, site_address, client_snapshot FROM quotes WHERE id = ?',
    [quoteId]
  );
  const v = q.visit_id
    ? await tx.getOptional<{ site_lat: number | null; site_lng: number | null; near_power_lines: number | null }>('SELECT site_lat, site_lng, near_power_lines FROM visits WHERE id = ?', [q.visit_id])
    : null;
  let name = 'Chantier';
  try {
    name = (JSON.parse(q.client_snapshot ?? '{}') as { name?: string }).name || name;
  } catch {
    // copie illisible : nom par défaut
  }
  const now = nowIso();
  await tx.execute(
    `INSERT INTO jobs (id, company_id, created_at, updated_at, created_by, quote_id, visit_id, client_id, title, site_address, site_lat, site_lng, status, near_power_lines)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'a_planifier', ?)`,
    [quoteId, companyId, now, now, userId, quoteId, q.visit_id, q.client_id, `${name} – ${q.number ?? ''}`, q.site_address, v?.site_lat ?? null, v?.site_lng ?? null, v?.near_power_lines ?? 0]
  );
  const crew = await tx.getAll<{ member_id: string }>('SELECT member_id FROM quote_crew WHERE quote_id = ? AND deleted_at IS NULL', [quoteId]);
  for (const c of crew) {
    await tx.execute(
      `INSERT INTO job_members (id, company_id, created_at, updated_at, created_by, job_id, member_id, role_on_job) VALUES (?, ?, ?, ?, ?, ?, ?, 'equipier')`,
      [newId(), companyId, now, now, userId, quoteId, c.member_id]
    );
  }
}

export async function updateJob(id: string, c: Partial<Pick<JobRow, 'status' | 'planned_start' | 'planned_end' | 'dt_dict_done_on' | 'notes' | 'near_power_lines'>>) {
  const keys = Object.keys(c) as (keyof typeof c)[];
  if (!keys.length) return;
  await db.execute(`UPDATE jobs SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [...keys.map((k) => c[k] ?? null), nowIso(), id]);
}

export async function addJobMember(jobId: string, memberId: string, role: JobMemberRow['role_on_job'] = 'equipier') {
  const { companyId, userId } = currentIds();
  const now = nowIso();
  await db.execute(
    `INSERT INTO job_members (id, company_id, created_at, updated_at, created_by, job_id, member_id, role_on_job) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), companyId, now, now, userId, jobId, memberId, role]
  );
}
export async function setJobMemberRole(id: string, role: JobMemberRow['role_on_job']) {
  await db.execute('UPDATE job_members SET role_on_job = ?, updated_at = ? WHERE id = ?', [role, nowIso(), id]);
}
export async function removeJobMember(id: string) {
  const now = nowIso();
  await db.execute('UPDATE job_members SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

// ---------------------------------------------------------------------------
// Fiche d'intervention

export type SheetRow = {
  id: string; company_id: string; job_id: string; version: number; status: 'brouillon' | 'signee' | 'remplacee'; location: string | null; works: string | null;
  equipment: string | null; start_date: string | null; end_date: string | null; sketch_photo_id: string | null; risks: string | null; prevention: string | null;
  accident_procedure: string | null; rescue: string | null; emergency_contacts: string | null; signer_name: string | null; signed_at: string | null;
  signature_photo_id: string | null; retain_until: string | null; created_at: string;
};
export const JOB_SHEETS_SQL = `SELECT * FROM intervention_sheets WHERE job_id = ? AND deleted_at IS NULL ORDER BY version DESC`;
export const SHEET_SQL = `SELECT * FROM intervention_sheets WHERE id = ?`;
export const SHEET_ACKS_SQL = `SELECT id, member_id, name, acknowledged_at, signature_photo_id FROM intervention_sheet_acks WHERE sheet_id = ? AND deleted_at IS NULL ORDER BY acknowledged_at`;
export type AckRow = { id: string; member_id: string | null; name: string; acknowledged_at: string; signature_photo_id: string | null };

const SHEET_FIELDS = ['location', 'works', 'equipment', 'start_date', 'end_date', 'sketch_photo_id', 'risks', 'prevention', 'accident_procedure', 'rescue', 'emergency_contacts'] as const;
export type SheetField = (typeof SHEET_FIELDS)[number];

// Dernier croquis de la visite (sinon l'image du plan) : proposé comme croquis de la fiche.
async function visitSketch(visitId: string | null): Promise<string | null> {
  if (!visitId) return null;
  const p = await db.getOptional<{ id: string }>(
    `SELECT id FROM photos WHERE owner_type = 'visit' AND owner_id = ? AND kind IN ('croquis', 'plan') AND deleted_at IS NULL
     ORDER BY kind = 'croquis' DESC, taken_at DESC LIMIT 1`,
    [visitId]
  );
  return p?.id ?? null;
}

// Nouvelle fiche, pré-remplie depuis la visite et le devis (ou copie de la dernière version pour la corriger).
export async function createSheet(jobId: string): Promise<string> {
  const { companyId, userId } = currentIds();
  const job = await db.get<JobRow>('SELECT * FROM jobs WHERE id = ?', [jobId]);
  const last = await db.getOptional<SheetRow>(`SELECT * FROM intervention_sheets WHERE job_id = ? AND deleted_at IS NULL ORDER BY version DESC LIMIT 1`, [jobId]);
  if (last?.status === 'brouillon') return last.id;
  const id = newId();
  const now = nowIso();
  let fields: Record<SheetField, string | null>;
  if (last) {
    fields = Object.fromEntries(SHEET_FIELDS.map((f) => [f, last[f]])) as Record<SheetField, string | null>;
  } else {
    const works = job.quote_id
      ? (await db.getAll<{ label: string }>(`SELECT label FROM quote_lines WHERE quote_id = ? AND deleted_at IS NULL AND kind IN ('prestation', 'libre', 'location') ORDER BY position`, [job.quote_id])).map((l) => l.label)
      : [];
    const p = prefillSheet({
      siteAddress: job.site_address,
      lat: job.site_lat,
      lng: job.site_lng,
      works,
      nearPowerLines: !!job.near_power_lines,
      start: job.planned_start,
      end: job.planned_end ?? job.planned_start,
      usesRopes: true,
    });
    fields = { ...p, sketch_photo_id: await visitSketch(job.visit_id) };
  }
  await db.execute(
    `INSERT INTO intervention_sheets (id, company_id, created_at, updated_at, created_by, job_id, version, status, ${SHEET_FIELDS.join(', ')})
     VALUES (?, ?, ?, ?, ?, ?, ?, 'brouillon', ${SHEET_FIELDS.map(() => '?').join(', ')})`,
    [id, companyId, now, now, userId, jobId, (last?.version ?? 0) + 1, ...SHEET_FIELDS.map((f) => fields[f])]
  );
  return id;
}

export async function updateSheet(id: string, field: SheetField, value: string | null) {
  const s = await db.get<{ status: string }>('SELECT status FROM intervention_sheets WHERE id = ?', [id]);
  if (s.status !== 'brouillon') throw new Error('Fiche signée : crée une nouvelle version pour la corriger.');
  await db.execute(`UPDATE intervention_sheets SET ${field} = ?, updated_at = ? WHERE id = ?`, [value, nowIso(), id]);
}

// Signature du chef d'entreprise : la fiche est figée et gardée 2 ans. L'ancienne version signée devient « remplacée ».
export async function signSheet(id: string, signerName: string, image: CompressedImage, position: { lat: number; lng: number } | null) {
  const s = await db.get<SheetRow>(SHEET_SQL, [id]);
  if (s.status !== 'brouillon') throw new Error('Cette fiche est déjà signée.');
  const missing = missingSheetFields(s);
  if (missing.length) throw new Error(`À compléter avant de signer : ${missing.join(', ')}.`);
  if (!signerName.trim()) throw new Error('Indique le nom du chef d’entreprise qui signe.');
  const photoId = await addPhoto({ ownerType: 'sheet', ownerId: id, kind: 'signature', image, lat: position?.lat, lng: position?.lng });
  const now = new Date();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE intervention_sheets SET status = 'remplacee', updated_at = ? WHERE job_id = ? AND status = 'signee' AND id <> ?`,
      [now.toISOString(), s.job_id, id]
    );
    await tx.execute(
      `UPDATE intervention_sheets SET status = 'signee', signer_name = ?, signed_at = ?, signature_photo_id = ?, retain_until = ?, updated_at = ? WHERE id = ?`,
      [signerName.trim(), now.toISOString(), photoId, retainUntil(now), now.toISOString(), id]
    );
  });
}

// Un intervenant atteste qu'on lui a présenté la fiche (signature au doigt). Uniquement ajouté.
export async function acknowledgeSheet(sheetId: string, member: { id: string | null; name: string }, image: CompressedImage) {
  const s = await db.get<{ status: string }>('SELECT status FROM intervention_sheets WHERE id = ?', [sheetId]);
  if (s.status !== 'signee') throw new Error('La fiche doit d’abord être signée par le chef d’entreprise.');
  if (!member.name.trim()) throw new Error('Indique le nom de l’intervenant.');
  const { companyId, userId } = currentIds();
  const photoId = await addPhoto({ ownerType: 'sheet', ownerId: sheetId, kind: 'signature', image });
  const now = nowIso();
  await db.execute(
    `INSERT INTO intervention_sheet_acks (id, company_id, created_at, updated_at, created_by, sheet_id, member_id, name, acknowledged_at, signature_photo_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), companyId, now, now, userId, sheetId, member.id, member.name.trim(), now, photoId]
  );
}
