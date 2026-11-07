import { currentIds } from '@/auth/current';
import type { ImportedGrid } from '@/domain/grid-import';
import type { GridParams } from '@/domain/pricing';

import { db, newId, nowIso } from './database';

export type GridRow = {
  id: string;
  name: string;
  source_file: string | null;
  imported_at: string;
  rate_climber_cents: number;
  rate_ground_cents: number;
  travel_flat_cents: number;
  waste_per_m3_cents: number;
  waste_cost_per_m3_cents: number;
  vat_hexagone_bp: number;
  coef_bp: number;
  surcharge_retention_bp: number;
  surcharge_big_trunk_bp: number;
  surcharge_urgent_bp: number;
};
export type PriceItemRow = {
  id: string;
  sort_order: number;
  label: string;
  category: string | null;
  unit: string | null;
  min_cents: number | null;
  max_cents: number | null;
  source_basis: string | null;
  suggested_price_cents: number;
  my_price_cents: number | null;
  source: string | null;
};

export const ACTIVE_GRID_SQL = `SELECT * FROM price_grids WHERE is_active = 1 AND deleted_at IS NULL ORDER BY imported_at DESC LIMIT 1`;
export const GRID_ITEMS_SQL = `SELECT * FROM price_items WHERE grid_id = ? AND deleted_at IS NULL ORDER BY sort_order`;

const PARAM_COLUMNS: [keyof GridParams, string][] = [
  ['rateClimberCents', 'rate_climber_cents'],
  ['rateGroundCents', 'rate_ground_cents'],
  ['travelFlatCents', 'travel_flat_cents'],
  ['wastePerM3Cents', 'waste_per_m3_cents'],
  ['wasteCostPerM3Cents', 'waste_cost_per_m3_cents'],
  ['vatHexagoneBp', 'vat_hexagone_bp'],
  ['coefBp', 'coef_bp'],
  ['surchargeRetentionBp', 'surcharge_retention_bp'],
  ['surchargeBigTrunkBp', 'surcharge_big_trunk_bp'],
  ['surchargeUrgentBp', 'surcharge_urgent_bp'],
];

// Crée une nouvelle version de la grille et la rend active (l'ancienne reste en base, inactive).
// Les devis déjà faits ne changent pas : ils ont copié leurs prix.
export async function saveImportedGrid(g: ImportedGrid, fileName: string): Promise<string> {
  const { companyId, userId } = currentIds();
  const now = nowIso();
  const gridId = newId();
  await db.writeTransaction(async (tx) => {
    await tx.execute('UPDATE price_grids SET is_active = 0, updated_at = ? WHERE is_active = 1 AND company_id = ?', [now, companyId]);
    const cols = PARAM_COLUMNS.map(([, c]) => c);
    await tx.execute(
      `INSERT INTO price_grids (id, company_id, created_at, updated_at, created_by, name, source_file, imported_at, is_active, ${cols.join(', ')})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ${cols.map(() => '?').join(', ')})`,
      [gridId, companyId, now, now, userId, `Grille du ${new Date().toLocaleDateString('fr-FR')}`, fileName, now, ...PARAM_COLUMNS.map(([k]) => g.params[k])]
    );
    for (const it of g.items) {
      await tx.execute(
        `INSERT INTO price_items (id, company_id, created_at, updated_at, created_by, grid_id, sort_order, label, category, unit,
           min_cents, max_cents, source_basis, suggested_price_cents, my_price_cents, height_min_m, height_max_m, second_source, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), companyId, now, now, userId, gridId, it.sortOrder, it.label, it.category, it.unit, it.minCents, it.maxCents,
          it.basis, it.suggestedCents, it.myPriceCents, it.heightMin, it.heightMax, it.secondSource, it.source]
      );
    }
  });
  return gridId;
}

// « Mon prix » d'une prestation (vide = revenir au prix conseillé).
export async function setMyPrice(itemId: string, cents: number | null) {
  await db.execute('UPDATE price_items SET my_price_cents = ?, updated_at = ? WHERE id = ?', [cents, nowIso(), itemId]);
}

export async function setGridParam(gridId: string, column: string, value: number) {
  if (!PARAM_COLUMNS.some(([, c]) => c === column)) throw new Error('Paramètre inconnu');
  await db.execute(`UPDATE price_grids SET ${column} = ?, updated_at = ? WHERE id = ?`, [value, nowIso(), gridId]);
}
