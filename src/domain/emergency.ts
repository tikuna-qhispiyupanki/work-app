// Services d'urgences les plus proches du chantier, calculés sur le téléphone (sans réseau).
// Liste des hôpitaux publics avec service d'urgences à La Réunion ; positions : IGN (BD TOPO), relevées le 07/11/2026.
// À faire vérifier par le fondateur ; ailleurs qu'à La Réunion, le champ reste à compléter à la main.

export type Hospital = { name: string; city: string; lat: number; lng: number };

export const HOSPITALS_974: Hospital[] = [
  { name: 'CHU Félix-Guyon (urgences)', city: 'Saint-Denis', lat: -20.891208, lng: 55.444059 },
  { name: 'CHU Sud Réunion (urgences)', city: 'Saint-Pierre', lat: -21.345685, lng: 55.493981 },
  { name: 'Centre hospitalier Ouest Réunion – CHOR (urgences)', city: 'Saint-Paul', lat: -20.976756, lng: 55.300252 },
  { name: 'Groupe hospitalier Est Réunion – GHER (urgences)', city: 'Saint-Benoît', lat: -21.056784, lng: 55.710068 },
];

// Distance à vol d'oiseau (km).
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Le plus proche, seulement si le chantier est à La Réunion (sinon null).
export function nearestHospital(site: { lat: number; lng: number }): (Hospital & { km: number }) | null {
  const inReunion = site.lat < -20.7 && site.lat > -21.5 && site.lng > 55.1 && site.lng < 55.9;
  if (!inReunion) return null;
  return HOSPITALS_974.map((h) => ({ ...h, km: distanceKm(site, h) })).sort((a, b) => a.km - b.km)[0];
}

// Bloc « numéros utiles » de la fiche d'intervention.
export function emergencyBlock(site: { address: string | null; lat: number | null; lng: number | null }): string {
  const h = site.lat != null && site.lng != null ? nearestHospital({ lat: site.lat, lng: site.lng }) : null;
  return [
    'SAMU 15 · Pompiers 18 · Urgences 112',
    h ? `Urgences les plus proches : ${h.name}, ${h.city} (≈ ${Math.round(h.km)} km à vol d'oiseau)` : 'Urgences les plus proches : ',
    `Point de rendez-vous des secours : ${site.address ?? ''}${site.lat != null && site.lng != null ? ` – GPS ${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}` : ''}`,
  ].join('\n');
}
