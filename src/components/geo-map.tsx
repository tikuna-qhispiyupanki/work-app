import { Ref } from 'react';
import { Text } from 'react-native';

import type { PlanImage } from '@/db/visits';
import { GeoPoint } from '@/domain/geo';

export type MapMarker = { id: string; lat: number; lng: number; kind: 'site' | 'tree'; label?: string; title?: string; selected?: boolean };
export type GeoMapHandle = { capture: () => Promise<PlanImage | null> };

// Version téléphone native : à faire quand l'application passera sur l'App Store.
export function GeoMap(_props: {
  center: GeoPoint;
  markers: MapMarker[];
  onTap?: (p: GeoPoint) => void;
  onViewChange?: () => void;
  hint?: string;
  ref?: Ref<GeoMapHandle>;
}) {
  return <Text>Carte disponible dans la version web pour l&apos;instant.</Text>;
}
