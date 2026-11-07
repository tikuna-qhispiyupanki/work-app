// Fiche d'intervention élagage / abattage (décret 2021-1833) : listes de choix et textes pré-remplis.
// Les textes proposés sont un point de départ : le chef d'entreprise les relit et les adapte au chantier.
// L'application aide à respecter la réglementation ; la décision et la responsabilité restent celles de l'employeur.

export const RESPONSIBILITY =
  "L'application aide à respecter la réglementation, mais la décision et la responsabilité restent celles de l'employeur.";

// Les listes reprennent le modèle de fiche de la notice MSA (réf. 12350, octobre 2023).

export type RiskGroup = 'travail' | 'reseaux' | 'environnement' | 'coactivite' | 'biologique' | 'arbres';
export const RISK_GROUP_LABEL: Record<RiskGroup, string> = {
  travail: 'Travail en hauteur et outils',
  reseaux: 'Réseaux aériens et souterrains',
  environnement: 'Environnement du chantier',
  coactivite: 'Co-activité dans la zone de sécurité',
  biologique: 'Risque biologique',
  arbres: 'État des arbres',
};

export type RiskKey =
  | 'lignes_electriques' | 'voirie' | 'batiments' | 'piscine_clotures' | 'pente' | 'arbre_degrade' | 'insectes' | 'meteo'
  | 'chute_hauteur' | 'chute_objets' | 'tronconneuse' | 'bruit' | 'public' | 'travailleur_isole'
  | 'reseau_htb' | 'reseau_hta' | 'reseau_bt' | 'reseau_eau' | 'reseau_gaz' | 'reseau_telecom'
  | 'eclairage' | 'poussieres' | 'noyade' | 'entrainement_machines' | 'projections'
  | 'chenilles' | 'berce' | 'tiques' | 'suie_erable' | 'chancre_platane';

