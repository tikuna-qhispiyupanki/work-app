import { vatZoneFromPostalCode } from '@/domain/vat';

import { currentIds } from '@/auth/current';

import { db, newId, nowIso } from './database';
import { addPhoto } from './photos';

export type VisitStatus = 'prevue' | 'faite';

export type VisitInput = {
  visitedAt: string; // date et heure prévues de la visite (ISO)
  clientId: string | null; // client du carnet ; vide = nouveau client
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  siteAddress: string;
  sitePostalCode: string;
  siteCity: string;
  siteLat: number | null;
  siteLng: number | null;
  siteAccuracyM: number | null;
  accessNotes: string;
  notes: string;
  nearPowerLines: boolean;
};

export type PlanImage = { blob: Blob; width: number; height: number };

const t = (s: string) => s.trim();

// Crée la visite (et le client s'il est nouveau), dans la base du téléphone (fonctionne sans réseau).
export async function createVisit(input: VisitInput, plan?: PlanImage | null): Promise<string> {
  const { companyId: COMPANY, userId: USER } = currentIds();
  const now = nowIso();
  const clientId = input.clientId ?? newId();
  const visitId = newId();

  await db.writeTransaction(async (tx) => {
    if (input.clientId) {
      await tx.execute(`UPDATE clients SET name = ?, phone = ?, email = ?, updated_at = ? WHERE id = ?`, [
        t(input.clientName), t(input.clientPhone), t(input.clientEmail), now, clientId,
      ]);
    } else {
      // Nouveau client : son adresse par défaut est celle du chantier.
      await tx.execute(
        `INSERT INTO clients (id, company_id, created_at, updated_at, created_by, kind, name, phone, email, address, postal_code, city)
         VALUES (?, ?, ?, ?, ?, 'particulier', ?, ?, ?, ?, ?, ?)`,
        [clientId, COMPANY, now, now, USER, t(input.clientName), t(input.clientPhone),
          t(input.clientEmail), t(input.siteAddress), t(input.sitePostalCode), t(input.siteCity)]
      );
    }
    await tx.execute(
      `INSERT INTO visits (id, company_id, created_at, updated_at, created_by, client_id, visited_at,
         site_address, site_postal_code, site_city, site_lat, site_lng, site_accuracy_m, vat_zone,
         access_notes, notes, near_power_lines, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prevue')`,
      [visitId, COMPANY, now, now, USER, clientId, input.visitedAt,
        t(input.siteAddress), t(input.sitePostalCode), t(input.siteCity),
        input.siteLat, input.siteLng, input.siteAccuracyM, vatZoneFromPostalCode(input.sitePostalCode),
        t(input.accessNotes), t(input.notes), input.nearPowerLines ? 1 : 0]
    );
  });
  if (plan) await savePlanImage(visitId, plan, input.siteLat, input.siteLng);
  return visitId;
}

// Modifie la visite et son client. Seuls les champs modifiés sont envoyés à la synchronisation
// (règle « le dernier gagne, champ par champ »). L'adresse du client n'est pas touchée :
// c'est l'adresse du chantier, propre à la visite, qui change.
export async function updateVisit(visitId: string, input: VisitInput, plan?: PlanImage | null): Promise<void> {
  const { companyId: COMPANY, userId: USER } = currentIds();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    const row = await tx.getOptional<{ client_id: string }>('SELECT client_id FROM visits WHERE id = ?', [visitId]);
    if (!row) throw new Error('Visite introuvable.');
    let clientId = row.client_id;
    if (input.clientId && input.clientId !== row.client_id) {
      clientId = input.clientId; // la visite est rattachée à un autre client du carnet
    } else if (!input.clientId) {
      clientId = newId(); // « nouveau client » choisi pendant la modification
      await tx.execute(
        `INSERT INTO clients (id, company_id, created_at, updated_at, created_by, kind, name, address, postal_code, city)
         VALUES (?, ?, ?, ?, ?, 'particulier', ?, ?, ?, ?)`,
        [clientId, COMPANY, now, now, USER, t(input.clientName), t(input.siteAddress),
          t(input.sitePostalCode), t(input.siteCity)]
      );
    }
    await tx.execute(`UPDATE clients SET name = ?, phone = ?, email = ?, updated_at = ? WHERE id = ?`, [
      t(input.clientName), t(input.clientPhone), t(input.clientEmail), now, clientId,
    ]);
    await tx.execute(
      `UPDATE visits SET client_id = ?, visited_at = ?, site_address = ?, site_postal_code = ?, site_city = ?,
         site_lat = ?, site_lng = ?, site_accuracy_m = ?, vat_zone = ?, access_notes = ?, notes = ?,
         near_power_lines = ?, updated_at = ?
       WHERE id = ?`,
      [clientId, input.visitedAt, t(input.siteAddress), t(input.sitePostalCode), t(input.siteCity),
        input.siteLat, input.siteLng, input.siteAccuracyM, vatZoneFromPostalCode(input.sitePostalCode),
        t(input.accessNotes), t(input.notes), input.nearPowerLines ? 1 : 0, now, visitId]
    );
  });
  if (plan) await savePlanImage(visitId, plan, input.siteLat, input.siteLng);
}

export async function setVisitStatus(visitId: string, status: VisitStatus): Promise<void> {
  await db.execute('UPDATE visits SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), visitId]);
}

// Suppression « douce » : la visite est masquée partout, mais reste en base (traçabilité, synchronisation).
export async function deleteVisit(visitId: string): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE visits SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, visitId]);
}

// Enregistre l'image du plan. L'ancienne image de plan de la visite est masquée (une seule active).
export async function savePlanImage(visitId: string, plan: PlanImage, lat: number | null, lng: number | null): Promise<void> {
  await addPhoto({ ownerType: 'visit', ownerId: visitId, kind: 'plan', image: plan, lat, lng, replaceSameKind: true });
}

export const VISITS_LIST_SQL = `
  SELECT v.id, v.visited_at, v.site_city, v.site_address, v.status, c.name AS client_name
  FROM visits v LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.deleted_at IS NULL
  ORDER BY v.visited_at ASC`;

export const VISIT_DETAIL_SQL = `
  SELECT v.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email
  FROM visits v LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.id = ? AND v.deleted_at IS NULL`;

export const VISIT_PLAN_SQL = `
  SELECT id, width, height, storage_path FROM photos
  WHERE owner_type = 'visit' AND owner_id = ? AND kind = 'plan' AND deleted_at IS NULL
  ORDER BY created_at DESC LIMIT 1`;
