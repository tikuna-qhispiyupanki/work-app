// PDF du rapport de fin de chantier, fabriqué sur le téléphone (ou sur la page du client) : sans réseau si les photos sont là.
import { jsPDF } from 'jspdf';

import { orderPhotos, STAGE_LABEL } from '@/domain/report';

import { pdfText } from './quote-pdf';

export type ReportPdfInput = {
  company: { name?: string | null; address?: string | null; postal_code?: string | null; city?: string | null; phone?: string | null; email?: string | null; siret?: string | null };
  client: { name?: string | null; address?: string | null; postal_code?: string | null; city?: string | null };
  jobTitle: string;
  siteAddress: string | null;
  quoteNumber: string | null;
  report: { works_done: string | null; remarks: string | null; advice: string | null; finished_on: string | null; client_signer_name: string | null; client_signed_at: string | null; client_reserves: string | null };
  photos: { jpeg: Uint8Array; width: number; height: number; stage: string | null; caption: string | null; taken_at?: string }[];
  signatureJpeg?: Uint8Array | null;
  logo?: { jpeg: Uint8Array; width: number; height: number } | null;
};

const GREEN: [number, number, number] = [14, 84, 80];
const GREY: [number, number, number] = [94, 98, 90];
const frDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export function buildReportPdf(input: ReportPdfInput): ArrayBuffer {
  const { company: c, report: r } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Rapport de chantier - ${input.jobTitle}`, creator: 'Arboject' });
  const L = 15;
  const R = 195;
  const W = R - L;
  let y = 18;
  const text = (t: string, x: number, yy: number, o?: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' }) => {
    doc.setFont('helvetica', o?.bold ? 'bold' : 'normal');
    doc.setFontSize(o?.size ?? 10);
    doc.setTextColor(...(o?.color ?? [28, 28, 26]));
    doc.text(pdfText(t), x, yy, { align: o?.align ?? 'left' });
  };
  const ensure = (h: number) => {
    if (y + h > 282) {
      doc.addPage();
      y = 18;
    }
  };
  const para = (t: string, size = 10) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    for (const raw of pdfText(t).split('\n')) {
      for (const ln of doc.splitTextToSize(raw || ' ', W - 4) as string[]) {
        ensure(5);
        text(ln, L + 2, y, { size });
        y += size * 0.45;
      }
    }
  };
  const section = (title: string) => {
    ensure(14);
    y += 3;
    doc.setFillColor(...GREEN);
    doc.rect(L, y - 4.5, W, 6.5, 'F');
    text(title, L + 2, y, { size: 10.5, bold: true, color: [255, 255, 255] });
    y += 6.5;
  };

  if (input.logo) {
    const ratio = input.logo.width / input.logo.height;
    const h = Math.min(18, 42 / ratio);
    doc.addImage(input.logo.jpeg, 'JPEG', L, 10, h * ratio, h);
    y = 10 + h + 6;
  }
  text('RAPPORT DE FIN DE CHANTIER', L, y, { size: 16, bold: true, color: GREEN });
  y += 6;
  text([c.name, c.address, [c.postal_code, c.city].filter(Boolean).join(' '), c.phone ? `Tél. ${c.phone}` : null, c.siret ? `SIRET ${c.siret}` : null].filter(Boolean).join(' - '), L, y, { size: 8.5, color: GREY });
  y += 8;
  const rows: [string, string | null | undefined][] = [
    ['Client', input.client.name],
    ['Chantier', input.siteAddress],
    ['Devis', input.quoteNumber],
    ['Travaux terminés le', frDate(r.finished_on) || null],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    text(k, L + 2, y, { size: 9.5, bold: true });
    text(v, L + 45, y, { size: 9.5 });
    y += 5;
  }

  section('Travaux réalisés');
  para(r.works_done || '-');
  if (r.remarks) {
    section('Remarques');
    para(r.remarks);
  }

  const photos = orderPhotos(input.photos);
  if (photos.length) {
    section(`Photos (${photos.length})`);
    const colW = (W - 6) / 2;
    let col = 0;
    let rowH = 0;
    for (const p of photos) {
      const h = Math.min(70, colW / (p.width / p.height));
      const w = h * (p.width / p.height);
      if (col === 0) {
        ensure(h + 10);
        rowH = 0;
      }
      const x = L + 2 + col * (colW + 2);
      doc.addImage(p.jpeg, 'JPEG', x, y, w, h);
      const label = [p.stage ? STAGE_LABEL[p.stage] ?? p.stage : null, p.caption].filter(Boolean).join(' - ');
      if (label) text(label, x, y + h + 4, { size: 8.5, bold: !!p.stage, color: GREY });
      rowH = Math.max(rowH, h + 8);
      col = (col + 1) % 2;
      if (col === 0) y += rowH;
    }
    if (col === 1) y += rowH;
  }

  if (r.advice) {
    section("Conseils d'entretien");
    para(r.advice, 9.5);
  }

  section('Réception des travaux');
  ensure(36);
  if (r.client_signed_at) {
    text(`Travaux réceptionnés le ${frDate(r.client_signed_at)} par ${r.client_signer_name ?? ''}`, L + 2, y, { size: 10 });
    y += 5;
    if (r.client_reserves) {
      para(`Réserves du client : ${r.client_reserves}`, 9.5);
    } else {
      text('Sans réserve.', L + 2, y, { size: 9.5, color: GREY });
      y += 4;
    }
    if (input.signatureJpeg) doc.addImage(input.signatureJpeg, 'JPEG', L + 2, y, 60, 24);
    y += 26;
  } else {
    text('Réception à signer par le client.', L + 2, y, { size: 9.5, color: GREY });
    y += 6;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    text(`Rapport de chantier - ${input.jobTitle} - page ${i}/${pages}`, 105, 290, { size: 7.5, color: GREY, align: 'center' });
  }
  return doc.output('arraybuffer');
}