export const RISKS: { key: RiskKey; group: RiskGroup; label: string; prevention: string }[] = [
  { key: 'chute_hauteur', group: 'travail', label: 'Chute de hauteur (travail dans l\'arbre)', prevention: 'Grimpeur encordé en permanence (deux points d\'attache lors des déplacements avec la tronçonneuse), ancrage contrôlé, EPI vérifiés.' },
  { key: 'chute_objets', group: 'travail', label: 'Chute de branches, de bois ou d\'outils', prevention: 'Zone de chute balisée et interdite pendant la coupe, casque pour tous, communication grimpeur / sol avant chaque descente.' },
  { key: 'tronconneuse', group: 'travail', label: 'Coupure (tronçonneuse, élagueuse)', prevention: 'Pantalon, gants et chaussures anti-coupure, frein de chaîne vérifié, tronçonneuse attachée au baudrier dans l\'arbre.' },
  { key: 'bruit', group: 'travail', label: 'Bruit, vibrations', prevention: 'Protections auditives, rotation des tâches.' },
  { key: 'travailleur_isole', group: 'travail', label: 'Travailleur isolé', prevention: 'Jamais seul : au moins une personne au sol formée au sauvetage pendant tout le travail en hauteur.' },
  { key: 'lignes_electriques', group: 'reseaux', label: 'Lignes électriques à proximité', prevention: 'DT-DICT faite avant les travaux, AIPR, distance de sécurité respectée vis-à-vis des conducteurs nus (HTB > 50 000 V : 5 m ; HTA et BT : 3 m), consignation demandée au gestionnaire si besoin. Aucune branche ne doit toucher la ligne.' },
  { key: 'reseau_htb', group: 'reseaux', label: 'Ligne HTB (plus de 50 000 V) : distance 5 m', prevention: 'Distance de sécurité de 5 m vis-à-vis des conducteurs nus, DT-DICT, consignation par le gestionnaire.' },
  { key: 'reseau_hta', group: 'reseaux', label: 'Ligne HTA (jusqu\'à 50 000 V) : distance 3 m', prevention: 'Distance de sécurité de 3 m vis-à-vis des conducteurs nus, DT-DICT.' },
  { key: 'reseau_bt', group: 'reseaux', label: 'Ligne BT (jusqu\'à 1 000 V) : distance 3 m', prevention: 'Distance de sécurité de 3 m vis-à-vis des conducteurs nus, DT-DICT.' },
  { key: 'reseau_eau', group: 'reseaux', label: 'Réseau d\'eau, vapeur', prevention: 'DT-DICT si arrachage de souche ou creusement ; formulaire de découverte fortuite de réseau.' },
  { key: 'reseau_gaz', group: 'reseaux', label: 'Réseau de gaz', prevention: 'DT-DICT si arrachage de souche ou creusement ; arrêt immédiat et alerte en cas de découverte.' },
  { key: 'reseau_telecom', group: 'reseaux', label: 'Réseau télécom', prevention: 'DT-DICT ; distance aux câbles, rétention des branches.' },
  { key: 'voirie', group: 'environnement', label: 'Routier : voie publique, circulation', prevention: 'Balisage et signalisation de la zone (« Danger. Risque de chute d\'arbre ou de branches. Chantier interdit au public »), homme au sol pour gérer piétons et véhicules, arrêté de voirie si nécessaire.' },
  { key: 'batiments', group: 'environnement', label: 'Bâtiments, toitures à proximité', prevention: 'Démontage par petites sections, rétention des branches (cordes, poulie), protection des toitures.' },
  { key: 'piscine_clotures', group: 'environnement', label: 'Piscine, clôture, véhicules sous l\'arbre', prevention: 'Rétention des branches, protection ou déplacement des biens, couverture de la piscine.' },
  { key: 'pente', group: 'environnement', label: 'État des sols (pentes, terrain instable)', prevention: 'Repérage des appuis, chaussures adaptées, bois débité et calé pour qu\'il ne roule pas.' },
  { key: 'meteo', group: 'environnement', label: 'Facteurs météo ambiants (vent, pluie, chaleur)', prevention: 'Arrêt des travaux par vent fort ou orage, eau et pauses par forte chaleur.' },
  { key: 'public', group: 'environnement', label: 'Présence du client ou du public', prevention: 'Zone de travail balisée, consignes données au client, personne ne s\'approche sans accord du chef d\'équipe.' },
  { key: 'eclairage', group: 'environnement', label: 'Éclairage insuffisant', prevention: 'Adaptation des heures de travail, éclairage d\'appoint.' },
  { key: 'poussieres', group: 'environnement', label: 'Poussières, vapeurs', prevention: 'Masque adapté, travail dos au vent.' },
  { key: 'noyade', group: 'environnement', label: 'Noyade (bord de cours d\'eau, ravine)', prevention: 'Équipement individuel de flottaison, bouée, pas de travail seul au bord de l\'eau.' },
  { key: 'entrainement_machines', group: 'coactivite', label: 'Entraînement par les machines (broyeur, rogneuse)', prevention: 'Respect des consignes et du manuel des machines, une seule personne alimente le broyeur, arrêt d\'urgence vérifié.' },
  { key: 'projections', group: 'coactivite', label: 'Projections (broyeur, rogneuse)', prevention: 'Distance de sécurité autour des machines, visière et lunettes, répartition des tâches dans le temps et l\'espace.' },
  { key: 'insectes', group: 'biologique', label: 'Frelons, guêpes et autres hyménoptères', prevention: 'Inspection avant la montée, personne allergique signalée, appel à un spécialiste pour détruire le nid si nécessaire.' },
  { key: 'chenilles', group: 'biologique', label: 'Chenilles processionnaires', prevention: 'EPI appropriés (masque, combinaison, gants), appel à un spécialiste.' },
  { key: 'berce', group: 'biologique', label: 'Berce du Caucase, ambroisie…', prevention: 'Gants, manches longues, pas de contact avec la peau.' },
  { key: 'tiques', group: 'biologique', label: 'Tiques', prevention: 'Vêtements couvrants, inspection de la peau après le chantier.' },
  { key: 'suie_erable', group: 'biologique', label: 'Suie de l\'érable', prevention: 'Masque FFP3, combinaison, appel à un spécialiste.' },
  { key: 'chancre_platane', group: 'biologique', label: 'Chancre du platane', prevention: 'Désinfection des outils (certibiocide si produits biocides), évacuation des déchets selon les règles.' },
  { key: 'arbre_degrade', group: 'arbres', label: 'Arbre mort, creux, affaibli (ancrage, branches, tronc)', prevention: 'Diagnostic avant la montée, ancrage sur un arbre voisin ou nacelle si l\'arbre n\'est pas sûr, abattage contrôlé.' },
];

