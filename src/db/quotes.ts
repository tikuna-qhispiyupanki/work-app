import { currentIds } from '@/auth/current';
import { gridParams, GridRow } from '@/db/prices';
import type { GridParams } from '@/domain/pricing';
import { addDays, buildQuoteLines, formatQuoteNumber, isoDay, ItemInput, LineKind, quoteTotals, quoteTotalsFromLines, recomputeLine, TreeInput } from '@/domain/quote-build';
import { vatRateBp } from '@/domain/quote-calc';
import type { VatRegime, VatZone } from '@/domain/quote-calc';

import { db, newId, nowIso } from './database';
import { addPhoto } from './photos';

export type QuoteStatus = 'brouillon' | 'finalise' | 'signe' | 'refuse';
export type QuoteRow = {
  id: string;
  company_id: string;
  visit_id: string | null;
  client_id: string | null;
  number: string | null;
  status: QuoteStatus;
  issued_on: string | null;
  valid_until: string | null;
  vat_regime: VatRegime;
  vat_zone: VatZone;
  vat_rate_bp: number;
  company_snapshot: string | null;
  client_snapshot: string | null;
  site_address: string | null;
  subtotal_ht_cents: number;
  vat_cents: number;
  total_ttc_cents: number;
  payment_terms: string | null;
  deposit_bp: number;
  notes: string | null;
  created_at: string;
  signed_at: string | null;
  signer_name: string | null;
  signature_photo_id: string | null;
};
export type QuoteLineRow = {
  id: string;
  position: number;
  kind: LineKind;
  tree_id: string | null;
  label: string;
  unit: string | null;
  quantity: number;
  unit_price_ht_cents: number;
  retention: number;
  big_trunk: number;
  urgent: number;
  surcharge_bp: number;
  total_ht_cents: number;
  offered: number | null;
};
export type CompanyRow = {
  id: string;
  logo_photo_id: string | null;
  name: string | null;
  legal_form: string | null;
  siret: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  insurance_name: string | null;
  insurance_policy: string | null;
  insurance_area: string | null;
  vat_regime: VatRegime | null;
  default_vat_zone: VatZone | null;
  quote_validity_days: number | null;
  quote_payment_terms: string | null;
  quote_deposit_bp: number | null;
};

export const QUOTE_SQL = `SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL`;
export const QUOTE_LINES_SQL = `SELECT * FROM quote_lines WHERE quote_id = ? AND deleted_at IS NULL ORDER BY position`;
export const VISIT_QUOTES_SQL = `SELECT id, number, status, total_ttc_cents, subtotal_ht_cents, created_at FROM quotes WHERE visit_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`;
export const CLIENT_QUOTES_SQL = `SELECT id, number, status, total_ttc_cents, created_at, visit_id FROM quotes WHERE client_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`;
export const COMPANY_SQL = `SELECT * FROM companies WHERE id = ?`;

async function activeGrid(): Promise<{ params: GridParams; items: ItemInput[] } | null> {
  const grid = await db.getOptional<GridRow>(`SELECT * FROM price_grids WHERE is_active = 1 AND deleted_at IS NULL ORDER BY imported_at DESC LIMIT 1`);
  if (!grid) return null;
  const items = await db.getAll<ItemInput>(`SELECT id, label, unit, suggested_price_cents, my_price_cents FROM price_items WHERE grid_id = ? AND deleted_at IS NULL`, [grid.id]);
  return { params: gridParams(grid), items };
}

