// Marge interne d'un devis (jamais montrée au client).
// Prix HT facturé (lignes offertes exclues) − coût de l'équipe prévue − coût de dépôt des déchets verts.

export type CrewCost = { hours: number; hourlyCostCents: number | null }; // null : coût horaire pas encore renseigné

export type Margin = {
  revenueCents: number;
  crewHours: number;
  crewCostCents: number;
  wasteCostCents: number;
  costCents: number;
  marginCents: number;
  marginBp: number | null; // marge / prix HT, en points de base (null si prix nul)
  missingCosts: number; // équipiers prévus sans coût horaire
};

export function quoteMargin(o: { revenueCents: number; crew: CrewCost[]; wasteM3: number; wasteCostPerM3Cents: number }): Margin {
  const crewHours = o.crew.reduce((s, c) => s + c.hours, 0);
  const crewCostCents = o.crew.reduce((s, c) => s + Math.round(c.hours * (c.hourlyCostCents ?? 0)), 0);
  const wasteCostCents = Math.round(o.wasteM3 * o.wasteCostPerM3Cents);
  const costCents = crewCostCents + wasteCostCents;
  const marginCents = o.revenueCents - costCents;
  return {
    revenueCents: o.revenueCents,
    crewHours,
    crewCostCents,
    wasteCostCents,
    costCents,
    marginCents,
    marginBp: o.revenueCents > 0 ? Math.round((marginCents * 10000) / o.revenueCents) : null,
    missingCosts: o.crew.filter((c) => c.hours > 0 && c.hourlyCostCents == null).length,
  };
}