// Travaux à réaliser (modèle MSA).
export const ACTIVITIES = [
  'Éhoupage', 'Élagage de formation', 'Élagage d\'entretien', 'Haubanage', 'Démontage avec rétention', 'Démontage sans rétention',
  'Abattage directionnel', 'Abattage non directionnel', 'Ébranchage', 'Billonnage', 'Broyage', 'Évacuation des rémanents', 'Rognage / essouchage',
];

// Matériels (modèle MSA, en 3 familles) + matériel de sécurité.
export const EQUIPMENT_GROUPS: { title: string; items: string[] }[] = [
  { title: 'Moyens d\'élévation', items: ['Nacelle (PEMP)', 'PIRL', 'EPI de grimper', 'Échelle (moyen d\'accès seulement)'] },
  { title: 'Matériels de coupe', items: ['Tronçonneuse élagueuse', 'Tronçonneuse abatteuse', 'Lamier d\'élagage', 'Scie perche', 'Sécateur'] },
  { title: 'Matériels autres', items: ['Broyeur', 'Essoucheuse / rogneuse', 'Treuil / câble', 'Mini chargeur', 'Souffleur', 'Camion / remorque'] },
  { title: 'Sécurité', items: ['Cordes, poulies et matériel de rétention', 'Kit de sauvetage', 'Balisage et signalisation', 'Trousse de premiers secours'] },
];
export const EQUIPMENT = EQUIPMENT_GROUPS.flatMap((g) => g.items);

// Matières : état sanitaire et physiologique des arbres (modèle MSA).
export const TREE_CHECKS = [
  'Repérer la présence de bois morts ou dépérissants sur les sujets à traiter (ou à proximité)',
  'Identifier les affections dangereuses pour la santé et la sécurité (suie, chancre, capricorne, champignon lignivore…)',
  'Évaluer l\'état d\'ancrage des arbres (enracinement)',
];

// Mesures de prévention et règles d'organisation (modèle MSA).
export const MEASURES = [
  'DT-DICT (déclaration de travaux à proximité des réseaux)',
  'AIPR (autorisation d\'intervention à proximité des réseaux)',
  'Distance de sécurité vis-à-vis des conducteurs nus (HTB 5 m ; HTA et BT 3 m)',
  'Balisage externe (panneaux d\'interdiction d\'accès et signalisation du danger)',
  'Balisage interne (limiter les risques de chute d\'objets sur l\'homme de pied)',
  'Balisage du chantier sur voie publique',
  'Surveillance de l\'accès au chantier (intrusion du public)',
  'Répartition des tâches dans le temps et l\'espace (travailleurs / matériel)',
  'Respect des consignes de sécurité des machines (manuel d\'utilisation)',
  'Adaptation des heures de travail',
  'Eau en quantité suffisante',
  'Cabinet d\'aisance à disposition',
  'Vêtements de travail spécifiques (haute visibilité, pluie, froid…)',
  'Signal d\'alarme (sifflet)',
  'Équipement de flottaison / bouée',
  'Plan de prévention (entreprise utilisatrice)',
];

// Organisation des secours : ressources humaines et matérielles (modèle MSA).
export const RESCUE_CHECKS = [
  'Trousse de secours (contenu approprié à l\'activité)',
  'Kit d\'urgence portatif (élagueur)',
  'Tous les travailleurs sur le chantier sont Sauveteurs Secouristes du Travail (SST)',
  'Travailleurs Grimpeurs Sauveteurs dans l\'Arbre (GSA) et moyens pour porter secours, en nombre suffisant',
  'Moyen de communication fonctionnel',
];

export type CheckValue = { checked: string[]; other: string };

