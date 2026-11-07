import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

// Icônes homogènes de l'application (jeu « Ionicons », le même partout, hors-ligne compris).
export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}
