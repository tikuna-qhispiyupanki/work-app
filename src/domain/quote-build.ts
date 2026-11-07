// Construction des lignes d'un devis à partir de la visite (arbres) et de la grille de prix.
// Fonctions pures : testées sans base de données.
import { retainedPriceCents } from './pricing';
import type { GridParams } from './pricing';
import { lineTotalCents, simpleLineCents, surchargeBp, totals } from './quote-calc';

export type LineKind = 'prestation' | 'heures_sol' | 'heures_grimpeur' | 'evacuation' | 'deplacement' | 'location' | 'libre';

export type QuoteLineDraft = {
  kind: LineKind;
  treeId: string | null;
  priceItemId: string | null;
  label: string;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
  retention: boolean;
  bigTrunk: boolean;
  urgent: boolean;
  surchargeBp: number;
  totalCents: number;
};

export type TreeInput = {
  id: string;
  number: number;
  species: string | null;
  price_item_id: string | null;
  intervention: string | null;
  quantity: number | null;
  retention: number | null;
  big_trunk: number | null;
  urgent: number | null;
  estimated_ground_hours: number | null;
  estimated_climber_hours: number | null;
  waste_m3: number | null;
};
export type ItemInput = { id: string; label: string; unit: string | null; suggested_price_cents: number; my_price_cents: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildQuoteLines(trees: TreeInput[], items: ItemInput[], p: GridParams): QuoteLineDraft[] {
  const lines: QuoteLineDraft[] = [];
  for (const t of [...trees].sort((a, b) => a.number - b.number)) {
    const item = items.find((i) => i.id === t.price_item_id) ?? items.find((i) => i.label === t.intervention);
    if (!item) continue; // arbre sans intervention choisie : pas de ligne
    const s = { retention: !!t.retention, bigTrunk: !!t.big_trunk, urgent: !!t.urgent };
    const bp = surchargeBp(s, p);
    const unitPrice = retainedPriceCents(item);
    const qty = t.quantity ?? 1;
    const who = [t.species?.trim(), `arbre n° ${t.number}`].filter(Boolean).join(', ');
    lines.push({
      kind: 'prestation',
      treeId: t.id,
      priceItemId: item.id,
      label: `${item.label} (${who})`,
      unit: item.unit,
      quantity: qty,
      unitPriceCents: unitPrice,
      ...s,
      surchargeBp: bp,
      totalCents: lineTotalCents(qty, unitPrice, bp),
    });
  }
  const sum = (k: 'estimated_ground_hours' | 'estimated_climber_hours' | 'waste_m3') => round2(trees.reduce((a, t) => a + (t[k] ?? 0), 0));
  const extra = (kind: LineKind, label: string, unit: string, qty: number, unitPrice: number) => {
    if (qty <= 0) return;
    lines.push({ kind, treeId: null, priceItemId: null, label, unit, quantity: qty, unitPriceCents: unitPrice, retention: false, bigTrunk: false, urgent: false, surchargeBp: 0, totalCents: simpleLineCents(qty, unitPrice) });
  };
  extra('heures_sol', 'Main-d’œuvre au sol (portage, protection, nettoyage)', 'heure', sum('estimated_ground_hours'), p.rateGroundCents);
  extra('heures_grimpeur', 'Heures de grimpeur supplémentaires (pente, contraintes)', 'heure', sum('estimated_climber_hours'), p.rateClimberCents);
  extra('evacuation', 'Évacuation des déchets verts', 'm³', sum('waste_m3'), p.wastePerM3Cents);
  extra('deplacement', 'Déplacement', 'forfait', 1, p.travelFlatCents);
  return lines;
}

// Total d'une ligne recalculé après modification (quantité, prix, majorations).
export function recomputeLine(l: Pick<QuoteLineDraft, 'kind' | 'quantity' | 'unitPriceCents' | 'retention' | 'bigTrunk' | 'urgent'>, p: Pick<GridParams, 'surchargeRetentionBp' | 'surchargeBigTrunkBp' | 'surchargeUrgentBp'>) {
  if (l.kind !== 'prestation') return { surchargeBp: 0, totalCents: simpleLineCents(l.quantity, l.unitPriceCents) };
  const bp = surchargeBp({ retention: l.retention, bigTrunk: l.bigTrunk, urgent: l.urgent }, p);
  return { surchargeBp: bp, totalCents: lineTotalCents(l.quantity, l.unitPriceCents, bp) };
}

export const quoteTotals = (lineTotals: number[], vatBp: number) => totals(lineTotals, vatBp);

// Totaux d'un devis : les lignes offertes (geste commercial) ne comptent pas, mais leur valeur est gardée.
export function quoteTotalsFromLines(lines: { total_ht_cents: number; offered?: number | boolean | null }[], vatBp: number) {
  const paid = lines.filter((l) => !l.offered).map((l) => l.total_ht_cents);
  const offeredCents = lines.filter((l) => !!l.offered).reduce((a, l) => a + l.total_ht_cents, 0);
  return { ...totals(paid, vatBp), offeredCents };
}

// « D-2026-0001 »
export const formatQuoteNumber = (year: number, n: number) => `D-${year}-${String(n).padStart(4, '0')}`;

// Date « AAAA-MM-JJ » (jour local) et date d'échéance de validité.
export function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(day: string, days: number) {
  const [y, m, d] = day.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + days));
}

export const FRANCHISE_MENTION = 'TVA non applicable, art. 293 B du CGI';
