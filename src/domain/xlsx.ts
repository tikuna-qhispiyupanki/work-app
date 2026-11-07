import { unzipSync, strFromU8 } from 'fflate';

// Lecture minimale d'un classeur Excel (.xlsx) : valeurs des cellules de chaque onglet.
// Un .xlsx est une archive zip de fichiers XML. On lit les valeurs enregistrées
// (pour une formule : le dernier résultat calculé par Excel / Numbers / Google Sheets).

export type CellValue = string | number | null;
export type Sheet = Map<string, CellValue>; // clé : « A1 », « B12 »…
export type Workbook = Map<string, Sheet>; // clé : nom de l'onglet

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

// Texte d'un élément (concatène les morceaux <t>…</t>, ignore la phonétique <rPh>).
const textOf = (xml: string) =>
  decode(
    [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)]
      .map((m) => m[1] ?? '')
      .join('')
  );

export function readWorkbook(bytes: Uint8Array): Workbook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx) lisible.");
  }
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : null);
  const workbookXml = read('xl/workbook.xml');
  const relsXml = read('xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relsXml) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx) lisible.");

  const shared = [...(read('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const rels = new Map([...relsXml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]));

  const book: Workbook = new Map();
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = decode(attr(m[0], 'name') ?? '');
    const target = rels.get(attr(m[0], 'r:id'));
    if (!target) continue;
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const xml = read(path);
    if (!xml) continue;
    const sheet: Sheet = new Map();
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r');
      if (!ref) continue;
      const type = attr(c[1], 't');
      const body = c[2] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: CellValue = null;
      if (type === 's' && v != null) value = shared[Number(v)] ?? null;
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'str' || type === 'e') value = v != null ? decode(v) : null;
      else if (type === 'b') value = v === '1' ? 1 : 0;
      else if (v != null && v !== '') value = Number(v);
      sheet.set(ref, value);
    }
    book.set(name, sheet);
  }
  return book;
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name.replace(':', '\\:')}="([^"]*)"`).exec(` ${tag}`);
  return m?.[1];
}
