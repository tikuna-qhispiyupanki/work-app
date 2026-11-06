// Géolocalisation, adresses et cartes (IGN Géoplateforme : gratuit, sans compte, couvre La Réunion).

export type GeoPoint = { lat: number; lng: number; accuracyM?: number | null };
export type FoundAddress = { address: string; postalCode: string; city: string; distanceM?: number };
export type MapLayer = 'plan' | 'aerien';

const GEOCODE = 'https://data.geopf.fr/geocodage';

// Position GPS du téléphone. Fonctionne sans réseau (le GPS ne dépend pas d'Internet).
export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error("Ce téléphone ne permet pas la géolocalisation."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Localisation refusée. Autorise-la dans Réglages > Confidentialité > Service de localisation > Safari.'
              : 'Position introuvable. Réessaie à découvert.'
          )
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

type GeoFeature = {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; postcode?: string; city?: string; distance?: number; label?: string };
};

const toAddress = (f: GeoFeature): FoundAddress => ({
  address: f.properties.name ?? '',
  postalCode: f.properties.postcode ?? '',
  city: f.properties.city ?? '',
  distanceM: f.properties.distance,
});

// Adresse la plus proche d'un point (nécessite le réseau).
export async function reverseGeocode(point: GeoPoint): Promise<FoundAddress | null> {
  const res = await fetch(`${GEOCODE}/reverse?lon=${point.lng}&lat=${point.lat}&limit=1`);
  if (!res.ok) throw new Error(`Service d'adresses indisponible (${res.status}).`);
  const data = (await res.json()) as { features: GeoFeature[] };
  return data.features[0] ? toAddress(data.features[0]) : null;
}

// Position d'une adresse saisie (nécessite le réseau).
export async function geocodeAddress(query: string): Promise<(FoundAddress & GeoPoint) | null> {
  const res = await fetch(`${GEOCODE}/search?q=${encodeURIComponent(query)}&limit=1`);
  if (!res.ok) throw new Error(`Service d'adresses indisponible (${res.status}).`);
  const data = (await res.json()) as { features: GeoFeature[] };
  const f = data.features[0];
  if (!f) return null;
  const [lng, lat] = f.geometry.coordinates;
  return { ...toAddress(f), lat, lng, accuracyM: null };
}

// --- Tuiles de carte (projection « Web Mercator », tuiles de 256 px) ---

export const TILE = 256;
export const MAX_ZOOM: Record<MapLayer, number> = { plan: 19, aerien: 19 };

export function tileUrl(layer: MapLayer, z: number, x: number, y: number): string {
  const [name, format] =
    layer === 'aerien'
      ? ['ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg']
      : ['GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'image/png'];
  return (
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
    `&LAYER=${name}&STYLE=normal&TILEMATRIXSET=PM&FORMAT=${encodeURIComponent(format)}` +
    `&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`
  );
}

// Point (lat, lng) → pixel « monde » au niveau de zoom z.
export function toWorldPx(p: GeoPoint, z: number): { x: number; y: number } {
  const size = TILE * 2 ** z;
  const lat = (p.lat * Math.PI) / 180;
  return {
    x: ((p.lng + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * size,
  };
}

// Pixel « monde » → point (lat, lng).
export function fromWorldPx(x: number, y: number, z: number): GeoPoint {
  const size = TILE * 2 ** z;
  const lng = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

// Tuiles nécessaires pour une vue de largeur × hauteur centrée sur le point.
export function tilesForView(center: GeoPoint, z: number, width: number, height: number) {
  const c = toWorldPx(center, z);
  const left = c.x - width / 2;
  const top = c.y - height / 2;
  const tiles: { x: number; y: number; left: number; top: number }[] = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
      tiles.push({ x: tx, y: ty, left: tx * TILE - left, top: ty * TILE - top });
    }
  }
  return { tiles, originX: left, originY: top };
}

export const formatPoint = (p: GeoPoint) =>
  `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}${p.accuracyM ? ` (précision ${p.accuracyM} m)` : ''}`;
