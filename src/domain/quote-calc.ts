// Calcul du devis, repris du « Calculateur » de la grille Excel. Fonctions pures, sans base de données.
// Montants en centimes (entiers), pourcentages en points de base (3 000 = 30 %).
import type { GridParams } from './pricing';

export type Surcharges = { retention: boolean; bigTrunk: boolean; urgent: boolean };

// Somme des majorations cochées (elles s'ADDITIONNENT : 30 % + 25 % = 55 %, comme dans l'Excel).
export function surchargeBp(s: Surcharges, p: Pick<GridParams, 'surchargeRetentionBp' | 'surchargeBigTrunkBp' | 'surchargeUrgentBp'>): number {
  return (s.retention ? p.surchargeRetentionBp : 0) + (s.bigTrunk ? p.surchargeBigTrunkBp : 0) + (s.urgent ? p.surchargeUrgentBp : 0);
}

// Ligne de prestation : quantité × prix unitaire HT × (1 + majorations), arrondi au centime.
export function lineTotalCents(quantity: number, unitPriceCents: number, bp: number): number {
  return Math.round((quantity * unitPriceCents * (10000 + bp)) / 10000);
}

// Ligne « au temps » ou « au volume » : quantité × prix unitaire, arrondi au centime.
export const simpleLineCents = (quantity: number, unitPriceCents: number) => Math.round(quantity * unitPriceCents);

export type VatRegime = 'franchise' | 'assujetti';
export type VatZone = 'reunion' | 'hexagone';
export const VAT_RATE_BP: Record<VatZone, number> = { reunion: 850, hexagone: 2000 };

export function vatRateBp(regime: VatRegime, zone: VatZone): number {
  return regime === 'franchise' ? 0 : VAT_RATE_BP[zone];
}

// Totaux : HT, puis TVA arrondie au centime, puis TTC.
export function totals(lineTotalsCents: number[], vatBp: number) {
  const ht = lineTotalsCents.reduce((a, b) => a + b, 0);
  const vat = Math.round((ht * vatBp) / 10000);
  return { htCents: ht, vatCents: vat, ttcCents: ht + vat };
}
