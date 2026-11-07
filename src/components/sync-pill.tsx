import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { useSyncState } from '@/sync/use-sync-state';

const LOOK: Record<string, { icon: IconName; bg: string }> = {
  ok: { icon: 'cloud-done-outline', bg: 'rgba(255,255,255,0.18)' },
  starting: { icon: 'cloud-outline', bg: 'rgba(255,255,255,0.18)' },
  pending: { icon: 'cloud-upload-outline', bg: '#E0A23B' },
  sending: { icon: 'cloud-upload-outline', bg: '#E0A23B' },
  offline: { icon: 'cloud-offline-outline', bg: '#8A5A2B' },
  refused: { icon: 'warning-outline', bg: '#B3261E' },
};

// Pastille d'envoi dans l'en-tête de chaque écran. Un toucher ouvre le détail.
export function SyncPill() {
  const s = useSyncState();
  const look = LOOK[s.kind] ?? LOOK.ok;
  const alert = s.failures.length > 0;
  return (
    <Pressable
      onPress={() => router.push('/synchro')}
      accessibilityRole="button"
      accessibilityLabel={`Synchronisation : ${s.long}${alert ? ' Attention : modifications refusées.' : ''}`}
      style={[styles.pill, { backgroundColor: alert ? '#B3261E' : look.bg }]}
    >
      <Icon name={alert ? 'warning-outline' : look.icon} size={17} color="#FFFFFF" />
      <Text style={styles.text}>{s.short}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8 },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
