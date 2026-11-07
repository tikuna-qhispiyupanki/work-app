import { Text } from 'react-native';

// Version native : à faire avec expo-image-picker au passage sur l'App Store.
export function PhotoPicker(_props: { onPicked: (files: File[]) => void; disabled?: boolean }) {
  return <Text>Photos disponibles dans la version web pour l&apos;instant.</Text>;
}
