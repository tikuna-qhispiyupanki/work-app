// PDF de la fiche d'intervention (A4), fabriqué sur le téléphone : fonctionne sans réseau.
// Mise en page reprise du modèle de la notice MSA (réf. 12350, octobre 2023) : identification, travaux et matériels,
// croquis, risques et mesures, conduite à tenir et secours, intempéries, observations, enregistrement, attestations.
// « Version papier » : économe en encre, avec des lignes pour signer à la main et une page à afficher sur le chantier.
import { jsPDF } from 'jspdf';

import { callScript, EMERGENCY_NUMBERS } from '@/domain/emergency';
import { ACTIVITIES, EQUIPMENT_GROUPS, MEASURES, parseJson, RESCUE_CHECKS, RESPONSIBILITY, RISK_GROUP_LABEL, RISKS, TREE_CHECKS } from '@/domain/intervention';
import type { CheckValue, RiskGroup, RisksValue } from '@/domain/intervention';

import { pdfText } from './quote-pdf';

export type SheetPdfInput = {
  company: { name?: string | null; address?: string | null; postal_code?: string | null; city?: string | null; phone?: string | null; siret?: string | null };
  sheet: {
    version: number; status: string; location: string | null; works: string | null; equipment: string | null; start_date: string | null; end_date: string | null;
    risks: string | null; prevention: string | null; accident_procedure: string | null; rescue: string | null; weather_procedure?: string | null; emergency_contacts: string | null;
    signer_name: string | null; signed_at: string | null; retain_until: string | null;
    client_name?: string | null; client_phone?: string | null; company_phone?: string | null; site_manager_name?: string | null; site_manager_phone?: string | null;
    workers_count?: number | null; start_time?: string | null; end_time?: string | null; activities?: string | null; trees_state?: string | null; measures?: string | null;
    communication_mode?: string | null; rescue_checks?: string | null; first_aid_location?: string | null; meeting_point?: string | null; observations?: string | null;
  };
  jobTitle: string;
  quoteNumber?: string | null;
  team: { name: string; role: string }[];
  sketch?: { jpeg: Uint8Array; width: number; height: number } | null;
  signatureJpeg?: Uint8Array | null;
  acks: { name: string; acknowledged_at: string; signatureJpeg?: Uint8Array | null }[];
  logo?: { jpeg: Uint8Array; width: number; height: number } | null;
  printable?: boolean; // version papier à imprimer
};

