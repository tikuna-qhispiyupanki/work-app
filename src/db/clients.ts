import { currentIds } from '@/auth/current';

import { db, newId, nowIso } from './database';

// Carnet clients : recherche, fiche et historique des visites.

export type ClientKind = 'particulier' | 'professionnel';
export type ClientRow = {
  id: string;
  kind: ClientKind | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  notes: string | null;
  visit_count: number;
  last_visit_at: string | null;
};

const CLIENT_COLUMNS = `
  c.id, c.kind, c.name, c.phone, c.email, c.address, c.postal_code, c.city, c.notes,
  (SELECT COUNT(*) FROM visits v WHERE v.client_id = c.id AND v.deleted_at IS NULL) AS visit_count,
  (SELECT MAX(v.visited_at) FROM visits v WHERE v.client_id = c.id AND v.deleted_at IS NULL) AS last_visit_at`;

// Liste du carnet, filtrée par nom, téléphone ou commune. `?` = texte recherché (vide = tous).
export const CLIENTS_SEARCH_SQL = `
  SELECT ${CLIENT_COLUMNS}
  FROM clients c
  WHERE c.deleted_at IS NULL
    AND (? = '' OR c.name LIKE '%' || ? || '%' OR c.phone LIKE '%' || ? || '%' OR c.city LIKE '%' || ? || '%')
  ORDER BY c.name COLLATE NOCASE`;

export const CLIENT_DETAIL_SQL = `SELECT ${CLIENT_COLUMNS} FROM clients c WHERE c.id = ? AND c.deleted_at IS NULL`;

// Historique : toutes les visites du client, de la plus récente à la plus ancienne.
export const CLIENT_VISITS_SQL = `
  SELECT v.id, v.visited_at, v.status, v.site_address, v.site_city, v.notes,
    (SELECT COUNT(*) FROM trees t WHERE t.visit_id = v.id AND t.deleted_at IS NULL) AS tree_count
  FROM visits v
  WHERE v.client_id = ? AND v.deleted_at IS NULL
  ORDER BY v.visited_at DESC`;

// Dernière visite du client : sert à proposer la même adresse de chantier.
export async function lastVisitOf(clientId: string) {
  return db.getOptional<{
    site_address: string | null;
    site_postal_code: string | null;
    site_city: string | null;
    site_lat: number | null;
    site_lng: number | null;
    site_accuracy_m: number | null;
    access_notes: string | null;
    visited_at: string;
  }>(
    `SELECT site_address, site_postal_code, site_city, site_lat, site_lng, site_accuracy_m, access_notes, visited_at
     FROM visits WHERE client_id = ? AND deleted_at IS NULL ORDER BY visited_at DESC LIMIT 1`,
    [clientId]
  );
}

export type ClientInput = {
  kind: ClientKind;
  name: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  notes: string;
};

export async function updateClient(id: string, c: ClientInput) {
  await db.execute(
    `UPDATE clients SET kind = ?, name = ?, phone = ?, email = ?, address = ?, postal_code = ?, city = ?, notes = ?, updated_at = ? WHERE id = ?`,
    [c.kind, c.name.trim(), c.phone.trim(), c.email.trim(), c.address.trim(), c.postalCode.trim(), c.city.trim(), c.notes.trim(), nowIso(), id]
  );
}

// Nouveau client saisi directement dans le carnet (sans visite).
export async function createClient(c: ClientInput): Promise<string> {
  const { companyId, userId } = currentIds();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO clients (id, company_id, created_at, updated_at, created_by, kind, name, phone, email, address, postal_code, city, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, companyId, now, now, userId, c.kind, c.name.trim(), c.phone.trim(), c.email.trim(), c.address.trim(), c.postalCode.trim(), c.city.trim(), c.notes.trim()]
  );
  return id;
}

// Retire le client du carnet (suppression douce). Ses visites restent consultables.
export async function archiveClient(id: string) {
  const now = nowIso();
  await db.execute('UPDATE clients SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}
