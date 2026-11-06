import { Ref } from 'react';
import { Text } from 'react-native';

import type { PlanImage } from '@/db/visits';
import { GeoPoint } from '@/domain/geo';

export type MapPickerHandle = { capture: () => Promise<PlanImage | null> };

// Version téléphone native : à faire quand l'application passera sur l'App Store.
export function MapPicker(_props: { point: GeoPoint; onMove: (p: GeoPoint) => void; onViewChange?: () => void; ref?: Ref<MapPickerHandle> }) {
  return <Text>Carte disponible dans la version web pour l&apos;instant.</Text>;
}
