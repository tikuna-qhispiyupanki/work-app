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

// Arbres d'une visite, situés sur la carte et numérotés (1, 2, 3…) pour que l'équipe s'y retrouve.
// Les autres champs de la fiche arbre (hauteur, intervention, contraintes) arrivent à l'étape 4.
const trees = new Table(
  {
    ...common,
    visit_id: column.text,
    number: column.integer,
    species: column.text, // nom ou essence : « Manguier », « Filao côté piscine »…
    lat: column.real,
    lng: column.real,
    notes: column.text,
    height_m: column.real,
    trunk_diameter_cm: column.real,
    price_item_id: column.text,
    intervention: column.text,
    quantity: column.real,
    retention: column.integer,
    big_trunk: column.integer,
    urgent: column.integer,
    slope: column.integer,
    far_disposal: column.integer,
    power_lines: column.integer,
    estimated_ground_hours: column.real,
    estimated_climber_hours: column.real,
    waste_m3: column.real,
  },
  { indexes: { by_visit: ['visit_id', 'number'] } }
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

// Reçues du serveur uniquement (jamais modifiées sur le téléphone).
const companies = new Table({
  logo_photo_id: column.text,
  sheet_defaults: column.text, // textes par défaut de la fiche d'intervention (JSON)
  name: column.text,
  legal_form: column.text,
  insurance_name: column.text,
  insurance_policy: column.text,
  insurance_area: column.text,
  siret: column.text,
  address: column.text,
  postal_code: column.text,
  city: column.text,
  phone: column.text,
  email: column.text,
  vat_regime: column.text,
  default_vat_zone: column.text,
  quote_validity_days: column.integer,
  quote_payment_terms: column.text,
  quote_deposit_bp: column.integer,
  formule: column.text,
  created_at: column.text,
  updated_at: column.text,
});
const memberships = new Table({
  company_id: column.text,
  user_id: column.text,
  role: column.text,
  active: column.integer,
});
const profiles = new Table({ full_name: column.text, phone: column.text });

// Grille de prix (importée depuis le fichier Excel ; une seule grille active par entreprise).
const price_grids = new Table({
  ...common,
  name: column.text,
  source_file: column.text,
  imported_at: column.text,
  is_active: column.integer,
  rate_climber_cents: column.integer,
  rate_ground_cents: column.integer,
  travel_flat_cents: column.integer,
  waste_per_m3_cents: column.integer,
  waste_cost_per_m3_cents: column.integer,
  vat_hexagone_bp: column.integer,
  coef_bp: column.integer,
  surcharge_retention_bp: column.integer,
  surcharge_big_trunk_bp: column.integer,
  surcharge_urgent_bp: column.integer,
});
const price_items = new Table(
  {
    ...common,
    grid_id: column.text,
    sort_order: column.integer,
    label: column.text,
    category: column.text,
    unit: column.text,
    min_cents: column.integer,
    max_cents: column.integer,
    source_basis: column.text,
    suggested_price_cents: column.integer,
    my_price_cents: column.integer,
    height_min_m: column.real,
    height_max_m: column.real,
    second_source: column.text,
    source: column.text,
  },
  { indexes: { by_grid: ['grid_id', 'sort_order'] } }
);

// Devis et leurs lignes (montants en centimes).
// Mon équipe (étape 5a). Le coût horaire est dans une table à part, que seuls le gérant et le bureau reçoivent.
const team_members = new Table(
  {
    ...common,
    name: column.text,
    trade: column.text, // 'grimpeur' | 'sol' | 'polyvalent' | 'autre'
    phone: column.text,
    user_id: column.text,
    active: column.integer,
    notes: column.text,
  },
  { indexes: { by_company: ['company_id'] } }
);

const team_member_costs = new Table(
  {
    ...common,
    member_id: column.text,
    hourly_cost_cents: column.integer,
  },
  { indexes: { by_member: ['member_id'] } }
);

// Qui est prévu sur un devis, et combien d'heures (pour la marge : interne, jamais montré au client).
const quote_crew = new Table(
  {
    ...common,
    quote_id: column.text,
    member_id: column.text,
    hours: column.real,
  },
  { indexes: { by_quote: ['quote_id'] } }
);

// Chantiers (un par devis signé, même identifiant que le devis) et leur équipe.
const jobs = new Table(
  {
    ...common,
    quote_id: column.text,
    visit_id: column.text,
    client_id: column.text,
    title: column.text,
    site_address: column.text,
    site_lat: column.real,
    site_lng: column.real,
    status: column.text, // 'a_planifier' | 'planifie' | 'en_cours' | 'termine' | 'annule'
    planned_start: column.text,
    planned_end: column.text,
    near_power_lines: column.integer,
    dt_dict_done_on: column.text,
    notes: column.text,
  },
  { indexes: { by_quote: ['quote_id'] } }
);

const job_members = new Table(
  {
    ...common,
    job_id: column.text,
    member_id: column.text,
    role_on_job: column.text, // 'chef' | 'equipier' | 'sauveteur'
  },
  { indexes: { by_job: ['job_id'] } }
);

// Fiche d'intervention (décret 2021-1833) : figée une fois signée, gardée 2 ans.
const intervention_sheets = new Table(
  {
    ...common,
    job_id: column.text,
    version: column.integer,
    status: column.text, // 'brouillon' | 'signee' | 'remplacee'
    location: column.text,
    works: column.text,
    equipment: column.text, // JSON
    start_date: column.text,
    end_date: column.text,
    sketch_photo_id: column.text,
    risks: column.text, // JSON
    prevention: column.text,
    accident_procedure: column.text,
    rescue: column.text,
    weather_procedure: column.text,
    emergency_contacts: column.text,
    client_name: column.text,
    client_phone: column.text,
    company_phone: column.text,
    site_manager_name: column.text,
    site_manager_phone: column.text,
    start_time: column.text,
    end_time: column.text,
    activities: column.text,
    trees_state: column.text,
    measures: column.text,
    communication_mode: column.text,
    rescue_checks: column.text,
    first_aid_location: column.text,
    meeting_point: column.text,
    observations: column.text,
    workers_count: column.integer,
    signer_name: column.text,
    signed_at: column.text,
    signature_photo_id: column.text,
    retain_until: column.text,
  },
  { indexes: { by_job: ['job_id'] } }
);

// Attestations des intervenants (uniquement ajoutées).
const intervention_sheet_acks = new Table(
  {
    ...common,
    sheet_id: column.text,
    member_id: column.text,
    name: column.text,
    acknowledged_at: column.text,
    signature_photo_id: column.text,
  },
  { indexes: { by_sheet: ['sheet_id'] } }
);

// Demandes de signature à distance (lien personnel envoyé au client). La réponse du client
// (nom, date, IP, empreinte, image de signature) n'est écrite que par le serveur.
const quote_sign_requests = new Table(
  {
    ...common,
    quote_id: column.text,
    token: column.text,
    expires_at: column.text,
    status: column.text, // 'envoye' | 'ouvert' | 'signe' | 'refuse' | 'annule'
    opened_at: column.text,
    decided_at: column.text,
    signer_name: column.text,
    signer_ip: column.text,
    signer_user_agent: column.text,
    document_hash: column.text,
    consent_text: column.text,
    signature_data: column.text,
    refusal_reason: column.text,
  },
  { indexes: { by_quote: ['quote_id'] } }
);

const quotes = new Table(
  {
    ...common,
    visit_id: column.text,
    client_id: column.text,
    number: column.text,
    status: column.text, // 'brouillon' | 'finalise' | 'signe' | 'refuse'
    issued_on: column.text,
    valid_until: column.text,
    vat_regime: column.text,
    vat_zone: column.text,
    vat_rate_bp: column.integer,
    company_snapshot: column.text,
    client_snapshot: column.text,
    site_address: column.text,
    subtotal_ht_cents: column.integer,
    vat_cents: column.integer,
    total_ttc_cents: column.integer,
    payment_terms: column.text,
    deposit_bp: column.integer,
    notes: column.text,
    signed_at: column.text,
    signer_name: column.text,
    signature_photo_id: column.text,
    signed_lat: column.real,
    signed_lng: column.real,
  },
  { indexes: { by_visit: ['visit_id'] } }
);
const quote_lines = new Table(
  {
    ...common,
    quote_id: column.text,
    position: column.integer,
    kind: column.text,
    tree_id: column.text,
    price_item_id: column.text,
    label: column.text,
    unit: column.text,
    quantity: column.real,
    unit_price_ht_cents: column.integer,
    retention: column.integer,
    big_trunk: column.integer,
    urgent: column.integer,
    surcharge_bp: column.integer,
    total_ht_cents: column.integer,
    offered: column.integer, // 1 = ligne offerte (geste commercial), hors total
    note: column.text,
  },
  { indexes: { by_quote: ['quote_id', 'position'] } }
);

// Numéros de devis réservés sur le serveur, utilisables hors-ligne (seulement sur ce téléphone).
const quote_number_pool = new Table({ company_id: column.text, year: column.integer, number: column.integer, epoch: column.integer }, { localOnly: true });

// File d'envoi des fichiers photo (seulement sur ce téléphone, jamais synchronisée).
const upload_queue = new Table(
  {
    photo_id: column.text,
    attempts: column.integer,
    last_error: column.text,
    next_try_at: column.text,
    created_at: column.text,
  },
  { localOnly: true }
);

export const AppSchema = new Schema({
  clients, visits, trees, photos, companies, memberships, profiles, price_grids, price_items, quotes, quote_lines, quote_sign_requests, team_members, team_member_costs, quote_crew,
  jobs, job_members, intervention_sheets, intervention_sheet_acks,
  quote_number_pool, upload_queue,
});

export type Database = (typeof AppSchema)['types'];
export type ClientRecord = Database['clients'];
export type VisitRecord = Database['visits'];
export type PhotoRecord = Database['photos'];
export type TreeRecord = Database['trees'];
