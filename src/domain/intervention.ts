// Fiche d'intervention élagage / abattage (décret 2021-1833) : listes de choix et textes pré-remplis.
// Les textes proposés sont un point de départ : le chef d'entreprise les relit et les adapte au chantier.
// L'application aide à respecter la réglementation ; la décision et la responsabilité restent celles de l'employeur.

export const RESPONSIBILITY =
  "L'application aide à respecter la réglementation, mais la décision et la responsabilité restent celles de l'employeur.";

export type RiskKey =
  | 'lignes_electriques' | 'voirie' | 'batiments' | 'piscine_clotures' | 'pente' | 'arbre_degrade' | 'insectes' | 'meteo'
  | 'chute_hauteur' | 'chute_objets' | 'tronconneuse' | 'bruit' | 'public' | 'travailleur_isole';

export const RISKS: { key: RiskKey; label: string; prevention: string }[] = [
  { key: 'chute_hauteur', label: 'Chute de hauteur (travail dans l\'arbre)', prevention: 'Grimpeur encordé en permanence (deux points d\'attache lors des déplacements avec la tronçonneuse), ancrage contrôlé, EPI vérifiés.' },
  { key: 'chute_objets', label: 'Chute de branches, de bois ou d\'outils', prevention: 'Zone de chute balisée et interdite pendant la coupe, casque pour tous, communication grimpeur / sol avant chaque descente.' },
  { key: 'tronconneuse', label: 'Coupure (tronçonneuse, élagueuse)', prevention: 'Pantalon, gants et chaussures anti-coupure, frein de chaîne vérifié, tronçonneuse attachée au baudrier dans l\'arbre.' },
  { key: 'lignes_electriques', label: 'Lignes électriques à proximité', prevention: 'DT-DICT faite avant les travaux, distance de sécurité respectée, consignation demandée au gestionnaire si besoin. Aucune branche ne doit toucher la ligne.' },
  { key: 'voirie', label: 'Voie publique, circulation', prevention: 'Balisage et signalisation de la zone, homme au sol pour gérer piétons et véhicules, arrêté de voirie si nécessaire.' },
  { key: 'batiments', label: 'Bâtiments, toitures à proximité', prevention: 'Démontage par petites sections, rétention des branches (cordes, poulie), protection des toitures.' },
  { key: 'piscine_clotures', label: 'Piscine, clôture, véhicules sous l\'arbre', prevention: 'Rétention des branches, protection ou déplacement des biens, couverture de la piscine.' },
  { key: 'pente', label: 'Terrain en pente ou instable', prevention: 'Repérage des appuis, chaussures adaptées, bois débité et calé pour qu\'il ne roule pas.' },
  { key: 'arbre_degrade', label: 'Arbre mort, creux ou abîmé', prevention: 'Diagnostic avant la montée, ancrage sur un arbre voisin ou nacelle si l\'arbre n\'est pas sûr, abattage contrôlé.' },
  { key: 'insectes', label: 'Insectes (guêpes, frelons), animaux', prevention: 'Inspection avant la montée, trousse de secours, personne allergique signalée, traitement du nid si nécessaire.' },
  { key: 'meteo', label: 'Météo (vent, pluie, orage, chaleur)', prevention: 'Arrêt des travaux par vent fort ou orage, eau et pauses par forte chaleur.' },
  { key: 'bruit', label: 'Bruit, vibrations', prevention: 'Protections auditives, rotation des tâches.' },
  { key: 'public', label: 'Présence du client ou du public', prevention: 'Zone de travail balisée, consignes données au client, personne ne s\'approche sans accord du chef d\'équipe.' },
  { key: 'travailleur_isole', label: 'Travailleur isolé', prevention: 'Jamais seul : au moins une personne au sol formée au sauvetage pendant tout le travail en hauteur.' },
];

export const EQUIPMENT = [
  'Tronçonneuse', 'Élagueuse (petite tronçonneuse)', 'Scie à main / sécateur', 'Cordes, baudriers, longes', 'Poulies et matériel de rétention',
  'Kit de sauvetage', 'Grimpettes', 'Nacelle', 'Broyeur', 'Rogneuse de souche', 'Camion / remorque', 'Balisage et signalisation', 'Trousse de premiers secours',
];

export const DEFAULT_ACCIDENT_PROCEDURE = [
  '1. Protéger : arrêter les machines, sécuriser la zone, ne pas se mettre en danger.',
  '2. Alerter : appeler le 15 (SAMU), le 18 (pompiers) ou le 112. Donner l\'adresse exacte, le point de rendez-vous et l\'état de la victime.',
  '3. Secourir : gestes de premiers secours ; victime dans l\'arbre : descente par le sauveteur désigné avec le kit de sauvetage.',
  '4. Envoyer quelqu\'un accueillir les secours au point de rendez-vous.',
  '5. Prévenir le chef d\'entreprise.',
].join('\n');

