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
    site_accuracy_m: column.integer, // précision du GPS en mètres (vide si position tirée de l'adresse)
    vat_zone: column.text, // 'reunion' | 'hexagone'
    access_notes: column.text,
    notes: column.text,
    dictation_text: column.text,
    near_power_lines: column.integer, // 0 / 1
    status: column.text, // 'prevue' | 'faite'
  },
  { indexes: { by_date: ['visited_at'], by_client: ['client_id'] } }
);

// Photos et images (plan, croquis, signatures…). Uniquement ajoutées : jamais modifiées par la synchronisation.
// Le fichier lui-même est gardé sur le téléphone (src/files/local-files.ts) sous la même clé que `id`.
const photos = new Table(
  {
    ...common,
    owner_type: column.text, // 'visit' | 'tree' | 'job' | 'message' …
    owner_id: column.text,
    kind: column.text, // 'photo' | 'plan' | 'croquis' | 'signature'
    mime_type: column.text,
    width: column.integer,
    height: column.integer,
    bytes: column.integer,
    storage_path: column.text, // rempli après l'envoi (étape 2d)
    taken_at: column.text,
    lat: column.real,
    lng: column.real,
    caption: column.text,
    include_in_report: column.integer,
  },
  { indexes: { by_owner: ['owner_type', 'owner_id'] } }
);

export const AppSchema = new Schema({ clients, visits, photos });

export type Database = (typeof AppSchema)['types'];
export type ClientRecord = Database['clients'];
export type VisitRecord = Database['visits'];
export type PhotoRecord = Database['photos'];