// Crée un devis brouillon depuis la visite : une ligne par arbre, puis temps, déchets et déplacement.
export async function createQuoteFromVisit(visitId: string): Promise<string> {
  const { companyId, userId } = currentIds();
  const grid = await activeGrid();
  if (!grid) throw new Error('Aucune grille de prix : charge-la dans 👤 → « Grille de prix ».');
  const visit = await db.get<{ client_id: string; vat_zone: VatZone | null; site_address: string | null; site_postal_code: string | null; site_city: string | null }>(
    'SELECT client_id, vat_zone, site_address, site_postal_code, site_city FROM visits WHERE id = ?',
    [visitId]
  );
  const company = await db.getOptional<CompanyRow>(COMPANY_SQL, [companyId]);
  const trees = await db.getAll<TreeInput>('SELECT * FROM trees WHERE visit_id = ? AND deleted_at IS NULL', [visitId]);
  const lines = buildQuoteLines(trees, grid.items, grid.params);
  const regime: VatRegime = company?.vat_regime ?? 'franchise';
  const zone: VatZone = visit.vat_zone ?? company?.default_vat_zone ?? 'reunion';
  const vatBp = vatRateBp(regime, zone);
  const t = quoteTotals(lines.map((l) => l.totalCents), vatBp);
  const id = newId();
  const now = nowIso();
  const site = [visit.site_address, [visit.site_postal_code, visit.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO quotes (id, company_id, created_at, updated_at, created_by, visit_id, client_id, status, vat_regime, vat_zone, vat_rate_bp,
         site_address, subtotal_ht_cents, vat_cents, total_ttc_cents, payment_terms, deposit_bp)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, companyId, now, now, userId, visitId, visit.client_id, regime, zone, vatBp, site, t.htCents, t.vatCents, t.ttcCents,
        company?.quote_payment_terms ?? 'Paiement à réception, par virement, chèque ou espèces.', company?.quote_deposit_bp ?? 0]
    );
    for (const [i, l] of lines.entries()) {
      await tx.execute(
        `INSERT INTO quote_lines (id, company_id, created_at, updated_at, created_by, quote_id, position, kind, tree_id, price_item_id, label, unit,
           quantity, unit_price_ht_cents, retention, big_trunk, urgent, surcharge_bp, total_ht_cents, offered)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [newId(), companyId, now, now, userId, id, i, l.kind, l.treeId, l.priceItemId, l.label, l.unit, l.quantity, l.unitPriceCents,
          l.retention ? 1 : 0, l.bigTrunk ? 1 : 0, l.urgent ? 1 : 0, l.surchargeBp, l.totalCents]
      );
    }
  });
  return id;
}

async function assertDraft(quoteId: string) {
  const q = await db.get<{ status: string }>('SELECT status FROM quotes WHERE id = ?', [quoteId]);
  if (q.status !== 'brouillon') throw new Error('Devis finalisé : il ne peut plus être modifié.');
}

// Recalcule les totaux du devis à partir de ses lignes.
async function refreshTotals(quoteId: string) {
  const q = await db.get<{ vat_rate_bp: number }>('SELECT vat_rate_bp FROM quotes WHERE id = ?', [quoteId]);
  const lines = await db.getAll<{ total_ht_cents: number; offered: number | null }>('SELECT total_ht_cents, offered FROM quote_lines WHERE quote_id = ? AND deleted_at IS NULL', [quoteId]);
  const t = quoteTotalsFromLines(lines, q.vat_rate_bp);
  await db.execute('UPDATE quotes SET subtotal_ht_cents = ?, vat_cents = ?, total_ttc_cents = ?, updated_at = ? WHERE id = ?', [t.htCents, t.vatCents, t.ttcCents, nowIso(), quoteId]);
}

export type LineChange = Partial<{ label: string; quantity: number; unit_price_ht_cents: number; retention: number; big_trunk: number; urgent: number; offered: number }>;

export async function updateQuoteLine(quoteId: string, lineId: string, change: LineChange) {
  await assertDraft(quoteId);
  const grid = await activeGrid();
  const l = await db.get<QuoteLineRow>('SELECT * FROM quote_lines WHERE id = ?', [lineId]);
  const next = { ...l, ...change };
  const r = recomputeLine(
    { kind: next.kind, quantity: next.quantity, unitPriceCents: next.unit_price_ht_cents, retention: !!next.retention, bigTrunk: !!next.big_trunk, urgent: !!next.urgent },
    grid?.params ?? { surchargeRetentionBp: 3000, surchargeBigTrunkBp: 2500, surchargeUrgentBp: 4000 }
  );
  await db.execute(
    `UPDATE quote_lines SET label = ?, quantity = ?, unit_price_ht_cents = ?, retention = ?, big_trunk = ?, urgent = ?, offered = ?, surcharge_bp = ?, total_ht_cents = ?, updated_at = ? WHERE id = ?`,
    [next.label, next.quantity, next.unit_price_ht_cents, next.retention, next.big_trunk, next.urgent, next.offered ? 1 : 0, r.surchargeBp, r.totalCents, nowIso(), lineId]
  );
  await refreshTotals(quoteId);
}

export async function addQuoteLine(quoteId: string, kind: 'location' | 'libre') {
  await assertDraft(quoteId);
  const { companyId, userId } = currentIds();
  const now = nowIso();
  const pos = await db.get<{ p: number | null }>('SELECT MAX(position) AS p FROM quote_lines WHERE quote_id = ?', [quoteId]);
  await db.execute(
    `INSERT INTO quote_lines (id, company_id, created_at, updated_at, created_by, quote_id, position, kind, label, unit, quantity, unit_price_ht_cents,
       retention, big_trunk, urgent, surcharge_bp, total_ht_cents, offered)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 0, 0)`,
    [newId(), companyId, now, now, userId, quoteId, (pos.p ?? -1) + 1, kind, kind === 'location' ? 'Location de matériel (nacelle, rogneuse…)' : 'Prestation', kind === 'location' ? 'jour' : 'forfait']
  );
}

export async function removeQuoteLine(quoteId: string, lineId: string) {
  await assertDraft(quoteId);
  const now = nowIso();
  await db.execute('UPDATE quote_lines SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, lineId]);
  await refreshTotals(quoteId);
}

export async function setQuoteZone(quoteId: string, zone: VatZone) {
  await assertDraft(quoteId);
  const q = await db.get<{ vat_regime: VatRegime }>('SELECT vat_regime FROM quotes WHERE id = ?', [quoteId]);
  await db.execute('UPDATE quotes SET vat_zone = ?, vat_rate_bp = ?, updated_at = ? WHERE id = ?', [zone, vatRateBp(q.vat_regime, zone), nowIso(), quoteId]);
  await refreshTotals(quoteId);
}

export async function setQuoteNotes(quoteId: string, notes: string) {
  await assertDraft(quoteId);
  await db.execute('UPDATE quotes SET notes = ?, updated_at = ? WHERE id = ?', [notes.trim(), nowIso(), quoteId]);
}

export async function deleteDraftQuote(quoteId: string) {
  await assertDraft(quoteId);
  const now = nowIso();
  await db.execute('UPDATE quotes SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, quoteId]);
}

// Champs obligatoires de l'entreprise pour finaliser un devis (identité de l'émetteur).
export function missingCompanyFields(c: CompanyRow | null): string[] {
  if (!c) return ['fiche entreprise'];
  const missing: string[] = [];
  if (!c.name?.trim()) missing.push('nom');
  if (!c.address?.trim() || !c.postal_code?.trim() || !c.city?.trim()) missing.push('adresse');
  if (!c.phone?.trim()) missing.push('téléphone');
  return missing;
}

// Finalise le devis : numéro (réserve du téléphone, marche hors-ligne), dates, coordonnées figées.
export async function finalizeQuote(quoteId: string): Promise<string> {
  const { companyId } = currentIds();
  const company = await db.getOptional<CompanyRow>(COMPANY_SQL, [companyId]);
  const missing = missingCompanyFields(company);
  if (missing.length) throw new Error(`Fiche entreprise incomplète (${missing.join(', ')}) : complète-la dans 👤 → « Fiche entreprise ».`);
  const q = await db.get<QuoteRow>(QUOTE_SQL, [quoteId]);
  if (q.status !== 'brouillon') throw new Error('Ce devis est déjà finalisé.');
  const lines = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_lines WHERE quote_id = ? AND deleted_at IS NULL', [quoteId]);
  if (!lines.n) throw new Error('Le devis ne contient aucune ligne.');
  const client = q.client_id ? await db.getOptional<Record<string, unknown>>('SELECT kind, name, phone, email, address, postal_code, city FROM clients WHERE id = ?', [q.client_id]) : null;
  const year = new Date().getFullYear();
  const today = isoDay(new Date());
  let number = '';
  await db.writeTransaction(async (tx) => {
    const n = await tx.getOptional<{ id: string; number: number }>('SELECT id, number FROM quote_number_pool WHERE company_id = ? AND year = ? ORDER BY number LIMIT 1', [companyId, year]);
    if (!n) throw new Error('Plus de numéro de devis disponible sur ce téléphone : connecte-toi une minute au réseau, puis réessaie.');
    number = formatQuoteNumber(year, n.number);
    await tx.execute('DELETE FROM quote_number_pool WHERE id = ?', [n.id]);
    const snapshot = {
      logo_photo_id: company!.logo_photo_id,
      name: company!.name, legal_form: company!.legal_form, siret: company!.siret, address: company!.address, postal_code: company!.postal_code,
      city: company!.city, phone: company!.phone, email: company!.email, insurance_name: company!.insurance_name,
      insurance_policy: company!.insurance_policy, insurance_area: company!.insurance_area, vat_regime: q.vat_regime,
    };
    await tx.execute(
      `UPDATE quotes SET status = 'finalise', number = ?, issued_on = ?, valid_until = ?, company_snapshot = ?, client_snapshot = ?, updated_at = ? WHERE id = ?`,
      [number, today, addDays(today, company!.quote_validity_days ?? 30), JSON.stringify(snapshot), JSON.stringify(client ?? {}), nowIso(), quoteId]
    );
  });
  return number;
}

// Fiche entreprise (modifiable par le gérant).
export type CompanyFields = Partial<Omit<CompanyRow, 'id'>>;
const COMPANY_EDITABLE = new Set([
  'logo_photo_id', 'name', 'legal_form', 'siret', 'address', 'postal_code', 'city', 'phone', 'email', 'insurance_name', 'insurance_policy', 'insurance_area',
  'vat_regime', 'default_vat_zone', 'quote_validity_days', 'quote_payment_terms', 'quote_deposit_bp',
]);
export async function updateCompany(fields: CompanyFields) {
  const { companyId } = currentIds();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || !COMPANY_EDITABLE.has(k)) continue;
    sets.push(`${k} = ?`);
    values.push(typeof v === 'string' ? v.trim() : (v as number | null));
  }
  if (!sets.length) return;
  await db.execute(`UPDATE companies SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [...values, nowIso(), companyId]);
}

