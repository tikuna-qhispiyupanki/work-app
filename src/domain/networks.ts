// Travaux près des réseaux et sur la voie publique : DT-DICT, AIPR, découverte fortuite, arrêté de voirie.
// Arboject aide à préparer ; la déclaration officielle se fait sur le guichet unique (gratuit), et la décision
// comme la responsabilité restent celles de l'employeur. Délais et règles à vérifier sur le guichet unique.

export const GUICHET_UNIQUE_URL = 'https://www.reseaux-et-canalisations.ineris.fr';

export type DtDictStatus = 'a_faire' | 'envoyee' | 'recepisses' | 'non_concerne';
export const DT_DICT_STATUS_LABEL: Record<DtDictStatus, string> = {
  a_faire: 'À faire',
  envoyee: 'Déclaration envoyée',
  recepisses: 'Récépissés reçus',
  non_concerne: 'Pas concerné',
};

// Informations à saisir sur le guichet unique, prêtes à copier.
export function dtDictFields(o: {
  siteAddress: string | null; lat: number | null; lng: number | null; start: string | null; end: string | null; works: string[];
  company: { name?: string | null; siret?: string | null; address?: string | null; postal_code?: string | null; city?: string | null; phone?: string | null; email?: string | null };
  manager?: string | null; nearPowerLines: boolean;
}): { label: string; value: string }[] {
  const fr = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
  const nature = [
    "Travaux d'élagage et/ou d'abattage d'arbres",
    o.nearPowerLines ? 'à proximité de lignes électriques aériennes' : null,
    o.works.length ? `(${o.works.join(' ; ')})` : null,
  ].filter(Boolean).join(' ');
  return [
    { label: 'Adresse des travaux', value: o.siteAddress ?? '' },
    { label: 'Coordonnées GPS', value: o.lat != null && o.lng != null ? `${o.lat.toFixed(6)}, ${o.lng.toFixed(6)}` : '' },
    { label: 'Dates prévues', value: [fr(o.start), fr(o.end)].filter(Boolean).join(' au ') },
    { label: 'Nature des travaux', value: nature },
    { label: 'Techniques', value: "Élagage / abattage manuel ou mécanisé (tronçonneuse, nacelle) ; pas de terrassement sauf rognage ou dessouchage" },
    { label: 'Entreprise', value: [o.company.name, o.company.siret ? `SIRET ${o.company.siret}` : null].filter(Boolean).join(' – ') },
    { label: 'Adresse de l\'entreprise', value: [o.company.address, [o.company.postal_code, o.company.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') },
    { label: 'Contact', value: [o.manager, o.company.phone, o.company.email].filter(Boolean).join(' – ') },
  ].filter((f) => f.value);
}

// AIPR : attestation de compétence (QCM dans un centre agréé, valable 5 ans), puis autorisation délivrée par l'employeur.
export type AiprProfile = 'operateur' | 'encadrant' | 'concepteur';
export const AIPR_LABEL: Record<AiprProfile, string> = { operateur: 'Opérateur', encadrant: 'Encadrant', concepteur: 'Concepteur' };
export type AiprState = 'ok' | 'bientot' | 'expiree' | 'absente';

export function aiprState(m: { aipr_profile: string | null; aipr_valid_until: string | null }, today = new Date()): AiprState {
  if (!m.aipr_profile || !m.aipr_valid_until) return 'absente';
  const end = new Date(`${m.aipr_valid_until.slice(0, 10)}T23:59:59`);
  if (end < today) return 'expiree';
  if (end.getTime() - today.getTime() < 90 * 86400000) return 'bientot';
  return 'ok';
}

export function aiprText(m: { aipr_profile: string | null; aipr_valid_until: string | null }, today = new Date()): string {
  const s = aiprState(m, today);
  if (s === 'absente') return 'AIPR non renseignée';
  const d = m.aipr_valid_until!.slice(0, 10).split('-').reverse().join('/');
  const p = AIPR_LABEL[m.aipr_profile as AiprProfile] ?? m.aipr_profile;
  return s === 'expiree' ? `AIPR ${p} expirée depuis le ${d}` : `AIPR ${p} jusqu'au ${d}${s === 'bientot' ? ' (à renouveler bientôt)' : ''}`;
}

// Intervenants sans AIPR valide (à signaler sur un chantier près des réseaux).
export function membersWithoutAipr<T extends { name: string; aipr_profile: string | null; aipr_valid_until: string | null }>(team: T[], today = new Date()): T[] {
  return team.filter((m) => ['absente', 'expiree'].includes(aiprState(m, today)));
}

// Découverte fortuite d'un réseau (non signalé ou mal localisé).
export const NETWORK_TYPES: { key: string; label: string; color: string }[] = [
  { key: 'electricite', label: 'Électricité', color: 'rouge' },
  { key: 'gaz', label: 'Gaz, hydrocarbures', color: 'jaune' },
  { key: 'eau', label: 'Eau potable', color: 'bleu' },
  { key: 'assainissement', label: 'Assainissement', color: 'marron' },
  { key: 'telecom', label: 'Télécom', color: 'vert' },
  { key: 'chauffage', label: 'Chauffage, climatisation', color: 'violet' },
  { key: 'autre', label: 'Autre', color: '' },
  { key: 'inconnu', label: 'Je ne sais pas', color: '' },
];

export const FINDING_STEPS = [
  'Arrêter immédiatement les travaux à proximité (machines à l\'arrêt). Ne pas toucher, ne pas déplacer le réseau.',
  'Éloigner les personnes et baliser la zone. Gaz : pas de flamme, pas d\'étincelle, ne pas actionner d\'appareil électrique ; s\'éloigner contre le vent.',
  'Si le réseau est endommagé ou en cas de danger (fuite, fils à nu, électrisation) : appeler les secours (18 ou 112) et le numéro d\'urgence de l\'exploitant (sur le récépissé de DT-DICT).',
  'Prévenir l\'exploitant du réseau et le responsable du chantier / le chef d\'entreprise.',
  'Ne reprendre les travaux qu\'avec l\'accord de l\'exploitant. Faire un constat (photos, position, description) : c\'est ce formulaire.',
];

// Demande d'arrêté temporaire de circulation / stationnement (travaux sur ou au bord de la voie publique).
export type RoadPermit = {
  mairie: string; road: string; from: string; to: string; hours: string; occupation: string; measures: string[]; other: string; contact: string;
};
export const ROAD_MEASURES = [
  'Interdiction de stationner au droit du chantier',
  'Circulation alternée (feux tricolores ou piquets K10)',
  'Rétrécissement de chaussée',
  'Fermeture temporaire de la voie avec déviation',
  'Neutralisation du trottoir, piétons déviés',
  'Coupures ponctuelles de la circulation (quelques minutes, pendant la chute des branches)',
];

export function defaultRoadPermit(o: { city: string | null; siteAddress: string | null; start: string | null; end: string | null; contact: string | null }): RoadPermit {
  return {
    mairie: o.city ? `Mairie de ${o.city}` : 'Mairie de ',
    road: o.siteAddress ?? '',
    from: o.start ?? '',
    to: o.end ?? o.start ?? '',
    hours: '7h30 – 16h30',
    occupation: "Véhicule de l'entreprise, broyeur et zone de chute des branches sur la chaussée et le trottoir, au droit du chantier",
    measures: [ROAD_MEASURES[0], ROAD_MEASURES[5]],
    other: '',
    contact: o.contact ?? '',
  };
}

// Corps de la lettre de demande (le PDF reprend ce texte).
export function roadPermitLetter(p: RoadPermit, o: { company: string; works: string }): string[] {
  const fr = (d: string) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '…');
  return [
    'Madame, Monsieur le Maire,',
    `Notre entreprise ${o.company} doit réaliser des travaux d'élagage / abattage d'arbres (${o.works || 'travaux sur la végétation'}) à l'adresse suivante : ${p.road || '…'}.`,
    `Ces travaux nécessitent une occupation temporaire du domaine public du ${fr(p.from)} au ${fr(p.to)}, de ${p.hours || '…'} : ${p.occupation || '…'}.`,
    `Nous sollicitons un arrêté temporaire de circulation et de stationnement prévoyant les mesures suivantes : ${[...p.measures, p.other].filter(Boolean).join(' ; ') || '…'}.`,
    "La signalisation temporaire et le balisage du chantier seront mis en place et entretenus par nos soins, conformément à la réglementation (« Danger. Risque de chute d'arbre ou de branches. Chantier interdit au public »).",
    `Personne à contacter : ${p.contact || '…'}.`,
    "Nous vous prions d'agréer, Madame, Monsieur le Maire, l'expression de nos salutations distinguées.",
  ];
}
