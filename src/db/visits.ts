import { vatZoneFromPostalCode } from '@/domain/vat';

import { db, LOCAL_COMPANY_ID, LOCAL_USER_ID, newId, nowIso } from './database';

export type NewVisitInput = {
  clientName: string;
  clientPhone: string;
  siteAddress: string;
  sitePostalCode: string;
  siteCity: string;
  accessNotes: string;
  notes: string;
  nearPowerLines: boolean;
};

// Crée le client et la visite en une seule fois, dans la base locale.
// Fonctionne sans réseau : l'envoi au serveur se fera plus tard (synchronisation, étape 2c).
export async function createVisit(input: NewVisitInput): Promise<string> {
  const now = nowIso();
  const clientId = newId();
  const visitId = newId();
  const base = { company_id: LOCAL_COMPANY_ID, created_at: now, updated_at: now, created_by: LOCAL_USER_ID };

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO clients (id, company_id, created_at, updated_at, created_by, kind, name, phone, address, postal_code, city)
       VALUES (?, ?, ?, ?, ?, 'particulier', ?, ?, ?, ?, ?)`,
      [clientId, base.company_id, base.created_at, base.updated_at, base.created_by,
        input.clientName.trim(), input.clientPhone.trim(), input.siteAddress.trim(),
        input.sitePostalCode.trim(), input.siteCity.trim()]
    );
    await tx.execute(
      `INSERT INTO visits (id, company_id, created_at, updated_at, created_by, client_id, visited_at,
         site_address, site_postal_code, site_city, vat_zone, access_notes, notes, near_power_lines, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon')`,
      [visitId, base.company_id, base.created_at, base.updated_at, base.created_by, clientId, now,
        input.siteAddress.trim(), input.sitePostalCode.trim(), input.siteCity.trim(),
        vatZoneFromPostalCode(input.sitePostalCode), input.accessNotes.trim(), input.notes.trim(),
        input.nearPowerLines ? 1 : 0]
    );
  });
  return visitId;
}

export const VISITS_LIST_SQL = `
  SELECT v.id, v.visited_at, v.site_city, v.site_address, v.status, c.name AS client_name
  FROM visits v LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.deleted_at IS NULL
  ORDER BY v.visited_at DESC`;

export const VISIT_DETAIL_SQL = `
  SELECT v.*, c.name AS client_name, c.phone AS client_phone
  FROM visits v LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.id = ?`;
