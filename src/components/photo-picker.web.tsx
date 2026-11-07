import { useRef } from 'react';
import { View } from 'react-native';

import { SecondaryButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';

// Boutons « Prendre une photo » (appareil photo) et « Choisir » (galerie, plusieurs à la fois).
export function PhotoPicker({ onPicked, disabled }: { onPicked: (files: File[]) => void; disabled?: boolean }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de reprendre la même photo
    if (files.length) onPicked(files);
  };
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
      <input ref={camera} type="file" accept="image/*" capture="environment" onChange={handle} style={{ display: 'none' }} aria-label="Prendre une photo" />
      <input ref={gallery} type="file" accept="image/*" multiple onChange={handle} style={{ display: 'none' }} aria-label="Choisir des photos" />
      <View style={{ flex: 1 }}>
        <SecondaryButton label="Prendre une photo" icon="camera-outline" onPress={() => camera.current?.click()} disabled={disabled} />
      </View>
      <View style={{ flex: 1 }}>
        <SecondaryButton label="Choisir" icon="image-outline" onPress={() => gallery.current?.click()} disabled={disabled} />
      </View>
    </View>
  );
}
