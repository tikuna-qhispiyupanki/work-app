import { db } from '@/db/database';
import { AckRow, JOB_TEAM_SQL, JobMemberRow, ROLE_ON_JOB_LABEL, SHEET_ACKS_SQL, SHEET_SQL, SheetRow } from '@/db/jobs';
import { storagePath } from '@/db/photos';
import { readFile } from '@/files/local-files';
import { fetchRemotePhoto } from '@/sync/uploader';

import { buildSheetPdf } from './sheet-pdf';

// Image d'une photo : sur le téléphone si elle y est, sinon téléchargée du serveur.
async function photoBytes(companyId: string, id: string | null): Promise<{ jpeg: Uint8Array; width: number; height: number } | null> {
  if (!id) return null;
  const meta = await db.getOptional<{ width: number; height: number }>('SELECT width, height FROM photos WHERE id = ?', [id]);
  const blob = (await readFile(id)) ?? (await fetchRemotePhoto(storagePath(companyId, id), id));
  if (!blob || !meta) return null;
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: meta.width, height: meta.height };
}

// Rassemble la fiche, l'équipe, le croquis et les signatures, et fabrique le PDF (sans réseau si tout est sur le téléphone).
export async function sheetPdf(sheetId: string): Promise<{ data: ArrayBuffer; fileName: string }> {
  const s = await db.get<SheetRow>(SHEET_SQL, [sheetId]);
  const job = await db.get<{ title: string | null }>('SELECT title FROM jobs WHERE id = ?', [s.job_id]);
  const company = (await db.getOptional<{ name: string; address: string; postal_code: string; city: string; phone: string; siret: string }>('SELECT * FROM companies WHERE id = ?', [s.company_id])) ?? {};
  const team = await db.getAll<JobMemberRow>(JOB_TEAM_SQL, [s.job_id]);
  const acks = await db.getAll<AckRow>(SHEET_ACKS_SQL, [sheetId]);
  const data = buildSheetPdf({
    company,
    sheet: s,
    jobTitle: job.title ?? 'Chantier',
    team: team.map((t) => ({ name: t.name, role: ROLE_ON_JOB_LABEL[t.role_on_job] })),
    sketch: await photoBytes(s.company_id, s.sketch_photo_id),
    signatureJpeg: (await photoBytes(s.company_id, s.signature_photo_id))?.jpeg ?? null,
    acks: await Promise.all(acks.map(async (a) => ({ name: a.name, acknowledged_at: a.acknowledged_at, signatureJpeg: (await photoBytes(s.company_id, a.signature_photo_id))?.jpeg ?? null }))),
  });
  const who = (job.title ?? 'chantier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { data, fileName: `Fiche-intervention-${who}-v${s.version}.pdf` };
}
