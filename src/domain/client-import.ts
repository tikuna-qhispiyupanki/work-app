import type { Sheet } from '@/domain/xlsx';

// Import d'un carnet de clients depuis un fichier Excel (.xlsx) ou CSV.
// Étapes : lire le tableau → trouver la ligne des titres → deviner quelle colonne correspond à quoi
// (modifiable par l'utilisateur) → préparer chaque client → repérer les doublons (déjà dans le carnet
// ou deux fois dans le fichier) → aperçu → import des nouveaux seulement.

export type Table = string[][];

export type ImportField = 'name' | 'lastName' | 'firstName' | 'company' | 'kind' | 'phone' | 'phone2' | 'email' | 'address' | 'address2' | 'postalCode' | 'city' | 'notes';

export const IMPORT_FIELDS: { key: ImportField; label: string; hint?: string }[] = [
  { key: 'name', label: 'Nom complet', hint: 'ou « Nom » + « Prénom » ci-dessous' },
  { key: 'lastName', label: 'Nom de famille' },
  { key: 'firstName', label: 'Prénom' },
  { key: 'company', label: 'Société', hint: 'rempli → client professionnel' },
  { key: 'kind', label: 'Type (particulier / pro)' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'phone2', label: 'Autre téléphone', hint: 'utilisé si le premier est vide' },
  { key: 'email', label: 'E-mail' },
  { key: 'address', label: 'Adresse' },
  { key: 'address2', label: "Complément d'adresse" },
  { key: 'postalCode', label: 'Code postal' },
  { key: 'city', label: 'Commune' },
  { key: 'notes', label: 'Notes' },
];

export type Mapping = Partial<Record<ImportField, number>>; // champ → numéro de colonne (0 = première)

export type ImportedClient = {
  kind: 'particulier' | 'professionnel';
  name: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  notes: string;
};

export type CandidateStatus = 'nouveau' | 'doublon' | 'doublon_fichier' | 'sans_nom';
export type Candidate = { line: number; client: ImportedClient; status: CandidateStatus; reason?: string };

export type ExistingClient = { name: string | null; phone: string | null; email: string | null; postal_code: string | null };

export const MAX_ROWS = 5000;

// ---------------------------------------------------------------------------
// Lecture du fichier

// CSV : encodage UTF-8 (avec ou sans BOM), sinon Windows-1252 (CSV enregistré par Excel sur PC).
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^﻿/, '');
}

// Séparateur le plus fréquent sur la première ligne (hors guillemets) : « ; » (Excel français), « , » ou tabulation.
function detectSeparator(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let quoted = false;
  for (const ch of first) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ';';
}

export function parseCsv(text: string): Table {
  const sep = detectSeparator(text);
  const rows: Table = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return clean(rows);
}

// Feuille Excel → tableau de textes. Les nombres gardent leurs chiffres (le 0 initial d'un
// téléphone perdu par Excel est rétabli plus loin).
export function tableFromSheet(sheet: Sheet): Table {
  const rows: Table = [];
  for (const [ref, value] of sheet) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m || value == null) continue;
    const col = [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
    const r = Number(m[2]) - 1;
    if (r >= MAX_ROWS + 20) continue;
    while (rows.length <= r) rows.push([]);
    const line = rows[r];
    while (line.length <= col) line.push('');
    line[col] = typeof value === 'number' ? (Number.isInteger(value) ? String(value) : String(value).replace('.', ',')) : value;
  }
  return clean(rows);
}

// Retire les lignes vides et les espaces autour des valeurs.
function clean(rows: Table): Table {
  return rows.map((r) => r.map((c) => c.replace(/\s+/g, ' ').trim())).filter((r) => r.some((c) => c !== ''));
}

// ---------------------------------------------------------------------------
// Colonnes

export const simplify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Noms de colonnes reconnus (après simplification : minuscules, sans accents ni ponctuation).
const HEADER_WORDS: [ImportField, RegExp][] = [
  ['firstName', /^(prenom|first ?name|given name)$/],
  ['lastName', /^(nom de famille|nom|last ?name|surname|family name)$/],
  ['name', /^(nom complet|client|nom du client|nom client|nom et prenom|nom prenom|name|full name|contact|destinataire|tiers)$/],
  ['company', /^(societe|entreprise|raison sociale|company|organisation|organization|denomination|etablissement)$/],
  ['kind', /^(type|type de client|categorie|particulier professionnel|statut)$/],
  ['phone', /^(telephone|tel|tel portable|portable|mobile|gsm|phone|telephone mobile|tel mobile|numero de telephone|n de telephone|telephone 1|tel 1|cellulaire)$/],
  ['phone2', /^(telephone fixe|fixe|tel fixe|telephone 2|tel 2|autre telephone|telephone domicile|tel domicile|telephone bureau|home phone|work phone)$/],
  ['email', /^(e ?mail|courriel|mail|adresse e ?mail|adresse mail|email address)$/],
  ['address', /^(adresse|rue|adresse 1|adresse ligne 1|voie|street|address|adresse postale|lieu)$/],
  ['address2', /^(complement|complement d adresse|adresse 2|adresse ligne 2|lieu dit|batiment|residence)$/],
  ['postalCode', /^(code postal|cp|code postale|postal code|zip|zip code|codepostal)$/],
  ['city', /^(ville|commune|localite|city|town)$/],
  ['notes', /^(notes?|remarques?|commentaires?|observations?|infos?|informations?|memo)$/],
];

