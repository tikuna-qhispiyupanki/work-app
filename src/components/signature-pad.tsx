import { Ref } from 'react';
import { Text } from 'react-native';

export type SignaturePadHandle = { toJpeg: () => Promise<{ blob: Blob; width: number; height: number } | null>; hasInk: () => boolean };
// Version native : à faire au passage sur l'App Store.
export function SignaturePad(_props: { ref?: Ref<SignaturePadHandle>; onInk?: (has: boolean) => void }) {
  return <Text>Signature disponible dans la version web pour l&apos;instant.</Text>;
}
