import { DEFAULT_PARAMS, heightsFromLabel, suggestedPriceCents } from './pricing';
import type { GridParams, SourceBasis } from './pricing';
import { readWorkbook } from './xlsx';
import type { CellValue, Sheet } from './xlsx';

// Lecture de la grille tarifaire Excel d'Arboject (« Grille_tarifaire_elagage_Reunion_2026.xlsx »).
// On lit les données brutes (fourchettes, base HT/TTC, « Mon prix », paramètres) et on RECALCULE
// le prix conseillé avec la même formule qu'Excel. Si Excel donnait un autre résultat, on le signale.

export type ImportedItem = {
  sortOrder: number;
  label: string;
  category: string | null;
  unit: string | null;
  minCents: number | null;
  maxCents: number | null;
  basis: SourceBasis;
  suggestedCents: number;
  myPriceCents: number | null;
  heightMin: number | null;
  heightMax: number | null;
  secondSource: string | null;
  source: string | null;
};

export type ImportedGrid = { params: GridParams; items: ImportedItem[]; warnings: string[] };

const cents = (v: CellValue) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : null);
const bp = (v: CellValue) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10000) : null);
const text = (v: CellValue | undefined) => (v == null ? null : String(v).trim() || null);

// Paramètres : on cherche chaque ligne par son libellé (colonne A), pas par sa position.
const PARAMS: [RegExp, keyof GridParams, (v: CellValue) => number | null][] = [
  [/^taux horaire élagueur/i, 'rateClimberCents', cents],
  [/^taux horaire homme au sol/i, 'rateGroundCents', cents],
  [/^forfait déplacement/i, 'travelFlatCents', cents],
  [/^évacuation déchets verts/i, 'wastePerM3Cents', cents],
  [/^votre coût de dépôt/i, 'wasteCostPerM3Cents', cents],
  [/^tva hexagone/i, 'vatHexagoneBp', bp],
  [/^coefficient réunion/i, 'coefBp', bp],
  [/^majoration tronc/i, 'surchargeBigTrunkBp', bp],
  [/^majoration urgence/i, 'surchargeUrgentBp', bp],
];

function findSheet(book: Map<string, Sheet>, pattern: RegExp): Sheet {
  for (const [name, sheet] of book) if (pattern.test(name)) return sheet;
  throw new Error(`Onglet introuvable : ${pattern.source.replace(/[\\^$]/g, '')}. Ce fichier n'a pas la forme de la grille Arboject.`);
}

export function importGridWorkbook(bytes: Uint8Array): ImportedGrid {
  const book = readWorkbook(bytes);
  const warnings: string[] = [];

  // 1. Paramètres
  const ps = findSheet(book, /^param/i);
  const params: GridParams = { ...DEFAULT_PARAMS };
  for (let row = 1; row <= 60; row++) {
    const label = text(ps.get(`A${row}`));
    if (!label) continue;
    for (const [re, key, conv] of PARAMS) {
      if (!re.test(label)) continue;
      const value = conv(ps.get(`B${row}`) ?? null);
      if (value != null) params[key] = value;
      else warnings.push(`Paramètre « ${label} » vide : valeur par défaut gardée.`);
    }
  }
  // Majoration rétention : l'Excel la calcule (30,01 %) ; Arboject utilise 30 % par défaut, modifiable dans l'application.

  // 2. Tarifs de base : en-tête « Prestation… » puis une ligne par prestation
  const ts = findSheet(book, /^tarifs/i);
  let header = 0;
  for (let row = 1; row <= 20 && !header; row++) if (/^prestation/i.test(text(ts.get(`A${row}`)) ?? '')) header = row;
  if (!header) throw new Error("En-tête « Prestation » introuvable dans l'onglet « Tarifs de base ».");

  const items: ImportedItem[] = [];
  for (let row = header + 1; row <= header + 300; row++) {
    const label = text(ts.get(`A${row}`));
    if (!label) continue;
    const minCents = cents(ts.get(`D${row}`) ?? null);
    const maxCents = cents(ts.get(`E${row}`) ?? null);
    const basis: SourceBasis = /ttc/i.test(text(ts.get(`F${row}`)) ?? '') ? 'TTC 20 %' : 'HT';
    if (minCents == null || maxCents == null) {
      warnings.push(`« ${label} » : fourchette de prix incomplète, ligne ignorée.`);
      continue;
    }
    const suggestedCents = suggestedPriceCents(minCents, maxCents, basis, params);
    const excelSuggested = cents(ts.get(`H${row}`) ?? null);
    if (excelSuggested != null && excelSuggested !== suggestedCents) {
      warnings.push(`« ${label} » : Excel indique ${excelSuggested / 100} €, Arboject calcule ${suggestedCents / 100} €.`);
    }
    const h = heightsFromLabel(label);
    items.push({
      sortOrder: items.length,
      label,
      category: text(ts.get(`B${row}`)),
      unit: text(ts.get(`C${row}`)),
      minCents,
      maxCents,
      basis,
      suggestedCents,
      myPriceCents: cents(ts.get(`I${row}`) ?? null),
      heightMin: h.min,
      heightMax: h.max,
      secondSource: text(ts.get(`K${row}`)),
      source: text(ts.get(`L${row}`)),
    });
  }
  if (!items.length) throw new Error("Aucune prestation trouvée dans l'onglet « Tarifs de base ».");
  return { params, items, warnings };
}
