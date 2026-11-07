// PDF de la fiche d'intervention (A4), fabriqué sur le téléphone : fonctionne sans réseau.
// Sections dans l'ordre du décret 2021-1833 (1° à 6°), puis signature du chef d'entreprise et attestations.
import { jsPDF } from 'jspdf';

import { EQUIPMENT, parseJson, RISKS, RESPONSIBILITY } from '@/domain/intervention';
import type { EquipmentValue, RisksValue } from '@/domain/intervention';

import { pdfText } from './quote-pdf';

export type SheetPdfInput = {
  company: { name?: string | null; address?: string | null; postal_code?: string | null; city?: string | null; phone?: string | null; siret?: string | null };
  sheet: {
    version: number; status: string; location: string | null; works: string | null; equipment: string | null; start_date: string | null; end_date: string | null;
    risks: string | null; prevention: string | null; accident_procedure: string | null; rescue: string | null; emergency_contacts: string | null;
    signer_name: string | null; signed_at: string | null; retain_until: string | null;
  };
  jobTitle: string;
  team: { name: string; role: string }[];
  sketch?: { jpeg: Uint8Array; width: number; height: number } | null;
  signatureJpeg?: Uint8Array | null;
  acks: { name: string; acknowledged_at: string; signatureJpeg?: Uint8Array | null }[];
  logo?: { jpeg: Uint8Array; width: number; height: number } | null; // logo de l'entreprise
};

