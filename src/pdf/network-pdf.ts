// PDF : constat de découverte fortuite d'un réseau, et demande d'arrêté de circulation à la mairie.
import { jsPDF } from 'jspdf';

import { FINDING_STEPS, NETWORK_TYPES, roadPermitLetter } from '@/domain/networks';
import type { RoadPermit } from '@/domain/networks';

import { pdfText } from './quote-pdf';

type Company = { name?: string | null; address?: string | null; postal_code?: string | null; city?: string | null; phone?: string | null; email?: string | null; siret?: string | null };
const GREEN: [number, number, number] = [14, 84, 80];
const GREY: [number, number, number] = [94, 98, 90];

function page(title: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title, creator: 'Arboject' });
  let y = 18;
  const L = 15;
  const W = 180;
  const text = (t: string, x: number, yy: number, o?: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' }) => {
    doc.setFont('helvetica', o?.bold ? 'bold' : 'normal');
    doc.setFontSize(o?.size ?? 10);
    doc.setTextColor(...(o?.color ?? [28, 28, 26]));
    doc.text(pdfText(t), x, yy, { align: o?.align ?? 'left' });
  };
  const para = (t: string, size = 10, gap = 1.5) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    for (const raw of pdfText(t).split('\n')) {
      for (const ln of doc.splitTextToSize(raw || ' ', W - 4) as string[]) {
        if (y > 280) {
          doc.addPage();
          y = 18;
        }
        text(ln, L + 2, y, { size });
        y += size * 0.45;
      }
    }
    y += gap;
  };
  const header = (c: Company) => {
    text(c.name ?? '', L, y, { size: 12, bold: true, color: GREEN });
    y += 5;
    text([c.address, [c.postal_code, c.city].filter(Boolean).join(' '), c.phone ? `Tél. ${c.phone}` : null, c.email, c.siret ? `SIRET ${c.siret}` : null].filter(Boolean).join(' - '), L, y, { size: 8.5, color: GREY });
    y += 10;
  };
  return { doc, text, para, header, get y() { return y; }, set y(v: number) { y = v; }, L, W };
}

export function buildFindingPdf(o: {
  company: Company; jobTitle: string; siteAddress: string | null;
  finding: { found_at: string; network_type: string; description: string | null; damage: string | null; actions_taken: string | null; operator_contacted: string | null; reporter_name: string | null; lat: number | null; lng: number | null };
  photos: { jpeg: Uint8Array; width: number; height: number }[];
}): ArrayBuffer {
  const p = page('Constat de découverte fortuite de réseau');
  const f = o.finding;
  p.header(o.company);
  p.text("CONSTAT DE DÉCOUVERTE FORTUITE D'UN RÉSEAU", p.L, p.y, { size: 14, bold: true, color: GREEN });
  p.y += 9;
  const d = new Date(f.found_at.includes('T') ? f.found_at : f.found_at.replace(' ', 'T'));
  const rows: [string, string][] = [
    ['Chantier', o.jobTitle],
    ['Adresse', o.siteAddress ?? ''],
    ['Date et heure', `${d.toLocaleDateString('fr-FR')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`],
    ['Position GPS', f.lat != null && f.lng != null ? `${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}` : 'non relevée'],
    ['Type de réseau', NETWORK_TYPES.find((t) => t.key === f.network_type)?.label ?? f.network_type],
    ['Dommage', f.damage === 'aucun' ? 'Aucun' : f.damage === 'leger' ? 'Léger' : f.damage === 'important' ? 'Important' : 'Non précisé'],
    ['Exploitant prévenu', f.operator_contacted || 'non précisé'],
    ['Constat établi par', f.reporter_name || ''],
  ];
  for (const [k, v] of rows) {
    p.text(k, p.L + 2, p.y, { size: 10, bold: true });
    p.para(v, 10, 0);
    p.y += 0.5;
  }
  p.y += 2;
  p.text('Description', p.L + 2, p.y, { size: 10.5, bold: true, color: GREEN });
  p.y += 5;
  p.para(f.description || '-');
  p.text('Mesures prises', p.L + 2, p.y, { size: 10.5, bold: true, color: GREEN });
  p.y += 5;
  p.para(f.actions_taken || '-');
  for (const ph of o.photos) {
    const w = 120;
    const h = w / (ph.width / ph.height);
    if (p.y + h > 280) {
      p.doc.addPage();
      p.y = 18;
    }
    p.doc.addImage(ph.jpeg, 'JPEG', p.L + 2, p.y, w, h);
    p.y += h + 4;
  }
  p.text('Rappel des consignes', p.L + 2, p.y + 2, { size: 9.5, bold: true, color: GREY });
  p.y += 7;
  p.para(FINDING_STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n'), 8.5);
  return p.doc.output('arraybuffer');
}

export function buildRoadPermitPdf(o: { company: Company; permit: RoadPermit; works: string; today?: Date }): ArrayBuffer {
  const p = page("Demande d'arrêté de circulation");
  p.header(o.company);
  p.text(o.permit.mairie || 'Mairie', 125, p.y, { size: 10.5, bold: true });
  p.y += 5;
  p.text('Service de la voirie / police municipale', 125, p.y, { size: 9.5 });
  p.y += 10;
  const today = o.today ?? new Date();
  p.text(`Le ${today.toLocaleDateString('fr-FR')}`, 125, p.y, { size: 10 });
  p.y += 10;
  p.text("Objet : demande d'arrêté temporaire de circulation et de stationnement", p.L + 2, p.y, { size: 10.5, bold: true });
  p.y += 9;
  for (const para of roadPermitLetter(o.permit, { company: o.company.name ?? '', works: o.works })) p.para(para, 10.5, 3);
  p.y += 8;
  p.text(o.company.name ?? '', 125, p.y, { size: 10.5, bold: true });
  p.y += 5;
  p.text('Signature :', 125, p.y, { size: 9.5, color: GREY });
  return p.doc.output('arraybuffer');
}
