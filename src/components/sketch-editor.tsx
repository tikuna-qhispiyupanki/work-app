import { Ref } from 'react';
import { Text } from 'react-native';

export type SketchHandle = { toJpeg: () => Promise<{ blob: Blob; width: number; height: number } | null>; strokes: () => number };
// Version native : à faire au passage sur l'App Store.
export function SketchEditor(_props: { background: Blob | null; ref?: Ref<SketchHandle> }) {
  return <Text>Croquis disponible dans la version web pour l&apos;instant.</Text>;
}
