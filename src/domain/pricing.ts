// Calculs de prix repris à l'identique de la grille Excel (onglets « Paramètres » et « Tarifs de base »).
// Tous les montants sont en centimes (entiers) ; les pourcentages en points de base (3 000 = 30 %).

export type SourceBasis = 'TTC 20 %' | 'HT';

export type GridParams = {
  rateClimberCents: number; // taux horaire élagueur grimpeur HT
  rateGroundCents: number; // taux horaire homme au sol HT
  travelFlatCents: number; // forfait déplacement HT
  wastePerM3Cents: number; // évacuation des déchets verts facturée au client, par m³
  wasteCostPerM3Cents: number; // coût de dépôt en déchèterie (marge interne, jamais affiché au client)
  vatHexagoneBp: number; // TVA hexagone, pour convertir en HT les prix publiés TTC
  coefBp: number; // coefficient Réunion
  surchargeRetentionBp: number;
  surchargeBigTrunkBp: number;
  surchargeUrgentBp: number;
};

export const DEFAULT_PARAMS: GridParams = {
  rateClimberCents: 5000,
  rateGroundCents: 3500,
  travelFlatCents: 4500,
  wastePerM3Cents: 6000,
  wasteCostPerM3Cents: 200,
  vatHexagoneBp: 2000,
  coefBp: 10000,
  surchargeRetentionBp: 3000,
  surchargeBigTrunkBp: 2500,
  surchargeUrgentBp: 4000,
};

// Arrondi « à l'euro le plus proche », comme ROUND(x; 0) dans Excel (moitié → vers le haut pour les positifs).
const roundEuro = (euros: number) => Math.round(euros + 1e-9);

// Prix conseillé HT = milieu de la fourchette, converti en HT si la source est TTC, × coefficient Réunion,
// arrondi à l'euro. Formule Excel : ROUND((min+max)/2 / IF(base="TTC 20 %"; 1+TVA hexagone; 1) × coef; 0).
export function suggestedPriceCents(minCents: number, maxCents: number, basis: SourceBasis, p: Pick<GridParams, 'vatHexagoneBp' | 'coefBp'>): number {
  const middle = (minCents + maxCents) / 2 / 100;
  const ht = basis === 'TTC 20 %' ? middle / (1 + p.vatHexagoneBp / 10000) : middle;
  return roundEuro((ht * p.coefBp) / 10000) * 100;
}

// Prix retenu : « mon prix » s'il est rempli, sinon le prix conseillé.
export const retainedPriceCents = (item: { suggested_price_cents: number; my_price_cents: number | null }) =>
  item.my_price_cents ?? item.suggested_price_cents;

// Hauteurs lues dans le libellé : « arbre < 5 m », « 5 à 10 m », « > 20 m ».
export function heightsFromLabel(label: string): { min: number | null; max: number | null } {
  const range = /(\d+(?:[.,]\d+)?)\s*à\s*(\d+(?:[.,]\d+)?)\s*m\b/i.exec(label);
  if (range) return { min: num(range[1]), max: num(range[2]) };
  const below = /<\s*(\d+(?:[.,]\d+)?)\s*m\b/.exec(label);
  if (below) return { min: 0, max: num(below[1]) };
  const above = />\s*(\d+(?:[.,]\d+)?)\s*m\b/.exec(label);
  if (above) return { min: num(above[1]), max: null };
  return { min: null, max: null };
}
const num = (s: string) => Number(s.replace(',', '.'));

export const euros = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 });
export const percent = (bp: number) => `${(bp / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
