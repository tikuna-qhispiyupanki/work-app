import { useQuery } from '@powersync/react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { CLIENT_DETAIL_SQL, CLIENT_VISITS_SQL, ClientRow } from '@/db/clients';

type HistoryRow = { id: string; visited_at: string; status: string; site_address: string | null; site_city: string | null; notes: string | null; tree_count: number };

// Fiche client et historique de ses visites (plus tard : devis et chantiers).
export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<ClientRow>(CLIENT_DETAIL_SQL, [id]);
  const { data: history } = useQuery<HistoryRow>(CLIENT_VISITS_SQL, [id]);
  const c = data[0];

  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!c) return <Muted>Client introuvable.</Muted>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title={c.name || 'Client sans nom'}>
        {c.phone ? <Muted>📞 {c.phone}</Muted> : null}
        {c.email ? <Muted>✉️ {c.email}</Muted> : null}
        {c.address || c.city ? <Muted>🏠 {[c.address, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</Muted> : null}
        {c.notes ? <Text style={styles.text}>{c.notes}</Text> : null}
        <SecondaryButton label="Modifier la fiche" onPress={() => router.push({ pathname: '/clients/[id]/modifier', params: { id: c.id } })} />
      </Card>

      <Card title={`Historique (${history.length} visite${history.length > 1 ? 's' : ''})`}>
        {history.length === 0 ? <Muted>Aucune visite.</Muted> : null}
        {history.map((h) => (
          <Link key={h.id} href={{ pathname: '/visites/[id]', params: { id: h.id } }} asChild>
            <Pressable style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {h.status === 'faite' ? '✓ ' : ''}
                  {new Date(h.visited_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <Text style={styles.sub}>
                  {[[h.site_address, h.site_city].filter(Boolean).join(', '), h.tree_count ? `${h.tree_count} arbre${h.tree_count > 1 ? 's' : ''}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Adresse à compléter'}
                </Text>
                {h.notes ? (
                  <Text style={styles.sub} numberOfLines={2}>
                    {h.notes}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </Link>
        ))}
        <Muted>Devis et chantiers apparaîtront ici à partir des étapes 4 et 5.</Muted>
      </Card>

      <Button label="+ Nouvelle visite pour ce client" onPress={() => router.push({ pathname: '/visites/nouvelle', params: { client: c.id } })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  text: { fontSize: 16, color: Colors.text },
  item: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  name: { fontSize: 17, fontWeight: '500', color: Colors.text },
  sub: { fontSize: 14, color: Colors.textSecondary },
});
