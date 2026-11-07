// PDF du devis (A4), fabriqué sur le téléphone avec jsPDF : fonctionne sans réseau.
// Contient toutes les mentions obligatoires du devis (voir CLAUDE.md, « Mentions obligatoires du devis »).
import { jsPDF } from 'jspdf';

export type PdfCompany = {
  name?: string | null; legal_form?: string | null; siret?: string | null; address?: string | null; postal_code?: string | null;
  city?: string | null; phone?: string | null; email?: string | null; insurance_name?: string | null; insurance_policy?: string | null;
  insurance_area?: string | null;
};
export type PdfClient = { name?: string | null; kind?: string | null; address?: string | null; postal_code?: string | null; city?: string | null; phone?: string | null; email?: string | null };
export type PdfLine = { label: string; unit: string | null; quantity: number; unit_price_ht_cents: number; surcharge_bp: number; total_ht_cents: number; offered?: number | null };
export type PdfQuote = {
  number: string | null; status: string; issued_on: string | null; valid_until: string | null; vat_regime: string; vat_rate_bp: number;
  site_address: string | null; subtotal_ht_cents: number; vat_cents: number; total_ttc_cents: number; payment_terms: string | null;
  deposit_bp: number; notes: string | null; signed_at: string | null; signer_name: string | null;
};
export type QuotePdfInput = {
  quote: PdfQuote;
  lines: PdfLine[];
  company: PdfCompany;
  client: PdfClient;
  signatureJpeg?: Uint8Array | null; // image de la signature du client, si signé
  logo?: { jpeg: Uint8Array; width: number; height: number } | null; // logo de l'entreprise
  remoteProof?: { hash: string; ip?: string | null } | null; // signé à distance par le lien personnel
};

const FRANCHISE = 'TVA non applicable, art. 293 B du CGI';
const GREEN: [number, number, number] = [14, 84, 80];
const GREY: [number, number, number] = [94, 98, 90];

// Les polices standard du PDF ne connaissent pas certains caractères (espaces fines, flèches…).
export const pdfText = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/[≈]/g, '~')
    .replace(/[→]/g, '->')
    .replace(/[✓✔]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '')
    .trim();

const money = (cents: number) =>
  pdfText((cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €';
const pct = (bp: number) => pdfText((bp / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })) + ' %';
const frDate = (iso: string | null) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const qty = (n: number) => pdfText(n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }));

