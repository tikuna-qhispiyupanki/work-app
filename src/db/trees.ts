import { currentIds } from '@/auth/current';

import { db, newId, nowIso } from './database';

export type TreeRow = { id: string; number: number; species: string | null; lat: number | null; lng: number | null; notes: string | null };

export const VISIT_TREES_SQL = `
  SELECT id, number, species, lat, lng, notes FROM trees
  WHERE visit_id = ? AND deleted_at IS NULL ORDER BY number`;

// Ajoute un arbre avec le numéro suivant (1, 2, 3…). Les numéros ne sont jamais réutilisés
// après une suppression, pour ne pas mélanger l'équipe si un ancien plan circule.
export async function addTree(visitId: string, lat: number, lng: number): Promise<{ id: string; number: number }> {
  const { companyId: COMPANY, userId: USER } = currentIds();
  const now = nowIso();
  const id = newId();
  let number = 1;
  await db.writeTransaction(async (tx) => {
    const r = await tx.get<{ n: number | null }>('SELECT MAX(number) AS n FROM trees WHERE visit_id = ?', [visitId]);
    number = (r.n ?? 0) + 1;
    await tx.execute(
      `INSERT INTO trees (id, company_id, created_at, updated_at, created_by, visit_id, number, species, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
      [id, COMPANY, now, now, USER, visitId, number, lat, lng]
    );
  });
  return { id, number };
}

export async function updateTree(id: string, fields: { species?: string; notes?: string; lat?: number; lng?: number }) {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
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