type RGB = [number, number, number];
const GREEN: RGB = [14, 84, 80];
const GREY: RGB = [94, 98, 90];
const RED: RGB = [178, 34, 34];
const DARK: RGB = [28, 28, 26];
const frDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const frDateTime = (iso: string) => {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const hex = (c: string): RGB => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as RGB;

export function buildSheetPdf(input: SheetPdfInput): ArrayBuffer {
  const { sheet: s, company: c } = input;
  const print = !!input.printable;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Fiche d'intervention - ${input.jobTitle}`, creator: 'Arboject' });
  const L = 15;
  const R = 195;
  const W = R - L;
  let y = 16;
  const text = (t: string, x: number, yy: number, o?: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'right' | 'center' }) => {
    doc.setFont('helvetica', o?.bold ? 'bold' : 'normal');
    doc.setFontSize(o?.size ?? 10);
    doc.setTextColor(...(o?.color ?? DARK));
    doc.text(pdfText(t), x, yy, { align: o?.align ?? 'left' });
  };
  const ensure = (h: number) => {
    if (y + h > 282) {
      doc.addPage();
      y = 16;
    }
  };
  const lines = (t: string, width: number, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    return pdfText(t)
      .split('\n')
      .flatMap((raw) => doc.splitTextToSize(raw || ' ', width) as string[]);
  };
  const para = (t: string, size = 9, color?: RGB, indent = 2) => {
    for (const r of lines(t, W - indent - 2, size)) {
      ensure(5);
      text(r, L + indent, y, { size, color });
      y += size * 0.43;
    }
  };
  const section = (title: string) => {
    ensure(14);
    y += 3;
    if (print) {
      doc.setDrawColor(...DARK);
      doc.setLineWidth(0.5);
      doc.rect(L, y - 4.5, W, 6.5, 'S');
      text(title, L + 2, y, { size: 10, bold: true });
    } else {
      doc.setFillColor(...GREEN);
      doc.rect(L, y - 4.5, W, 6.5, 'F');
      text(title, L + 2, y, { size: 10, bold: true, color: [255, 255, 255] });
    }
    y += 6;
  };
  const sub = (title: string) => {
    ensure(8);
    text(title, L + 2, y + 1, { size: 9, bold: true, color: print ? DARK : GREEN });
    y += 5;
  };
  const box = (x: number, yy: number, on: boolean) => {
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.3);
    doc.rect(x, yy - 2.6, 2.8, 2.8, 'S');
    if (on) {
      doc.line(x + 0.4, yy - 2.2, x + 2.4, yy - 0.2);
      doc.line(x + 2.4, yy - 2.2, x + 0.4, yy - 0.2);
    }
  };
  // Cases à cocher sur 2 colonnes (toutes les cases du modèle, cochées ou non).
  const checks = (items: string[], checked: string[], other?: string) => {
    const colW = (W - 4) / 2;
    const rows: { label: string[]; on: boolean }[] = items.map((i) => ({ label: lines(i, colW - 7, 8.5, checked.includes(i)), on: checked.includes(i) }));
    for (let i = 0; i < rows.length; i += 2) {
      const pair = rows.slice(i, i + 2);
      const h = Math.max(...pair.map((r) => r.label.length)) * 3.7 + 0.8;
      ensure(h + 1);
      pair.forEach((r, k) => {
        const x = L + 2 + k * colW;
        box(x, y, r.on);
        r.label.forEach((ln, j) => text(ln, x + 4.2, y + j * 3.7, { size: 8.5, bold: r.on }));
      });
      y += h;
    }
    if (other) para(`Autres : ${other}`, 8.5);
    else if (print) {
      ensure(5);
      text('Autres (à préciser) : ......................................................................................................', L + 2, y + 0.5, { size: 8.5, color: GREY });
      y += 4.5;
    }
  };
  const kv = (rows: [string, string | null | undefined][], keyW = 52) => {
    for (const [k, v] of rows) {
      const vl = lines(v || (print ? '.................................................' : '-'), W - keyW - 4, 9);
      ensure(vl.length * 4 + 1.5);
      text(k, L + 2, y, { size: 8.5, bold: true });
      vl.forEach((ln, j) => text(ln, L + keyW, y + j * 4, { size: 9, color: v ? DARK : GREY }));
      y += vl.length * 4 + 1.2;
    }
  };
  const numberBoxes = (big: boolean) => {
    const h = big ? 24 : 14;
    const scale = big ? 1.55 : 1;
    ensure(h + 4);
    let x = L + 2;
    for (const n of EMERGENCY_NUMBERS) {
      const w = (n.sms ? 50 : n.number === '112' ? 36 : 22) * scale;
      if (x + w > R) {
        x = L + 2;
        y += h + 3;
      }
      doc.setFillColor(...hex(n.color));
      doc.roundedRect(x, y - 3, w, h, 1.5, 1.5, 'F');
      text(n.number, x + w / 2, y + (big ? 9 : 5), { size: big ? 26 : 15, bold: true, color: [255, 255, 255], align: 'center' });
      text(n.sms ? 'SMS sourd / malentendant' : n.label, x + w / 2, y + (big ? 16.5 : 9.5), { size: big ? 9 : 6.5, color: [255, 255, 255], align: 'center' });
      x += w + 3;
    }
    y += h + 2;
  };
  const cv = (j: string | null | undefined) => parseJson<CheckValue>(j, { checked: [], other: '' });
  const meeting = () => s.meeting_point || (s.location ?? '').split('\n').join(' – ') || null;

  // ---------------------------------------------------------------- En-tête
  if (input.logo) {
    const ratio = input.logo.width / input.logo.height;
    const h = Math.min(16, 40 / ratio);
    doc.addImage(input.logo.jpeg, 'JPEG', L, 8, h * ratio, h);
    y = 8 + h + 6;
  }
  text("FICHE D'INTERVENTION", L, y, { size: 16, bold: true, color: print ? DARK : GREEN });
  text(`Version ${s.version}${s.status === 'brouillon' ? ' - BROUILLON (non signée)' : ''}`, R, y, { size: 10, bold: true, align: 'right', color: s.status === 'brouillon' ? RED : print ? DARK : GREEN });
  y += 5;
  text("En lien avec le décret 2021-1833 du 24 décembre 2021 (travaux d'élagage et d'abattage, entretien de la végétation)", L, y, { size: 7.5, color: GREY });
  y += 6;
  text(`Nom du chantier : ${input.jobTitle}`, L, y, { size: 10, bold: true });
  if (input.quoteNumber) text(`Devis n° ${input.quoteNumber}`, R, y, { size: 10, align: 'right' });
  y += 2;

  // ---------------------------------------------------------------- Identification
  section('Identification');
  const colW = (W - 4) / 2;
  ensure(16);
  text('Entreprise réalisant le chantier', L + 2, y, { size: 8.5, bold: true, color: print ? DARK : GREEN });
  text("Donneur d'ordre", L + 2 + colW, y, { size: 8.5, bold: true, color: print ? DARK : GREEN });
  y += 4.5;
  text(c.name ?? '', L + 2, y, { size: 9.5, bold: true });
  text(s.client_name || (print ? '..............................' : '-'), L + 2 + colW, y, { size: 9.5, bold: true });
  y += 4.2;
  text(`Tél. (incident / accident) : ${s.company_phone || c.phone || ''}`, L + 2, y, { size: 9 });
  text(`Tél. : ${s.client_phone || ''}`, L + 2 + colW, y, { size: 9 });
  y += 4.2;
  const addr = [c.address, [c.postal_code, c.city].filter(Boolean).join(' '), c.siret ? `SIRET ${c.siret}` : null].filter(Boolean).join(' - ');
  if (addr) {
    text(addr, L + 2, y, { size: 8, color: GREY });
    y += 4.5;
  }
  kv([
    ['Lieu (adresse, GPS)', s.location],
    ['Début', [frDate(s.start_date), s.start_time].filter(Boolean).join(' à ') || null],
    ['Fin', [frDate(s.end_date), s.end_time].filter(Boolean).join(' à ') || null],
    ['Responsable sur le chantier', [s.site_manager_name, s.site_manager_phone ? `tél. ${s.site_manager_phone}` : null].filter(Boolean).join(' - ') || null],
    ['Nombre de travailleurs', s.workers_count != null ? String(s.workers_count) : null],
    ['Intervenants', input.team.map((t) => `${t.name}${t.role ? ` (${t.role})` : ''}`).join(', ') || null],
  ]);

  // ---------------------------------------------------------------- 1. Travaux et matériels
  section('1. Travaux à réaliser et matériels');
  const act = cv(s.activities);
  sub('Activités');
  checks(ACTIVITIES, act.checked, act.other);
  if (s.works) {
    sub('Détail des travaux');
    para(s.works, 8.5);
  }
  const eq = cv(s.equipment);
  for (const g of EQUIPMENT_GROUPS) {
    sub(g.title);
    checks(g.items, eq.checked);
  }
  const extraEq = [...eq.checked.filter((e) => !EQUIPMENT_GROUPS.some((g) => g.items.includes(e))), eq.other].filter(Boolean).join(', ');
  if (extraEq) para(`Autres matériels : ${extraEq}`, 8.5);
  const trees = cv(s.trees_state);
  sub('Matières : état sanitaire et physiologique des arbres');
  checks(TREE_CHECKS, trees.checked, trees.other);

  // ---------------------------------------------------------------- 2. Croquis
  section('2. Croquis : accès, voies de circulation, végétaux à traiter');
  if (input.sketch) {
    const ratio = input.sketch.width / input.sketch.height;
    const w = Math.min(W - 4, 105 * ratio);
    const h = w / ratio;
    ensure(h + 4);
    doc.addImage(input.sketch.jpeg, 'JPEG', L + 2, y - 2, w, h);
    y += h + 2;
  } else {
    para('Croquis à joindre (aucun croquis enregistré).', 9, RED);
    if (print) {
      ensure(70);
      doc.setDrawColor(...GREY);
      doc.rect(L + 2, y - 2, W - 4, 65, 'S');
      y += 66;
    }
  }
  para('À indiquer : accès, voies de circulation, arbres à traiter, lignes électriques, zones de danger, point avec réseau téléphonique, point de rencontre des secours (PRS), balisage externe.', 7.5, GREY);

  // ---------------------------------------------------------------- 3. Risques
  section('3. Risques spécifiques au chantier et à son environnement');
  const rk = parseJson<RisksValue>(s.risks, { checked: [], other: '' });
  const checkedRisks = RISKS.filter((r) => rk.checked.includes(r.key)).map((r) => r.label);
  for (const g of Object.keys(RISK_GROUP_LABEL) as RiskGroup[]) {
    sub(RISK_GROUP_LABEL[g]);
    checks(RISKS.filter((r) => r.group === g).map((r) => r.label), checkedRisks);
  }
  if (rk.other) para(`Risques autres identifiés : ${rk.other}`, 8.5);

  // ---------------------------------------------------------------- 4. Mesures
  section('4. Mesures de prévention spécifiques au chantier');
  const ms = cv(s.measures);
  checks(MEASURES, ms.checked, ms.other);
  kv([['Mode de communication', s.communication_mode]], 45);
  if (s.prevention) para(s.prevention, 8.5);

  // ---------------------------------------------------------------- 5. Accident
  section("5. Conduite à tenir en cas d'accident");
  numberBoxes(false);
  para(s.accident_procedure || '-', 8.5);
  sub('Au téléphone, dire :');
  para(callScript({ company: c.name ?? null, address: meeting(), lat: null, lng: null }).map((l, i) => `${i + 1}. ${l}`).join('\n'), 8.5);

  // ---------------------------------------------------------------- 6. Secours
  section('6. Organisation des secours');
  const rc = cv(s.rescue_checks);
  checks(RESCUE_CHECKS, rc.checked, rc.other);
  kv([
    ['Trousse de secours', s.first_aid_location],
    ['Point de rencontre des secours', s.meeting_point],
  ]);
  if (s.rescue) para(s.rescue, 8.5);
  if (s.emergency_contacts) {
    y += 1;
    para(s.emergency_contacts, 9, print ? DARK : GREEN);
  }
  para("Dès le début du chantier, stationner les véhicules dans le sens du départ et laisser la voie d'accès libre. Obtenir l'accord des services d'urgence avant de déplacer ou véhiculer une victime.", 8, GREY);

  // ---------------------------------------------------------------- 7. Météo
  section('7. Conduite à tenir en cas de phénomènes météorologiques imprévus');
  para(s.weather_procedure || '-', 8.5);

  section('Observations / consignes particulières');
  if (s.observations) para(s.observations, 9);
  else if (print) {
    ensure(22);
    doc.setDrawColor(...GREY);
    for (let i = 0; i < 4; i++) doc.line(L + 2, y + 3 + i * 5, R - 2, y + 3 + i * 5);
    y += 22;
  } else para('-', 9);

  // ---------------------------------------------------------------- Enregistrement
  section("Enregistrement : chef d'entreprise (ou son représentant)");
  ensure(34);
  if (s.signed_at) {
    text(`Signée le ${frDateTime(s.signed_at)} par ${s.signer_name ?? ''}`, L + 2, y, { size: 9.5 });
    if (input.signatureJpeg) doc.addImage(input.signatureJpeg, 'JPEG', L + 2, y + 2, 60, 24);
    if (s.retain_until) text(`À conserver jusqu'au ${frDate(s.retain_until)} (2 ans)`, R, y, { size: 8.5, color: GREY, align: 'right' });
    y += 28;
  } else {
    text('Non signée.', L + 2, y, { size: 9.5, color: RED });
    y += 6;
  }

  // ---------------------------------------------------------------- Attestations
  section('Présentée aux intervenants avant le début des travaux');
  if (!input.acks.length && !print) para('Aucune attestation pour le moment.', 9, GREY);
  for (const a of input.acks) {
    ensure(22);
    text(`${a.name} - ${frDateTime(a.acknowledged_at)}`, L + 2, y, { size: 9.5 });
    if (a.signatureJpeg) doc.addImage(a.signatureJpeg, 'JPEG', 120, y - 4, 45, 18);
    y += 19;
  }
  if (print) {
    // Lignes pour signer à la main sur le chantier
    const blanks = Math.max(4, input.team.length - input.acks.length + 2);
    ensure(8 + 11 * Math.min(blanks, 3));
    text('Nom et prénom', L + 2, y, { size: 8.5, bold: true });
    text('Date', 105, y, { size: 8.5, bold: true });
    text('Signature', 140, y, { size: 8.5, bold: true });
    y += 2;
    for (let i = 0; i < blanks; i++) {
      ensure(12);
      doc.setDrawColor(...GREY);
      doc.rect(L + 2, y, 86, 11, 'S');
      doc.rect(103, y, 35, 11, 'S');
      doc.rect(138, y, R - 140, 11, 'S');
      y += 11;
    }
    y += 3;
  }

  // ---------------------------------------------------------------- Rappels
  ensure(26);
  y += 2;
  para(
    "La fiche d'intervention est : communiquée et présentée aux travailleurs avant le début des travaux ; disponible en permanence sur le chantier ; communiquée au chef de l'entreprise utilisatrice dans le cadre de l'article L. 4511-1 du Code du travail (plan de prévention) ; conservée pendant deux ans à compter de sa date de signature.",
    8,
    GREY
  );
  y += 1;
  para(RESPONSIBILITY, 8, GREY);

  // ---------------------------------------------------------------- Page à afficher (version papier)
  if (print) {
    doc.addPage();
    y = 22;
    text('À AFFICHER SUR LE CHANTIER', 105, y, { size: 20, bold: true, align: 'center' });
    y += 8;
    text(`En cas d'accident - ${input.jobTitle}`, 105, y, { size: 12, align: 'center' });
    y += 10;
    text('1. PROTÉGER   2. ALERTER   3. SECOURIR', 105, y, { size: 14, bold: true, color: RED, align: 'center' });
    y += 10;
    numberBoxes(true);
    y += 4;
    kv(
      [
        ['Adresse du chantier', s.location],
        ['Point de rencontre des secours', s.meeting_point],
        ['Responsable sur le chantier', [s.site_manager_name, s.site_manager_phone].filter(Boolean).join(' - ') || null],
        ['Entreprise (incident / accident)', [c.name, s.company_phone || c.phone].filter(Boolean).join(' - ') || null],
        ['Trousse de secours', s.first_aid_location],
      ],
      62
    );
    if (s.emergency_contacts) {
      y += 2;
      para(s.emergency_contacts, 11);
    }
    y += 4;
    text('Au téléphone, dire :', L + 2, y, { size: 12, bold: true });
    y += 6;
    para(callScript({ company: c.name ?? null, address: meeting(), lat: null, lng: null }).map((l, i) => `${i + 1}. ${l}`).join('\n'), 11);
    y += 4;
    para("Ne pas déplacer la victime sans l'accord des secours. Envoyer quelqu'un attendre les secours au point de rencontre.", 11, RED);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    text(`Fiche d'intervention - ${input.jobTitle} - v${s.version} - page ${i}/${pages}`, 105, 291, { size: 7.5, color: GREY, align: 'center' });
  }
  return doc.output('arraybuffer');
}