// Conduite à tenir en cas d'accident : « Protéger, Alerter, Secourir », d'après la notice MSA
// « La fiche d'intervention lors des chantiers d'élagage et d'abattage » (réf. 12350, octobre 2023).
export const DEFAULT_ACCIDENT_PROCEDURE = [
  '1. PROTÉGER',
  '- Sécuriser les travaux en cours, puis arrêter les travaux (machines à l\'arrêt).',
  '- Protéger les zones dangereuses (balisage, interdiction d\'accès).',
  '- Prévenir le responsable du chantier ou le chef d\'entreprise.',
  '2. ALERTER : SAMU 15 · Pompiers 18 · Police 17 · Europe 112 · 114 par SMS (sourd, malentendant, ne peut pas parler)',
  '- Dire qui on est (nom, prénom, entreprise).',
  '- Donner le lieu exact (adresse, GPS) et les moyens d\'accès.',
  '- Décrire l\'accident (chute, coupure, électrisation, écrasement…).',
  '- Dire le nombre de blessés et leur état (conscient ? respire ? saigne ?).',
  '- Dire les gestes de premiers secours en cours.',
  '- Fixer le rendez-vous au point de rencontre des secours.',
  '- Ne jamais raccrocher le premier : attendre les instructions des secours.',
  '3. SECOURIR',
  '- Intervenir sans s\'exposer (sauveteur secouriste du travail, grimpeur sauveteur dans l\'arbre).',
  '- Préparer l\'arrivée et l\'accès des secours (dégager rémanents et matériel, envoyer quelqu\'un au point de rencontre).',
  '- Prévenir le siège des entreprises (donneur d\'ordre et entreprise qui réalise le chantier).',
  '- Ne pas déplacer ni transporter la victime sans l\'accord des secours.',
].join('\n');

export const DEFAULT_RESCUE = [
  '- Trousse de secours adaptée à l\'activité : dans le véhicule (préciser où).',
  '- Kit de sauvetage d\'élagueur prêt au pied de l\'arbre.',
  '- Sauveteur secouriste du travail (SST) présent ; grimpeur sauveteur capable de descendre une victime de l\'arbre.',
  '- Moyen de communication vérifié sur place (réseau mobile, sinon point d\'appel repéré).',
  '- Véhicules garés dans le sens du départ, voie d\'accès laissée libre pour les secours.',
].join('\n');

// 7e élément de la notice MSA : intempéries et phénomènes météo imprévus.
export const DEFAULT_WEATHER = [
  '- Consulter la vigilance Météo-France avant le chantier (vent, fortes pluies, orages ; à La Réunion : alertes cycloniques).',
  '- En cas de vent fort, orage ou forte pluie : sécuriser les travaux en cours, puis arrêter.',
  '- Protéger les zones dangereuses (balisage, interdiction d\'accès).',
  '- Descendre de l\'arbre et se mettre à l\'abri ; prévenir le responsable du chantier ou le chef d\'entreprise.',
  '- Reprendre seulement quand les conditions sont de nouveau favorables (accord du chef de chantier).',
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
  clientName?: string | null;
  clientPhone?: string | null;
  companyPhone?: string | null;
  manager?: { name: string; phone: string | null } | null;
  workersCount?: number | null;
};

// Activités du modèle MSA reconnues dans les libellés du devis.
export function activitiesFromWorks(works: string[]): string[] {
  const t = works.join('\n').toLowerCase();
  const out: string[] = [];
  const add = (a: string) => !out.includes(a) && out.push(a);
  if (/démontage[^\n]*sans rétention/.test(t)) add('Démontage sans rétention');
  else if (/démontage/.test(t)) add('Démontage avec rétention');
  if (/abattage/.test(t)) add('Abattage directionnel');
  if (/élagage|taille|palmier|cocotier/.test(t)) add('Élagage d\'entretien');
  if (/formation/.test(t)) add('Élagage de formation');
  if (/haubanage/.test(t)) add('Haubanage');
  if (/rognage|souche|essouch/.test(t)) add('Rognage / essouchage');
  if (/broy/.test(t)) add('Broyage');
  if (/évacuation|déchets/.test(t)) add('Évacuation des rémanents');
  return out;
}

const json = (checked: string[], other = '') => JSON.stringify({ checked, other } satisfies CheckValue);

