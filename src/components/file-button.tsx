import { Text } from 'react-native';

// Version native : à faire avec expo-document-picker au passage sur l'App Store.
export function FileButton(_props: { label: string; accept: string; onFile: (f: File) => void; disabled?: boolean }) {
  return <Text>Import de fichier disponible dans la version web pour l&apos;instant.</Text>;
}