export const DEFAULT_RESCUE = [
  'Sauveteur désigné au sol, formé au sauvetage dans l\'arbre, présent pendant tout le travail en hauteur.',
  'Kit de sauvetage prêt au pied de l\'arbre, trousse de premiers secours dans le véhicule.',
  'Téléphone chargé et réseau vérifié sur place (sinon : point d\'appel repéré).',
  'Accès des secours : voir point de rendez-vous ci-dessous.',
].join('\n');

export type RisksValue = { checked: RiskKey[]; other: string };
export type EquipmentValue = { checked: string[]; other: string };

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(s) as T) };
  } catch {
    return fallback;
  }
}

// Mesures de prévention proposées pour les risques cochés.
export function preventionFor(checked: RiskKey[]): string {
  return RISKS.filter((r) => checked.includes(r.key))
    .map((r) => `• ${r.label} : ${r.prevention}`)
    .join('\n');
}

export type SheetPrefillInput = {
  siteAddress: string | null;
  lat: number | null;
  lng: number | null;
  works: string[]; // libellés des prestations du devis
  nearPowerLines: boolean;
  start: string | null;
  end: string | null;
  usesRopes: boolean;
};

// Contenu pré-rempli d'une nouvelle fiche, à partir de la visite et du devis.
export function prefillSheet(i: SheetPrefillInput) {
  const checked: RiskKey[] = ['chute_objets', 'tronconneuse', 'travailleur_isole'];
  if (i.usesRopes) checked.unshift('chute_hauteur');
  if (i.nearPowerLines) checked.push('lignes_electriques');
  const location = [i.siteAddress, i.lat != null && i.lng != null ? `GPS ${i.lat.toFixed(5)}, ${i.lng.toFixed(5)}` : null].filter(Boolean).join('\n');
  return {
    location,
    works: i.works.map((w) => `• ${w}`).join('\n'),
    equipment: JSON.stringify({ checked: ['Tronçonneuse', 'Cordes, baudriers, longes', 'Kit de sauvetage', 'Balisage et signalisation', 'Trousse de premiers secours'], other: '' } satisfies EquipmentValue),
    risks: JSON.stringify({ checked, other: '' } satisfies RisksValue),
    prevention: preventionFor(checked),
    accident_procedure: DEFAULT_ACCIDENT_PROCEDURE,
    rescue: DEFAULT_RESCUE,
    emergency_contacts: 'SAMU 15 · Pompiers 18 · Urgences 112\nHôpital le plus proche : \nPoint de rendez-vous des secours : ',
    start_date: i.start,
    end_date: i.end,
  };
}

// Ce qui manque pour pouvoir signer la fiche.
export function missingSheetFields(s: { location?: string | null; works?: string | null; start_date?: string | null; end_date?: string | null; risks?: string | null; prevention?: string | null; accident_procedure?: string | null; rescue?: string | null }): string[] {
  const m: string[] = [];
  if (!s.location?.trim()) m.push('emplacement');
  if (!s.works?.trim()) m.push('travaux');
  if (!s.start_date || !s.end_date) m.push('dates de début et de fin');
  if (s.start_date && s.end_date && s.end_date < s.start_date) m.push('date de fin avant la date de début');
  const r = parseJson<RisksValue>(s.risks, { checked: [], other: '' });
  if (!r.checked.length && !r.other.trim()) m.push('risques');
  if (!s.prevention?.trim()) m.push('mesures de prévention');
  if (!s.accident_procedure?.trim()) m.push('conduite à tenir en cas d\'accident');
  if (!s.rescue?.trim()) m.push('organisation des secours');
  return m;
}

// Fin de conservation : 2 ans après la signature.
export function retainUntil(signedAt: Date): string {
  const d = new Date(signedAt);
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
}

// Textes par défaut d'une entreprise (enregistrés depuis une fiche qu'elle a adaptée).
export type SheetDefaults = { equipment?: string; risks?: string; prevention?: string; accident_procedure?: string; rescue?: string };
export const DEFAULT_KEYS = ['equipment', 'risks', 'prevention', 'accident_procedure', 'rescue'] as const;

// Applique les textes de l'entreprise sur le pré-remplissage. Les risques propres au chantier
// (lignes électriques signalées à la visite) restent cochés en plus des risques habituels.
export function applyDefaults<T extends Record<string, string | null>>(prefill: T, defaults: SheetDefaults | null, nearPowerLines: boolean): T {
  if (!defaults) return prefill;
  const out: Record<string, string | null> = { ...prefill };
  for (const k of DEFAULT_KEYS) if (defaults[k]) out[k] = defaults[k] ?? null;
  if (defaults.risks && nearPowerLines) {
    const r = parseJson<RisksValue>(defaults.risks, { checked: [], other: '' });
    if (!r.checked.includes('lignes_electriques')) {
      r.checked.push('lignes_electriques');
      out.risks = JSON.stringify(r);
      const pl = RISKS.find((x) => x.key === 'lignes_electriques')!;
      out.prevention = [out.prevention, `• ${pl.label} : ${pl.prevention}`].filter(Boolean).join('\n');
    }
  }
  return out as T;
}
