import { useQuery } from '@powersync/react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { confirmAction } from '@/components/confirm';

import { Button, Card, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { archiveClient, CLIENT_DETAIL_SQL, CLIENT_VISITS_SQL, ClientRow } from '@/db/clients';
import { CLIENT_QUOTES_SQL } from '@/db/quotes';
import { euros } from '@/domain/pricing';
import { toDate } from '@/domain/dates';

type HistoryRow = { id: string; visited_at: string; status: string; site_address: string | null; site_city: string | null; notes: string | null; tree_count: number };

// Fiche client et historique de ses visites (plus tard : devis et chantiers).
export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<ClientRow>(CLIENT_DETAIL_SQL, [id]);
  const { data: history } = useQuery<HistoryRow>(CLIENT_VISITS_SQL, [id]);
  const { data: quotes } = useQuery<{ id: string; number: string | null; status: string; total_ttc_cents: number; created_at: string }>(CLIENT_QUOTES_SQL, [id]);
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
        {c.kind === 'professionnel' ? <Muted>Client professionnel</Muted> : null}
        <View style={styles.actions}>
          {c.phone ? <QuickAction label="📞 Appeler" url={`tel:${c.phone.replace(/\s/g, '')}`} /> : null}
          {c.phone ? <QuickAction label="💬 SMS" url={`sms:${c.phone.replace(/\s/g, '')}`} /> : null}
          {c.email ? <QuickAction label="✉️ E-mail" url={`mailto:${c.email}`} /> : null}
          {c.address || c.city ? (
            <QuickAction label="🧭 Itinéraire" url={`https://maps.apple.com/?daddr=${encodeURIComponent([c.address, c.postal_code, c.city].filter(Boolean).join(' '))}`} />
          ) : null}
        </View>
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
                  {toDate(h.visited_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
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
      </Card>

      <Card title={`Devis (${quotes.length})`}>
        {quotes.length === 0 ? <Muted>Aucun devis.</Muted> : null}
        {quotes.map((q) => (
          <Pressable key={q.id} style={styles.item} onPress={() => router.push({ pathname: '/devis/[id]', params: { id: q.id } })}>
            <Text style={styles.name}>
              {q.number ?? 'Brouillon'} · {euros(q.total_ttc_cents)}
            </Text>
            <Text style={styles.sub}>{{ brouillon: 'Brouillon', finalise: 'Finalisé', signe: '✓ Signé', refuse: 'Refusé' }[q.status] ?? q.status}</Text>
          </Pressable>
        ))}
        <Muted>Les chantiers apparaîtront ici à l&apos;étape 5.</Muted>
      </Card>

      <Button label="+ Nouvelle visite pour ce client" onPress={() => router.push({ pathname: '/visites/nouvelle', params: { client: c.id } })} />
      <SecondaryButton
        label="Retirer du carnet"
        danger
        onPress={async () => {
          const msg = history.length
            ? `Le client n'apparaîtra plus dans le carnet ni dans les suggestions. Ses ${history.length} visite${history.length > 1 ? 's restent consultables' : ' reste consultable'}.`
            : "Le client n'apparaîtra plus dans le carnet ni dans les suggestions.";
          if (await confirmAction(`Retirer ${c.name || 'ce client'} du carnet ?`, msg, 'Retirer')) {
            await archiveClient(c.id);
            router.back();
          }
        }}
      />
    </ScrollView>
  );
}

function QuickAction({ label, url }: { label: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={styles.action} accessibilityRole="link">
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  action: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.card },
  actionText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  text: { fontSize: 16, color: Colors.text },
  item: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  name: { fontSize: 17, fontWeight: '500', color: Colors.text },
  sub: { fontSize: 14, color: Colors.textSecondary },
});
