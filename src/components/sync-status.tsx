import { useStatus } from '@powersync/react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { POWERSYNC_URL } from '@/config/powersync';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db/database';
import { readSyncFailures } from '@/sync/connector';

// Bandeau du bas : réseau, envoi au serveur, et ce qui reste à envoyer.
export function SyncStatus() {
  const status = useStatus();
  const [pending, setPending] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [failures, setFailures] = useState(0);
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
      if (!alive) return;
      if (typeof navigator !== 'undefined') setOnline(navigator.onLine);
      setFailures(readSyncFailures().length);
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const sending = status.dataFlowStatus.uploading || status.dataFlowStatus.downloading;
  let text: string;
  if (pending === null) text = 'Préparation de la base locale…';
  else if (!POWERSYNC_URL) text = pending ? `${pending} modification${pending > 1 ? 's' : ''} en attente d'envoi (synchronisation pas encore branchée).` : 'Tout est enregistré sur le téléphone.';
  else if (!online) text = pending ? `${pending} modification${pending > 1 ? 's' : ''} à envoyer au retour du réseau.` : 'Tout est enregistré. Envoi automatique au retour du réseau.';
  else if (pending) text = sending || status.connected ? `Envoi en cours… ${pending} restante${pending > 1 ? 's' : ''}.` : `${pending} modification${pending > 1 ? 's' : ''} en attente d'envoi (connexion au serveur…).`;
  else if (status.connected) text = '✓ Tout est envoyé au serveur.';
  else text = 'Connexion au serveur…';

  const warn = failures > 0 || (!!pending && !online);
  return (
    <View style={[styles.bar, warn || (pending ?? 0) > 0 ? styles.pending : null, { paddingBottom: Spacing.sm + insets.bottom }]}>
      <Text style={styles.text}>
        {online ? '● En ligne' : '○ Hors ligne'} · {text}
      </Text>
      {failures ? (
        <Text style={styles.error}>
          ⚠ {failures} modification{failures > 1 ? 's' : ''} refusée{failures > 1 ? 's' : ''} par le serveur (voir Mon compte).
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: '#E7EFE6' },
  pending: { backgroundColor: '#F6E7D6' },
  text: { fontSize: 14, color: Colors.text },
  error: { fontSize: 13, color: Colors.danger, marginTop: 2 },
});