const GREEN: [number, number, number] = [14, 84, 80];
const GREY: [number, number, number] = [94, 98, 90];
const frDate = (iso: string | null) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const frDateTime = (iso: string) => {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function buildSheetPdf(input: SheetPdfInput): ArrayBuffer {
  const { sheet: s, company: c } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Fiche d'intervention - ${input.jobTitle}`, creator: 'Arboject' });
  const L = 15;
  const R = 195;
  let y = 16;
  const text = (t: string, x: number, yy: number, o?: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' }) => {
    doc.setFont('helvetica', o?.bold ? 'bold' : 'normal');
    doc.setFontSize(o?.size ?? 10);
    doc.setTextColor(...(o?.color ?? [28, 28, 26]));
    doc.text(pdfText(t), x, yy, { align: o?.align ?? 'left' });
  };
  const ensure = (h: number) => {
    if (y + h > 282) {
      doc.addPage();
      y = 16;
    }
  };
  const para = (t: string, size = 9.5, color?: [number, number, number]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    for (const raw of pdfText(t).split('\n')) {
      const rows = doc.splitTextToSize(raw || ' ', R - L - 4) as string[];
      for (const r of rows) {
        ensure(5);
        text(r, L + 2, y, { size, color });
        y += size * 0.45;
      }
    }
  };
  const section = (title: string) => {
    ensure(14);
    y += 3;
    doc.setFillColor(...GREEN);
    doc.rect(L, y - 4.5, R - L, 6.5, 'F');
    text(title, L + 2, y, { size: 10, bold: true, color: [255, 255, 255] });
    y += 6;
  };

  // En-tête (logo en haut à gauche, comme sur le devis)
  if (input.logo) {
    const ratio = input.logo.width / input.logo.height;
    const h = Math.min(18, 40 / ratio);
    doc.addImage(input.logo.jpeg, 'JPEG', L, 8, h * ratio, h);
    y = 8 + h + 6;
  }
  text("FICHE D'INTERVENTION", L, y, { size: 16, bold: true, color: GREEN });
  text(`Version ${s.version}${s.status === 'brouillon' ? ' - BROUILLON (non signée)' : ''}`, R, y, { size: 10, bold: true, align: 'right', color: s.status === 'brouillon' ? [178, 34, 34] : GREEN });
  y += 5.5;
  text("Travaux d'élagage et d'abattage - décret n° 2021-1833 (Code rural et de la pêche maritime)", L, y, { size: 8.5, color: GREY });
  y += 6;
  text(c.name ?? '', L, y, { size: 11, bold: true });
  text(input.jobTitle, R, y, { size: 10, align: 'right' });
  y += 4.6;
  text([c.address, [c.postal_code, c.city].filter(Boolean).join(' '), c.phone ? `Tél. ${c.phone}` : null, c.siret ? `SIRET ${c.siret}` : null].filter(Boolean).join(' - '), L, y, { size: 8.5, color: GREY });
  y += 3;

  section('1. Emplacement, travaux, équipements, dates');
  text('Emplacement :', L + 2, y, { size: 9.5, bold: true });
  y += 4.5;
  para(s.location || '-');
  text('Travaux :', L + 2, y + 1, { size: 9.5, bold: true });
  y += 5.5;
  para(s.works || '-');
  const eq = parseJson<EquipmentValue>(s.equipment, { checked: [], other: '' });
  text('Équipements :', L + 2, y + 1, { size: 9.5, bold: true });
  y += 5.5;
  para([...EQUIPMENT.filter((e) => eq.checked.includes(e)), ...eq.checked.filter((e) => !EQUIPMENT.includes(e)), eq.other].filter(Boolean).join(', ') || '-');
  ensure(6);
  text(`Début : ${frDate(s.start_date) || '-'}      Fin : ${frDate(s.end_date) || '-'}`, L + 2, y + 1, { size: 9.5, bold: true });
  y += 6;
  if (input.team.length) para(`Intervenants : ${input.team.map((t) => `${t.name}${t.role ? ` (${t.role})` : ''}`).join(', ')}`);

  section('2. Croquis (accès, circulation, végétaux à traiter)');
  if (input.sketch) {
    const ratio = input.sketch.width / input.sketch.height;
    const w = Math.min(R - L - 4, 110 * ratio);
    const h = w / ratio;
    ensure(h + 4);
    doc.addImage(input.sketch.jpeg, 'JPEG', L + 2, y - 2, w, h);
    y += h + 2;
  } else {
    para('Croquis à joindre (aucun croquis enregistré).', 9.5, [178, 34, 34]);
  }

  section('3. Risques propres au chantier et à son environnement');
  const rk = parseJson<RisksValue>(s.risks, { checked: [], other: '' });
  para([...RISKS.filter((r) => rk.checked.includes(r.key)).map((r) => `• ${r.label}`), rk.other ? `• ${rk.other}` : ''].filter(Boolean).join('\n') || '-');

  section('4. Mesures de prévention');
  para(s.prevention || '-');
  section("5. Conduite à tenir en cas d'accident");
  para(s.accident_procedure || '-');
  section('6. Organisation des secours');
  para(s.rescue || '-');
  if (s.emergency_contacts) {
    y += 1;
    para(s.emergency_contacts, 9.5, GREEN);
  }

  // Signature du chef d'entreprise
  section("Établie, datée et signée par le chef d'entreprise");
  ensure(34);
  if (s.signed_at) {
    text(`Signée le ${frDateTime(s.signed_at)} par ${s.signer_name ?? ''}`, L + 2, y, { size: 9.5 });
    if (input.signatureJpeg) doc.addImage(input.signatureJpeg, 'JPEG', L + 2, y + 2, 60, 24);
    if (s.retain_until) text(`À conserver jusqu'au ${frDate(s.retain_until)} (2 ans)`, R, y, { size: 8.5, color: GREY, align: 'right' });
    y += 28;
  } else {
    text('Non signée.', L + 2, y, { size: 9.5, color: [178, 34, 34] });
    y += 6;
  }

  // Attestations des intervenants
  section('Présentée aux intervenants avant le début des travaux');
  if (!input.acks.length) para('Aucune attestation pour le moment.', 9.5, GREY);
  for (const a of input.acks) {
    ensure(22);
    text(`${a.name} - ${frDateTime(a.acknowledged_at)}`, L + 2, y, { size: 9.5 });
    if (a.signatureJpeg) doc.addImage(a.signatureJpeg, 'JPEG', 120, y - 4, 45, 18);
    y += 19;
  }

  y += 2;
  para(RESPONSIBILITY, 8, GREY);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    text(`Fiche d'intervention - ${input.jobTitle} - v${s.version} - page ${i}/${pages}`, 105, 291, { size: 7.5, color: GREY, align: 'center' });
  }
  return doc.output('arraybuffer');
}
