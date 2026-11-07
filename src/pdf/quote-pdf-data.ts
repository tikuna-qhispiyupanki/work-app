import { COMPANY_SQL, CompanyRow, QUOTE_LINES_SQL, QUOTE_SQL, QuoteLineRow, QuoteRow } from '@/db/quotes';
import { db } from '@/db/database';
import { readFile } from '@/files/local-files';
import { storagePath } from '@/db/photos';
import { fetchRemotePhoto } from '@/sync/uploader';

import { buildQuotePdf, PdfClient, PdfCompany } from './quote-pdf';

// Rassemble les données du devis (copies figées si finalisé) et fabrique le PDF.
export async function quotePdf(quoteId: string): Promise<{ data: ArrayBuffer; fileName: string }> {
  const q = await db.get<QuoteRow>(QUOTE_SQL, [quoteId]);
  const lines = await db.getAll<QuoteLineRow>(QUOTE_LINES_SQL, [quoteId]);
  const company: PdfCompany = q.company_snapshot ? JSON.parse(q.company_snapshot) : ((await db.getOptional<CompanyRow>(COMPANY_SQL, [q.company_id])) ?? {});
  const client: PdfClient = q.client_snapshot
    ? JSON.parse(q.client_snapshot)
    : ((await db.getOptional<PdfClient>('SELECT kind, name, phone, email, address, postal_code, city FROM clients WHERE id = ?', [q.client_id ?? ''])) ?? {});
  let signatureJpeg: Uint8Array | null = null;
  if (q.status === 'signe' && q.signature_photo_id) {
    const blob = (await readFile(q.signature_photo_id)) ?? (await fetchRemotePhoto(storagePath(q.company_id, q.signature_photo_id), q.signature_photo_id));
    if (blob) signatureJpeg = new Uint8Array(await blob.arrayBuffer());
  }
  // Logo : celui figé dans le devis finalisé, sinon le logo actuel de l'entreprise.
  let logo: { jpeg: Uint8Array; width: number; height: number } | null = null;
  const logoId = (company as { logo_photo_id?: string | null }).logo_photo_id;
  if (logoId) {
    const meta = await db.getOptional<{ width: number; height: number }>('SELECT width, height FROM photos WHERE id = ?', [logoId]);
    const blob = (await readFile(logoId)) ?? (await fetchRemotePhoto(storagePath(q.company_id, logoId), logoId));
    if (blob && meta) logo = { jpeg: new Uint8Array(await blob.arrayBuffer()), width: meta.width, height: meta.height };
  }
  const data = buildQuotePdf({ quote: q, lines, company, client, signatureJpeg, logo });
  const who = (client.name ?? 'client').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { data, fileName: `Devis-${q.number ?? 'brouillon'}-${who}.pdf` };
}
