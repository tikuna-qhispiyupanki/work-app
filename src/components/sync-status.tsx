import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db/database';

// Bandeau « à envoyer » : nombre de modifications enregistrées sur le téléphone
// mais pas encore envoyées au serveur. La synchronisation arrive à l'étape 2c.
export function SyncStatus() {
  const [pending, setPending] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const insets = useSafeAreaInsets(); // marge pour la barre du bas de l'iPhone

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const stats = await db.getUploadQueueStats();
        if (alive) setPending(stats.count);
      } catch {
        // base pas encore prête
      }
      if (alive && typeof navigator !== 'undefined') setOnline(navigator.onLine);
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const text =
    pending === null
      ? 'Préparation de la base locale…'
      : pending === 0
        ? 'Tout est enregistré sur le téléphone.'
        : `${pending} modification${pending > 1 ? 's' : ''} en attente d'envoi (synchronisation pas encore branchée).`;

  return (
    <View style={[styles.bar, pending ? styles.pending : null, { paddingBottom: Spacing.sm + insets.bottom }]}>
      <Text style={styles.text}>
        {online ? '● En ligne' : '○ Hors ligne'} · {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: '#E7EFE6' },
  pending: { backgroundColor: '#F6E7D6' },
  text: { fontSize: 14, color: Colors.text },
});