// Contenu pré-rempli d'une nouvelle fiche, à partir de la visite, du devis, du chantier et de l'entreprise.
export function prefillSheet(i: SheetPrefillInput) {
  const checked: RiskKey[] = ['chute_objets', 'tronconneuse', 'travailleur_isole'];
  if (i.usesRopes) checked.unshift('chute_hauteur');
  if (i.nearPowerLines) checked.push('lignes_electriques');
  const gps = i.lat != null && i.lng != null ? `GPS ${i.lat.toFixed(5)}, ${i.lng.toFixed(5)}` : null;
  const location = [i.siteAddress, gps].filter(Boolean).join('\n');
  const measures = [
    'Balisage externe (panneaux d\'interdiction d\'accès et signalisation du danger)',
    'Balisage interne (limiter les risques de chute d\'objets sur l\'homme de pied)',
    'Surveillance de l\'accès au chantier (intrusion du public)',
    'Répartition des tâches dans le temps et l\'espace (travailleurs / matériel)',
    'Respect des consignes de sécurité des machines (manuel d\'utilisation)',
  ];
  if (i.nearPowerLines) measures.unshift(MEASURES[0], MEASURES[1], MEASURES[2]);
  return {
    location,
    works: i.works.map((w) => `• ${w}`).join('\n'),
    activities: json(activitiesFromWorks(i.works)),
    equipment: json(['EPI de grimper', 'Tronçonneuse élagueuse', 'Cordes, poulies et matériel de rétention', 'Kit de sauvetage', 'Balisage et signalisation', 'Trousse de premiers secours']),
    trees_state: json([...TREE_CHECKS]),
    risks: JSON.stringify({ checked, other: '' } satisfies RisksValue),
    prevention: preventionFor(checked),
    measures: json(measures),
    communication_mode: 'À la voix et par gestes convenus ; casques communicants si le bruit l\'impose.',
    accident_procedure: DEFAULT_ACCIDENT_PROCEDURE,
    rescue: DEFAULT_RESCUE,
    rescue_checks: json([RESCUE_CHECKS[0], RESCUE_CHECKS[1], RESCUE_CHECKS[4]]),
    first_aid_location: 'Dans le véhicule de l\'entreprise',
    meeting_point: [i.siteAddress, gps].filter(Boolean).join(' – '),
    weather_procedure: DEFAULT_WEATHER,
    emergency_contacts: 'SAMU 15 · Pompiers 18 · Police 17 · Europe 112 · 114 par SMS',
    start_date: i.start,
    end_date: i.end,
    client_name: i.clientName ?? null,
    client_phone: i.clientPhone ?? null,
    company_phone: i.companyPhone ?? null,
    site_manager_name: i.manager?.name ?? null,
    site_manager_phone: i.manager?.phone ?? null,
    workers_count: i.workersCount ?? null,
    start_time: null as string | null,
    end_time: null as string | null,
    observations: null as string | null,
  };
}

type SheetLike = {
  location?: string | null; works?: string | null; start_date?: string | null; end_date?: string | null; risks?: string | null; prevention?: string | null;
  accident_procedure?: string | null; rescue?: string | null; weather_procedure?: string | null; company_phone?: string | null; site_manager_name?: string | null;
  meeting_point?: string | null;
};

// Ce qui manque pour pouvoir signer la fiche (éléments obligatoires + identification du modèle MSA).
export function missingSheetFields(s: SheetLike): string[] {
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
  if (s.weather_procedure !== undefined && !s.weather_procedure?.trim()) m.push('consignes en cas d\'intempéries');
  if (s.company_phone !== undefined && !s.company_phone?.trim()) m.push('téléphone en cas d\'incident');
  if (s.site_manager_name !== undefined && !s.site_manager_name?.trim()) m.push('responsable sur le chantier');
  if (s.meeting_point !== undefined && !s.meeting_point?.trim()) m.push('point de rencontre des secours');
  return m;
}

// Fin de conservation : 2 ans après la signature.
export function retainUntil(signedAt: Date): string {
  const d = new Date(signedAt);
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
}

// Textes par défaut d'une entreprise (enregistrés depuis une fiche qu'elle a adaptée).
export type SheetDefaults = Partial<Record<(typeof DEFAULT_KEYS)[number], string>>;
export const DEFAULT_KEYS = ['equipment', 'risks', 'prevention', 'measures', 'communication_mode', 'accident_procedure', 'rescue', 'rescue_checks', 'first_aid_location', 'weather_procedure'] as const;

// Applique les textes de l'entreprise sur le pré-remplissage. Les risques propres au chantier
// (lignes électriques signalées à la visite) restent cochés en plus des risques habituels.
export function applyDefaults<T extends Record<string, string | number | null>>(prefill: T, defaults: SheetDefaults | null, nearPowerLines: boolean): T {
  if (!defaults) return prefill;
  const out: Record<string, string | number | null> = { ...prefill };
  for (const k of DEFAULT_KEYS) if (defaults[k]) out[k] = defaults[k] ?? null;
  if (defaults.measures && nearPowerLines) {
    const m = parseJson<CheckValue>(defaults.measures, { checked: [], other: '' });
    for (const x of MEASURES.slice(0, 3)) if (!m.checked.includes(x)) m.checked.unshift(x);
    out.measures = JSON.stringify(m);
  }
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
