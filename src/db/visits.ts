import { vatZoneFromPostalCode } from '@/domain/vat';
import { deleteFile, saveFile } from '@/files/local-files';

import { db, LOCAL_COMPANY_ID, LOCAL_USER_ID, newId, nowIso } from './database';

export type VisitStatus = 'prevue' | 'faite';

export type VisitInput = {
  visitedAt: string; // date et heure prévues de la visite (ISO)
  clientName: string;
  clientPhone: string;
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

// Crée le client et la visite, dans la base du téléphone (fonctionne sans réseau).
export async function createVisit(input: VisitInput, plan?: PlanImage | null): Promise<string> {
  const now = nowIso();
  const clientId = newId();
  const visitId = newId();

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO clients (id, company_id, created_at, updated_at, created_by, kind, name, phone, address, postal_code, city)
       VALUES (?, ?, ?, ?, ?, 'particulier', ?, ?, ?, ?, ?)`,
      [clientId, LOCAL_COMPANY_ID, now, now, LOCAL_USER_ID, t(input.clientName), t(input.clientPhone),
        t(input.siteAddress), t(input.sitePostalCode), t(input.siteCity)]
    );
    await tx.execute(
      `INSERT INTO visits (id, company_id, created_at, updated_at, created_by, client_id, visited_at,
         site_address, site_postal_code, site_city, site_lat, site_lng, site_accuracy_m, vat_zone,
         access_notes, notes, near_power_lines, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prevue')`,
      [visitId, LOCAL_COMPANY_ID, now, now, LOCAL_USER_ID, clientId, input.visitedAt,
        t(input.siteAddress), t(input.sitePostalCode), t(input.siteCity),
        input.siteLat, input.siteLng, input.siteAccuracyM, vatZoneFromPostalCode(input.sitePostalCode),
        t(input.accessNotes), t(input.notes), input.nearPowerLines ? 1 : 0]
    );
  });
  if (plan) await savePlanImage(visitId, plan, input);
  return visitId;
}

// Modifie la visite et son client. Seuls les champs modifiés sont envoyés à la synchronisation
// (règle « le dernier gagne, champ par champ »).
export async function updateVisit(visitId: string, input: VisitInput, plan?: PlanImage | null): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    const row = await tx.getOptional<{ client_id: string }>('SELECT client_id FROM visits WHERE id = ?', [visitId]);
    if (!row) throw new Error('Visite introuvable.');
    await tx.execute(
      `UPDATE clients SET name = ?, phone = ?, address = ?, postal_code = ?, city = ?, updated_at = ? WHERE id = ?`,
      [t(input.clientName), t(input.clientPhone), t(input.siteAddress), t(input.sitePostalCode), t(input.siteCity),
        now, row.client_id]
    );
    await tx.execute(
      `UPDATE visits SET visited_at = ?, site_address = ?, site_postal_code = ?, site_city = ?,
         site_lat = ?, site_lng = ?, site_accuracy_m = ?, vat_zone = ?, access_notes = ?, notes = ?,
         near_power_lines = ?, updated_at = ?
       WHERE id = ?`,
      [input.visitedAt, t(input.siteAddress), t(input.sitePostalCode), t(input.siteCity),
        input.siteLat, input.siteLng, input.siteAccuracyM, vatZoneFromPostalCode(input.sitePostalCode),
        t(input.accessNotes), t(input.notes), input.nearPowerLines ? 1 : 0, now, visitId]
    );
  });
  if (plan) await savePlanImage(visitId, plan, input);
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
async function savePlanImage(visitId: string, plan: PlanImage, input: VisitInput): Promise<void> {
  const now = nowIso();
  const photoId = newId();
  await saveFile(photoId, plan.blob);
  try {
    await db.writeTransaction(async (tx) => {
      await tx.execute(
        `UPDATE photos SET deleted_at = ?, updated_at = ?
         WHERE owner_type = 'visit' AND owner_id = ? AND kind = 'plan' AND deleted_at IS NULL`,
        [now, now, visitId]
      );
      await tx.execute(
        `INSERT INTO photos (id, company_id, created_at, updated_at, created_by, owner_type, owner_id, kind,
           mime_type, width, height, bytes, taken_at, lat, lng, include_in_report)
         VALUES (?, ?, ?, ?, ?, 'visit', ?, 'plan', ?, ?, ?, ?, ?, ?, ?, 1)`,
        [photoId, LOCAL_COMPANY_ID, now, now, LOCAL_USER_ID, visitId, plan.blob.type, plan.width, plan.height,
          plan.blob.size, now, input.siteLat, input.siteLng]
      );
    });
  } catch (e) {
    await deleteFile(photoId);
    throw e;
  }
}

export const VISITS_LIST_SQL = `
  SELECT v.id, v.visited_at, v.site_city, v.site_address, v.status, c.name AS client_name
  FROM visits v LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.deleted_at IS NULL
  ORDER BY v.visited_at ASC`;

export const VISIT_DETAIL_SQL = `
  SELECT v.*, c.name AS client_name, c.phone AS client_phone
  FROM visits v LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.id = ? AND v.deleted_at IS NULL`;

export const VISIT_PLAN_SQL = `
  SELECT id, width, height FROM photos
  WHERE owner_type = 'visit' AND owner_id = ? AND kind = 'plan' AND deleted_at IS NULL
  ORDER BY created_at DESC LIMIT 1`;
