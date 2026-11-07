import { currentIds } from '@/auth/current';

import { db, newId, nowIso } from './database';

export type Trade = 'grimpeur' | 'sol' | 'polyvalent' | 'autre';
export const TRADE_LABEL: Record<Trade, string> = { grimpeur: 'Grimpeur', sol: 'Homme au sol', polyvalent: 'Polyvalent', autre: 'Autre' };

export type TeamMemberRow = {
  id: string;
  name: string;
  trade: Trade;
  phone: string | null;
  active: number;
  notes: string | null;
  hourly_cost_cents: number | null; // null : pas renseigné (ou pas visible pour ce rôle)
  aipr_profile: string | null;
  aipr_valid_until: string | null;
};

// Équipe de l'entreprise active, avec le coût horaire quand ce téléphone le reçoit (gérant, bureau).
export const TEAM_SQL = `SELECT m.id, m.name, m.trade, m.phone, m.active, m.notes, m.aipr_profile, m.aipr_valid_until, c.hourly_cost_cents
  FROM team_members m LEFT JOIN team_member_costs c ON c.member_id = m.id AND c.deleted_at IS NULL
  WHERE m.company_id = ? AND m.deleted_at IS NULL ORDER BY m.active DESC, m.name COLLATE NOCASE`;

export type CrewRow = { id: string; member_id: string; hours: number; name: string; trade: Trade; hourly_cost_cents: number | null };
export const QUOTE_CREW_SQL = `SELECT q.id, q.member_id, q.hours, m.name, m.trade, c.hourly_cost_cents
  FROM quote_crew q JOIN team_members m ON m.id = q.member_id
  LEFT JOIN team_member_costs c ON c.member_id = q.member_id AND c.deleted_at IS NULL
  WHERE q.quote_id = ? AND q.deleted_at IS NULL ORDER BY m.name COLLATE NOCASE`;

export async function addTeamMember(name: string, trade: Trade, hourlyCostCents: number | null): Promise<string> {
  const { companyId, userId } = currentIds();
  const id = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO team_members (id, company_id, created_at, updated_at, created_by, name, trade, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, companyId, now, now, userId, name.trim(), trade]
    );
    if (hourlyCostCents != null) {
      await tx.execute(
        `INSERT INTO team_member_costs (id, company_id, created_at, updated_at, created_by, member_id, hourly_cost_cents) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId(), companyId, now, now, userId, id, hourlyCostCents]
      );
    }
  });
  return id;
}

export async function updateTeamMember(id: string, c: Partial<{ name: string; trade: Trade; phone: string; active: number; notes: string; aipr_profile: string | null; aipr_valid_until: string | null }>) {
  const keys = Object.keys(c) as (keyof typeof c)[];
  if (!keys.length) return;
  await db.execute(`UPDATE team_members SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [...keys.map((k) => c[k] ?? null), nowIso(), id]);
}

export async function setHourlyCost(memberId: string, cents: number) {
  const { companyId, userId } = currentIds();
  const now = nowIso();
  const existing = await db.getOptional<{ id: string }>('SELECT id FROM team_member_costs WHERE member_id = ? AND deleted_at IS NULL', [memberId]);
  if (existing) await db.execute('UPDATE team_member_costs SET hourly_cost_cents = ?, updated_at = ? WHERE id = ?', [cents, now, existing.id]);
  else
    await db.execute(
      `INSERT INTO team_member_costs (id, company_id, created_at, updated_at, created_by, member_id, hourly_cost_cents) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), companyId, now, now, userId, memberId, cents]
    );
}

// Retire de l'équipe (suppression douce : les anciens devis gardent la personne).
export async function removeTeamMember(id: string) {
  const now = nowIso();
  await db.execute('UPDATE team_members SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

export async function addToCrew(quoteId: string, memberId: string, hours: number) {
  const { companyId, userId } = currentIds();
  const now = nowIso();
  await db.execute(
    `INSERT INTO quote_crew (id, company_id, created_at, updated_at, created_by, quote_id, member_id, hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), companyId, now, now, userId, quoteId, memberId, hours]
  );
}

export async function setCrewHours(crewId: string, hours: number) {
  await db.execute('UPDATE quote_crew SET hours = ?, updated_at = ? WHERE id = ?', [hours, nowIso(), crewId]);
}

export async function removeFromCrew(crewId: string) {
  const now = nowIso();
  await db.execute('UPDATE quote_crew SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, crewId]);
}
