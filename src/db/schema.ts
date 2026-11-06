import { column, Schema, Table } from '@powersync/web';

// Structure de la base locale (SQLite sur le téléphone).
// Doit rester alignée avec docs/modele-de-donnees.md et, plus tard, avec Postgres.
// PowerSync ajoute lui-même la colonne `id` (texte, UUID) à chaque table.

const common = {
  company_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  deleted_at: column.text,
};

const clients = new Table(
  {
    ...common,
    kind: column.text, // 'particulier' | 'professionnel'
    name: column.text,
    phone: column.text,
    email: column.text,
    address: column.text,
    postal_code: column.text,
    city: column.text,
    notes: column.text,
  },
  { indexes: { by_name: ['name'] } }
);

const visits = new Table(
  {
    ...common,
    client_id: column.text,
    visited_at: column.text,
    site_address: column.text,
    site_postal_code: column.text,
    site_city: column.text,
    site_lat: column.real,
    site_lng: column.real,
    vat_zone: column.text, // 'reunion' | 'hexagone'
    access_notes: column.text,
    notes: column.text,
    dictation_text: column.text,
    near_power_lines: column.integer, // 0 / 1
    status: column.text, // 'brouillon' | 'terminee'
  },
  { indexes: { by_date: ['visited_at'], by_client: ['client_id'] } }
);

export const AppSchema = new Schema({ clients, visits });

export type Database = (typeof AppSchema)['types'];
export type ClientRecord = Database['clients'];
export type VisitRecord = Database['visits'];
