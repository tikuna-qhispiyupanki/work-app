import { db } from '@/db/database';
import { storagePath } from '@/db/photos';
import { REPORT_PHOTOS_SQL, REPORT_SQL, ReportPhotoRow, ReportRow } from '@/db/reports';
import { readFile } from '@/files/local-files';
import { fetchRemotePhoto } from '@/sync/uploader';

import { buildReportPdf } from './report-pdf';

async function bytes(companyId: string, id: string | null) {
  if (!id) return null;
  const blob = (await readFile(id)) ?? (await fetchRemotePhoto(storagePath(companyId, id), id));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

// Rapport de fin de chantier en PDF (sur le téléphone, sans réseau si les photos y sont).
export async function reportPdf(jobId: string): Promise<{ data: ArrayBuffer; fileName: string }> {
  const r = await db.get<ReportRow>(REPORT_SQL, [jobId]);
  const job = await db.get<{ title: string | null; site_address: string | null; quote_id: string | null; client_id: string | null; company_id: string }>('SELECT title, site_address, quote_id, client_id, company_id FROM jobs WHERE id = ?', [jobId]);
  const q = job.quote_id ? await db.getOptional<{ number: string | null; client_snapshot: string | null }>('SELECT number, client_snapshot FROM quotes WHERE id = ?', [job.quote_id]) : null;
  const company = (await db.getOptional<{ name: string; address: string; postal_code: string; city: string; phone: string; email: string; siret: string; logo_photo_id: string | null }>('SELECT * FROM companies WHERE id = ?', [job.company_id])) ?? null;
  let client: { name?: string } = {};
  try {
    client = q?.client_snapshot ? JSON.parse(q.client_snapshot) : ((await db.getOptional<{ name: string }>('SELECT name FROM clients WHERE id = ?', [job.client_id ?? ''])) ?? {});
  } catch {
    client = {};
  }
  const rows = await db.getAll<ReportPhotoRow>(REPORT_PHOTOS_SQL, [jobId]);
  const photos = [];
  for (const p of rows) {
    const b = await bytes(p.company_id, p.id);
    if (b) photos.push({ jpeg: b, width: p.width, height: p.height, stage: p.stage, caption: p.caption, taken_at: p.taken_at });
  }
  let logo = null;
  if (company?.logo_photo_id) {
    const meta = await db.getOptional<{ width: number; height: number }>('SELECT width, height FROM photos WHERE id = ?', [company.logo_photo_id]);
    const b = await bytes(job.company_id, company.logo_photo_id);
    if (b && meta) logo = { jpeg: b, width: meta.width, height: meta.height };
  }
  const data = buildReportPdf({
    company: company ?? {},
    client,
    jobTitle: job.title ?? 'Chantier',
    siteAddress: job.site_address,
    quoteNumber: q?.number ?? null,
    report: r,
    photos,
    signatureJpeg: await bytes(job.company_id, r.client_signature_photo_id),
    logo,
  });
  const who = (client.name ?? 'client').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { data, fileName: `Rapport-chantier-${who}.pdf` };
}