export function buildQuotePdf(input: QuotePdfInput): ArrayBuffer {
  const { quote: q, lines, company: c, client: cl } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Devis ${q.number ?? 'brouillon'}`, creator: 'Arboject' });
  const L = 15;
  const R = 195;
  let y = 18;
  const text = (s: string, x: number, yy: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size ?? 10);
    doc.setTextColor(...(opts?.color ?? [28, 28, 26]));
    doc.text(pdfText(s), x, yy, { align: opts?.align ?? 'left' });
  };
  const wrap = (s: string, width: number, size = 10) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(pdfText(s), width) as string[];
  };
  const ensure = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 18;
    }
  };

  // En-tête : logo et émetteur à gauche, « DEVIS » à droite
  if (input.logo) {
    // Logo dans un cadre de 45 × 22 mm maximum, proportions gardées.
    const ratio = input.logo.width / input.logo.height;
    const h = Math.min(22, 45 / ratio);
    doc.addImage(input.logo.jpeg, 'JPEG', L, 10, h * ratio, h);
    y = 10 + h + 6;
  }
  text(c.name ?? '', L, y, { size: 15, bold: true, color: GREEN });
  text('DEVIS', R, input.logo ? 18 : y, { size: 22, bold: true, color: GREEN, align: 'right' });
  y += 6;
  const issuer = [
    c.legal_form,
    c.address,
    [c.postal_code, c.city].filter(Boolean).join(' '),
    c.phone ? `Tél. ${c.phone}` : null,
    c.email,
    c.siret ? `SIRET ${c.siret}` : null,
  ].filter(Boolean) as string[];
  const right = [
    q.number ? `N° ${q.number}` : 'BROUILLON (non numéroté)',
    q.issued_on ? `Date : ${frDate(q.issued_on)}` : null,
    q.valid_until ? `Valable jusqu'au ${frDate(q.valid_until)}` : null,
    'Devis gratuit',
  ].filter(Boolean) as string[];
  for (let i = 0; i < Math.max(issuer.length, right.length); i++) {
    if (issuer[i]) text(issuer[i], L, y, { size: 9.5, color: GREY });
    if (right[i]) text(right[i], R, y, { size: 10, bold: i === 0, align: 'right' });
    y += 4.6;
  }
  y += 3;

  // Client et chantier
  doc.setDrawColor(218, 216, 207);
  doc.setFillColor(244, 242, 234);
  const boxTop = y;
  const clientLines = [cl.name, cl.address, [cl.postal_code, cl.city].filter(Boolean).join(' '), cl.phone, cl.email].filter(Boolean) as string[];
  const siteLines = wrap(q.site_address || 'Adresse identique', 80, 10);
  const boxH = 9 + Math.max(clientLines.length, siteLines.length) * 4.8;
  doc.roundedRect(L, boxTop, 88, boxH, 2, 2, 'FD');
  doc.roundedRect(L + 92, boxTop, 88, boxH, 2, 2, 'FD');
  text(cl.kind === 'professionnel' ? 'CLIENT (professionnel)' : 'CLIENT', L + 4, boxTop + 5.5, { size: 8.5, bold: true, color: GREEN });
  text('ADRESSE DU CHANTIER', L + 96, boxTop + 5.5, { size: 8.5, bold: true, color: GREEN });
  clientLines.forEach((s, i) => text(s, L + 4, boxTop + 11 + i * 4.8, { bold: i === 0 }));
  siteLines.forEach((s, i) => text(s, L + 96, boxTop + 11 + i * 4.8));
  y = boxTop + boxH + 8;

  // Tableau des prestations
  const cols = { label: L, qty: 122, unit: 136, pu: 166, total: R };
  const header = () => {
    doc.setFillColor(...GREEN);
    doc.rect(L, y - 4.5, R - L, 7, 'F');
    text('Désignation', cols.label + 2, y, { size: 9, bold: true, color: [255, 255, 255] });
    text('Qté', cols.qty, y, { size: 9, bold: true, color: [255, 255, 255], align: 'right' });
    text('Unité', cols.unit, y, { size: 9, bold: true, color: [255, 255, 255] });
    text('PU HT', cols.pu, y, { size: 9, bold: true, color: [255, 255, 255], align: 'right' });
    text('Total HT', cols.total - 2, y, { size: 9, bold: true, color: [255, 255, 255], align: 'right' });
    y += 7;
  };
  header();
  for (const l of lines) {
    const label = l.surcharge_bp ? `${l.label} (majorations +${pct(l.surcharge_bp)})` : l.label;
    const rows = wrap(label, 102, 9.5);
    const h = Math.max(rows.length, l.offered ? 2 : 1) * 4.4 + 2.5; // ligne offerte : 2 lignes (« Offert » + valeur)
    if (y + h > 272) {
      doc.addPage();
      y = 18;
      header();
    }
    rows.forEach((r, i) => text(r, cols.label + 2, y + i * 4.4, { size: 9.5 }));
    text(qty(l.quantity), cols.qty, y, { size: 9.5, align: 'right' });
    text(l.unit ?? '', cols.unit, y, { size: 9 });
    text(money(l.unit_price_ht_cents), cols.pu, y, { size: 9.5, align: 'right' });
    if (l.offered) {
      text('Offert', cols.total - 2, y, { size: 9.5, bold: true, color: GREEN, align: 'right' });
      text(`(valeur ${money(l.total_ht_cents)})`, cols.total - 2, y + 4.2, { size: 8, color: GREY, align: 'right' });
    } else {
      text(money(l.total_ht_cents), cols.total - 2, y, { size: 9.5, align: 'right' });
    }
    y += h;
    doc.setDrawColor(218, 216, 207);
    doc.line(L, y - 3, R, y - 3);
  }

  // Totaux
  y += 2;
  ensure(30);
  const total = (label: string, value: string, strong = false) => {
    text(label, 150, y, { size: strong ? 11 : 10, bold: strong, align: 'right' });
    text(value, R - 2, y, { size: strong ? 11 : 10, bold: strong, align: 'right', color: strong ? GREEN : undefined });
    y += strong ? 6.5 : 5.5;
  };
  total('Total HT', money(q.subtotal_ht_cents));
  if (q.vat_regime === 'franchise') {
    total('TVA', '0,00 €');
    total('Net à payer', money(q.total_ttc_cents), true);
    text(FRANCHISE, R - 2, y, { size: 9, color: GREY, align: 'right' });
    y += 5;
  } else {
    total(`TVA ${pct(q.vat_rate_bp)}`, money(q.vat_cents));
    total('Total TTC', money(q.total_ttc_cents), true);
  }
  const offered = lines.filter((l) => l.offered).reduce((a, l) => a + l.total_ht_cents, 0);
  if (offered) {
    text(`Geste commercial : ${money(offered)} HT offerts`, R - 2, y, { size: 9.5, bold: true, color: GREEN, align: 'right' });
    y += 5;
  }
  if (q.deposit_bp) {
    text(`Acompte à la signature : ${pct(q.deposit_bp)}, soit ${money(Math.round((q.total_ttc_cents * q.deposit_bp) / 10000))}`, R - 2, y, { size: 9.5, align: 'right' });
    y += 5;
  }
  y += 4;

  // Conditions et mentions
  const para = (title: string, body: string) => {
    const rows = wrap(body, R - L, 9.5);
    ensure(6 + rows.length * 4.4);
    text(title, L, y, { size: 9.5, bold: true, color: GREEN });
    y += 4.6;
    rows.forEach((r) => {
      text(r, L, y, { size: 9.5 });
      y += 4.4;
    });
    y += 2;
  };
  if (q.notes) para('Remarques', q.notes);
  para(
    'Conditions',
    [
      'Devis gratuit.',
      q.valid_until ? `Durée de validité : jusqu'au ${frDate(q.valid_until)}.` : null,
      q.payment_terms ? `Conditions de paiement : ${q.payment_terms}` : null,
      q.deposit_bp ? null : 'Aucun acompte demandé.',
    ].filter(Boolean).join(' ')
  );
  if (c.insurance_name || c.insurance_policy) {
    para('Assurance responsabilité civile professionnelle', [c.insurance_name, c.insurance_policy ? `contrat n° ${c.insurance_policy}` : null, c.insurance_area ? `zone couverte : ${c.insurance_area}` : null].filter(Boolean).join(', '));
  }

  // Signature « Bon pour accord »
  ensure(48);
  y += 2;
  doc.setDrawColor(...GREEN);
  doc.roundedRect(105, y, 90, 42, 2, 2, 'S');
  text('Bon pour accord', 109, y + 6, { size: 10, bold: true, color: GREEN });
  if (q.status === 'signe' && q.signed_at) {
    text(`Signé le ${frDate(q.signed_at)} par ${q.signer_name ?? ''}`, 109, y + 11, { size: 9 });
    if (input.signatureJpeg) doc.addImage(input.signatureJpeg, 'JPEG', 112, y + 14, 70, 26);
  } else {
    text('Date, nom et signature du client,', 109, y + 11, { size: 8.5, color: GREY });
    text('précédés de la mention « Bon pour accord »', 109, y + 15, { size: 8.5, color: GREY });
  }
  text("En signant, le client accepte le présent devis et ses conditions.", L, y + 6, { size: 8.5, color: GREY });
  if (q.status === 'signe' && input.remoteProof) {
    text('Signature électronique à distance (lien personnel à usage unique).', L, y + 12, { size: 7.5, color: GREY });
    text('Empreinte SHA-256 du devis signé :', L, y + 16, { size: 7.5, color: GREY });
    text(input.remoteProof.hash.slice(0, 32), L, y + 20, { size: 7.5, color: GREY });
    text(input.remoteProof.hash.slice(32), L, y + 24, { size: 7.5, color: GREY });
    if (input.remoteProof.ip) text(`Adresse IP du signataire : ${input.remoteProof.ip}`, L, y + 28, { size: 7.5, color: GREY });
  }

  // Pied de page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    text(`Devis ${q.number ?? 'brouillon'} - ${c.name ?? ''} - page ${i}/${pages}`, 105, 290, { size: 8, color: GREY, align: 'center' });
  }
  return doc.output('arraybuffer');
}

// « data:image/jpeg;base64,… » → octets de l'image.
export function dataUrlBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