// Signature du client : image (photo « signature », uniquement ajoutée), nom, date, position.
// Fonctionne hors-ligne ; le devis passe à « signé » et ne peut plus changer.
export async function signQuote(
  quoteId: string,
  signerName: string,
  image: { blob: Blob; width: number; height: number },
  position: { lat: number; lng: number } | null
) {
  const q = await db.get<{ status: string }>('SELECT status FROM quotes WHERE id = ?', [quoteId]);
  if (q.status !== 'finalise') throw new Error('Seul un devis finalisé (et pas encore signé ni refusé) peut être signé.');
  if (!signerName.trim()) throw new Error('Indique le nom de la personne qui signe.');
  const photoId = await addPhoto({ ownerType: 'quote', ownerId: quoteId, kind: 'signature', image, lat: position?.lat, lng: position?.lng });
  await db.execute(
    `UPDATE quotes SET status = 'signe', signed_at = ?, signer_name = ?, signature_photo_id = ?, signed_lat = ?, signed_lng = ?, updated_at = ? WHERE id = ?`,
    [nowIso(), signerName.trim(), photoId, position?.lat ?? null, position?.lng ?? null, nowIso(), quoteId]
  );
}

export async function refuseQuote(quoteId: string) {
  const q = await db.get<{ status: string }>('SELECT status FROM quotes WHERE id = ?', [quoteId]);
  if (q.status !== 'finalise') throw new Error('Seul un devis finalisé peut être marqué refusé.');
  await db.execute(`UPDATE quotes SET status = 'refuse', updated_at = ? WHERE id = ?`, [nowIso(), quoteId]);
}

// Logo de l'entreprise : image compressée (800 px, fond blanc), gardée comme photo « logo ».
export async function setCompanyLogo(file: Blob) {
  const { compressImage } = await import('@/files/image');
  const { companyId } = currentIds();
  const image = await compressImage(file, 800, 0.9, '#FFFFFF');
  const photoId = await addPhoto({ ownerType: 'company', ownerId: companyId, kind: 'logo', image, replaceSameKind: true });
  await updateCompany({ logo_photo_id: photoId });
}