function fieldOfHeader(header: string): ImportField | null {
  const h = simplify(header);
  if (!h) return null;
  for (const [field, re] of HEADER_WORDS) if (re.test(h)) return field;
  return null;
}

// Ligne des titres : la première (parmi les 10 premières) qui contient au moins 2 titres reconnus. Sinon la 1re.
export function findHeaderRow(table: Table): number {
  for (let i = 0; i < Math.min(10, table.length); i++) {
    if (table[i].filter((c) => fieldOfHeader(c)).length >= 2) return i;
  }
  return 0;
}

export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  headers.forEach((h, i) => {
    let f = fieldOfHeader(h);
    if (f === 'phone' && mapping.phone !== undefined) f = 'phone2'; // 2e colonne de téléphone
    if (f && mapping[f] === undefined) mapping[f] = i;
  });
  // « Nom » seul (sans « Prénom ») = nom complet
  if (mapping.lastName !== undefined && mapping.firstName === undefined && mapping.name === undefined) {
    mapping.name = mapping.lastName;
    delete mapping.lastName;
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Valeurs

// Téléphone : chiffres seulement, indicatif +262 / +33 remplacé par 0, 0 initial rétabli (perdu par Excel),
// présenté par paires « 0692 12 34 56 ». Ce qui n'est pas reconnu est gardé tel quel.
export function formatPhone(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  let d = s.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else d = d.replace(/^0*/, (z) => (z ? '0' : ''));
  if (/^(262|33)\d{9}$/.test(d)) d = '0' + d.slice(d.length - 9);
  if (/^[1-9]\d{8}$/.test(d)) d = '0' + d;
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
  return s;
}

const phoneKey = (p: string | null) => {
  const d = (p ?? '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
};
const emailKey = (e: string | null) => (e ?? '').trim().toLowerCase();
const nameKey = (n: string | null, cp: string | null) => {
  const s = simplify(n ?? '')
    .replace(/^(m|mr|mme|mlle|monsieur|madame|mademoiselle|m et mme|mr et mme)\s+/, '')
    .split(' ')
    .sort()
    .join(' ');
  return s ? `${s}|${(cp ?? '').trim()}` : '';
};

function postalCode(raw: string): string {
  const s = raw.trim();
  return /^\d{4}$/.test(s) ? '0' + s : s;
}

const isPro = (v: string) => /^(pro|professionnel|professionnelle|entreprise|societe|societ|sarl|sas|eurl|sa|mairie|collectivite|syndic|copropriete|association|b2b)/.test(simplify(v));

const email = (raw: string) => {
  const m = /[^\s<>,;"]+@[^\s<>,;"]+\.[a-z]{2,}/i.exec(raw);
  return m ? m[0].toLowerCase() : raw.trim();
};

// Prépare les clients du fichier et repère les doublons.
export function buildCandidates(table: Table, headerRow: number, mapping: Mapping, existing: ExistingClient[]): Candidate[] {
  const get = (row: string[], f: ImportField) => (mapping[f] !== undefined ? (row[mapping[f]!] ?? '').trim() : '');
  const known = { phone: new Set<string>(), email: new Set<string>(), name: new Set<string>() };
  for (const c of existing) {
    const p = phoneKey(c.phone);
    if (p) known.phone.add(p);
    const e = emailKey(c.email);
    if (e) known.email.add(e);
    const n = nameKey(c.name, c.postal_code);
    if (n) known.name.add(n);
  }
  const seen = { phone: new Set<string>(), email: new Set<string>(), name: new Set<string>() };

  return table.slice(headerRow + 1, headerRow + 1 + MAX_ROWS).map((row, i) => {
    const person = get(row, 'name') || [get(row, 'lastName'), get(row, 'firstName')].filter(Boolean).join(' ');
    const company = get(row, 'company');
    const pro = !!company || isPro(get(row, 'kind'));
    const name = company || person;
    const notes = [company && person ? `Contact : ${person}` : '', get(row, 'notes')].filter(Boolean).join('\n');
    const client: ImportedClient = {
      kind: pro ? 'professionnel' : 'particulier',
      name,
      phone: formatPhone(get(row, 'phone') || get(row, 'phone2')),
      email: email(get(row, 'email')),
      address: [get(row, 'address'), get(row, 'address2')].filter(Boolean).join(', '),
      postalCode: postalCode(get(row, 'postalCode')),
      city: get(row, 'city'),
      notes,
    };
    const line = headerRow + i + 2; // numéro de ligne comme dans Excel
    if (!name) return { line, client, status: 'sans_nom' as const, reason: 'Pas de nom' };

    const keys = { phone: phoneKey(client.phone), email: emailKey(client.email), name: nameKey(client.name, client.postalCode) };
    const label = { phone: 'même téléphone', email: 'même e-mail', name: 'même nom et code postal' };
    let status: CandidateStatus = 'nouveau';
    let reason: string | undefined;
    for (const k of ['phone', 'email', 'name'] as const) {
      if (!keys[k]) continue;
      if (known[k].has(keys[k])) {
        status = 'doublon';
        reason = `Déjà dans le carnet (${label[k]})`;
        break;
      }
      if (seen[k].has(keys[k])) {
        status = 'doublon_fichier';
        reason = `Deux fois dans le fichier (${label[k]})`;
        break;
      }
    }
    if (status === 'nouveau') for (const k of ['phone', 'email', 'name'] as const) if (keys[k]) seen[k].add(keys[k]);
    return { line, client, status, reason };
  });
}

export function columnLabel(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
