import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useSyncState } from '@/sync/use-sync-state';

// Détail de l'envoi au serveur (ouvert depuis la pastille de l'en-tête).
export default function SyncScreen() {
  const s = useSyncState();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title={s.online ? 'En ligne' : 'Hors ligne'}>
        <Text style={styles.big}>{s.long}</Text>
        <Muted>Modifications en attente : {s.pending}</Muted>
        <Muted>Photos en attente : {s.photos}</Muted>
        <Muted>
          Tout ce que tu saisis est d&apos;abord enregistré sur le téléphone, puis envoyé au serveur dès qu&apos;il y a du réseau. Garde
          l&apos;application ouverte quelques secondes pour que l&apos;envoi se termine.
        </Muted>
      </Card>
      {s.failures.length ? (
        <Card title="Modifications refusées par le serveur">
          {s.failures.slice(-10).map((f, i) => (
            <Muted key={i}>
              {new Date(f.at).toLocaleString('fr-FR')} · {f.table} · {f.message}
            </Muted>
          ))}
          <Muted>Envoie une capture de cet écran : ces lignes aident à corriger le problème.</Muted>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  big: { fontSize: 17, fontWeight: '600', color: Colors.text },
});
