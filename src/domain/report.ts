// Rapport de fin de chantier (étape 6) : textes proposés, à relire et adapter.

export const DEFAULT_ADVICE = [
  '- Prochaine taille d\'entretien conseillée dans 2 à 3 ans (palmiers et cocotiers : chaque année, palmes sèches et noix).',
  '- Après un cyclone ou un fort coup de vent : vérifier les branches cassées ou pendantes et nous appeler en cas de doute.',
  '- Surveiller l\'apparition de champignons au pied ou sur le tronc, de fissures ou d\'un écoulement : signe de fragilité.',
  '- Ne pas planter de clous, ne pas fixer de câbles ni de guirlandes serrées sur le tronc et les branches.',
  '- Ne pas tasser ni recouvrir la terre au pied de l\'arbre (stationnement, remblai, béton).',
].join('\n');

export type ReportPhoto = { stage: string | null; caption: string | null };
export const STAGE_LABEL: Record<string, string> = { avant: 'Avant', pendant: 'Pendant', apres: 'Après' };

// Travaux réalisés, repris du devis (les prestations, sans les lignes de temps ni le déplacement).
export function worksFromQuote(lines: { label: string; kind: string; quantity: number; unit: string | null }[]): string {
  return lines
    .filter((l) => ['prestation', 'libre', 'location'].includes(l.kind))
    .map((l) => `• ${l.label}${l.quantity !== 1 && l.unit ? ` (${String(l.quantity).replace('.', ',')} ${l.unit})` : ''}`)
    .join('\n');
}

// Photos à mettre dans le rapport, dans l'ordre avant → pendant → après.
export function orderPhotos<T extends ReportPhoto & { taken_at?: string }>(photos: T[]): T[] {
  const rank = (s: string | null) => (s === 'avant' ? 0 : s === 'pendant' ? 1 : s === 'apres' ? 2 : 3);
  return [...photos].sort((a, b) => rank(a.stage) - rank(b.stage) || (a.taken_at ?? '').localeCompare(b.taken_at ?? ''));
}
