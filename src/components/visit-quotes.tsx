import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { createQuoteFromVisit, VISIT_QUOTES_SQL } from '@/db/quotes';
import { toDate } from '@/domain/dates';
import { euros } from '@/domain/pricing';

type Q = { id: string; number: string | null; status: string; total_ttc_cents: number; created_at: string };
const STATUS: Record<string, string> = { brouillon: 'Brouillon', finalise: 'Finalisé', signe: '✓ Signé', refuse: 'Refusé' };

// Devis de la visite : création en un geste depuis les arbres relevés.
export function VisitQuotes({ visitId }: { visitId: string }) {
  const { data: quotes } = useQuery<Q>(VISIT_QUOTES_SQL, [visitId]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      const id = await createQuoteFromVisit(visitId);
      router.push({ pathname: '/devis/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={`Devis${quotes.length ? ` (${quotes.length})` : ''}`}>
      {quotes.map((q) => (
        <Pressable key={q.id} style={styles.item} onPress={() => router.push({ pathname: '/devis/[id]', params: { id: q.id } })} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{q.number ?? 'Brouillon'}</Text>
            <Text style={styles.sub}>
              {STATUS[q.status]} · {toDate(q.created_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>
          <Text style={styles.amount}>{euros(q.total_ttc_cents)}</Text>
        </Pressable>
      ))}
      {!quotes.length ? <Muted>Le devis reprend les arbres de la visite (intervention, contraintes, temps, déchets) et ajoute le déplacement.</Muted> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={busy ? 'Création…' : quotes.length ? 'Créer un nouveau devis' : 'Créer le devis'} onPress={create} disabled={busy} icon="document-text-outline" />
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  title: { fontSize: 17, fontWeight: '600', color: Colors.text },
  sub: { fontSize: 14, color: Colors.textSecondary },
  amount: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  error: { fontSize: 15, color: Colors.danger },
});
