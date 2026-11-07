// Estimation du prix d'un arbre (aperçu pendant la visite ; le devis officiel est calculé à l'étape 4b).
import { retainedPriceCents } from './pricing';
import type { GridParams } from './pricing';
import { lineTotalCents, simpleLineCents, surchargeBp } from './quote-calc';

export type TreeForEstimate = {
  quantity: number | null;
  retention: number | null;
  big_trunk: number | null;
  urgent: number | null;
  estimated_ground_hours: number | null;
  estimated_climber_hours: number | null;
  waste_m3: number | null;
};
export type ItemForEstimate = { suggested_price_cents: number; my_price_cents: number | null };

export function estimateTree(t: TreeForEstimate, item: ItemForEstimate | null, p: GridParams) {
  const bp = surchargeBp({ retention: !!t.retention, bigTrunk: !!t.big_trunk, urgent: !!t.urgent }, p);
  const prestation = item ? lineTotalCents(t.quantity ?? 1, retainedPriceCents(item), bp) : 0;
  const temps = simpleLineCents(t.estimated_ground_hours ?? 0, p.rateGroundCents) + simpleLineCents(t.estimated_climber_hours ?? 0, p.rateClimberCents);
  const dechets = simpleLineCents(t.waste_m3 ?? 0, p.wastePerM3Cents);
  return { prestation, temps, dechets, total: prestation + temps + dechets, surchargeBp: bp };
}

// Intervention suggérée selon la hauteur : prestation d'élagage d'entretien dont la tranche contient la hauteur.
export function suggestItemForHeight<T extends { label: string; category: string | null; height_min_m: number | null; height_max_m: number | null }>(
  items: T[],
  heightM: number | null
): T | null {
  if (heightM == null) return null;
  return (
    items.find(
      (i) => /entretien/i.test(i.label) && i.height_min_m != null && heightM >= i.height_min_m && (i.height_max_m == null || heightM < i.height_max_m)
    ) ?? null
  );
}
