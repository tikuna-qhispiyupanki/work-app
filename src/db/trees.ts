import { currentIds } from '@/auth/current';

import { db, newId, nowIso } from './database';

export type TreeRow = {
  id: string;
  visit_id: string;
  number: number;
  species: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  height_m: number | null;
  trunk_diameter_cm: number | null;
  price_item_id: string | null;
  intervention: string | null;
  quantity: number | null;
  retention: number | null;
  big_trunk: number | null;
  urgent: number | null;
  slope: number | null;
  far_disposal: number | null;
  power_lines: number | null;
  estimated_ground_hours: number | null;
  estimated_climber_hours: number | null;
  waste_m3: number | null;
};

export const VISIT_TREES_SQL = `SELECT * FROM trees WHERE visit_id = ? AND deleted_at IS NULL ORDER BY number`;
export const TREE_SQL = `SELECT * FROM trees WHERE id = ? AND deleted_at IS NULL`;

// Champs modifiables de la fiche arbre (liste fermée : rien d'autre ne peut être écrit par ce chemin).
export type TreeFields = Partial<
  Pick<
    TreeRow,
    | 'species' | 'notes' | 'lat' | 'lng' | 'height_m' | 'trunk_diameter_cm' | 'price_item_id' | 'intervention' | 'quantity'
    | 'retention' | 'big_trunk' | 'urgent' | 'slope' | 'far_disposal' | 'power_lines'
    | 'estimated_ground_hours' | 'estimated_climber_hours' | 'waste_m3'
  >
>;
const EDITABLE = new Set<string>([
  'species', 'notes', 'lat', 'lng', 'height_m', 'trunk_diameter_cm', 'price_item_id', 'intervention', 'quantity',
  'retention', 'big_trunk', 'urgent', 'slope', 'far_disposal', 'power_lines',
  'estimated_ground_hours', 'estimated_climber_hours', 'waste_m3',
]);

// Ajoute un arbre avec le numéro suivant (1, 2, 3…). Les numéros ne sont jamais réutilisés
// après une suppression, pour ne pas mélanger l'équipe si un ancien plan circule.
// Sans position (lat/lng vides) : arbre ajouté hors-ligne ou sans carte, à placer plus tard.
export async function addTree(visitId: string, lat: number | null, lng: number | null): Promise<{ id: string; number: number }> {
  const { companyId: COMPANY, userId: USER } = currentIds();
  const now = nowIso();
  const id = newId();
  let number = 1;
  await db.writeTransaction(async (tx) => {
    const r = await tx.get<{ n: number | null }>('SELECT MAX(number) AS n FROM trees WHERE visit_id = ?', [visitId]);
    number = (r.n ?? 0) + 1;
    await tx.execute(
      `INSERT INTO trees (id, company_id, created_at, updated_at, created_by, visit_id, number, species, lat, lng, quantity,
         retention, big_trunk, urgent, slope, far_disposal, power_lines, estimated_ground_hours, estimated_climber_hours, waste_m3)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
      [id, COMPANY, now, now, USER, visitId, number, lat, lng]
    );
  });
  return { id, number };
}

export async function updateTree(id: string, fields: TreeFields) {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || !EDITABLE.has(k)) continue;
    sets.push(`${k} = ?`);
    values.push(typeof v === 'string' ? v.trim() : v);
  }
  if (!sets.length) return;
  await db.execute(`UPDATE trees SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [...values, nowIso(), id]);
}

export async function deleteTree(id: string) {
  const now = nowIso();
  await db.execute('UPDATE trees SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}
