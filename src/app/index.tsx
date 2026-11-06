import { useQuery } from '@powersync/react';
import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { VISITS_LIST_SQL } from '@/db/visits';
import { toDate } from '@/domain/dates';

type VisitRow = {
  id: string;
  visited_at: string;
  site_city: string | null;
  site_address: string | null;
  status: string;
  client_name: string | null;
};

const isToday = (iso: string) => toDate(iso).toDateString() === new Date().toDateString();
const formatTime = (iso: string) =>
  toDate(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const formatDay = (iso: string) =>
  toDate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Accueil terrain : visites et chantiers du jour.
export default function HomeScreen() {
  const { data: visits, isLoading } = useQuery<VisitRow>(VISITS_LIST_SQL);
  const startOfToday = new Date(new Date().toDateString()).getTime();
  const today = visits.filter((v) => isToday(v.visited_at));
  const upcoming = visits.filter((v) => !isToday(v.visited_at) && toDate(v.visited_at).getTime() > startOfToday);
  const earlier = visits.filter((v) => toDate(v.visited_at).getTime() < startOfToday).reverse();

  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const label = date.charAt(0).toUpperCase() + date.slice(1);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.date}>{label}</Text>

      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 3 }}>
          <Button label="+ Nouvelle visite" onPress={() => router.push('/visites/nouvelle')} />
        </View>
        <View style={{ flex: 2 }}>
          <SecondaryButton label="📒 Clients" onPress={() => router.push('/clients')} />
        </View>
      </View>

      <Card title="Visites du jour">
        {isLoading ? <Muted>Chargement…</Muted> : null}
        {!isLoading && today.length === 0 ? <Muted>Aucune visite aujourd&apos;hui.</Muted> : null}
        {today.map((v) => (
          <VisitItem key={v.id} visit={v} when={formatTime(v.visited_at)} />
        ))}
      </Card>

      <Card title="Chantiers du jour">
        <Muted>Aucun chantier prévu aujourd&apos;hui.</Muted>
      </Card>

      {upcoming.length > 0 ? (
        <Card title="Visites à venir">
          {upcoming.map((v) => (
            <VisitItem key={v.id} visit={v} when={`${formatDay(v.visited_at)} ${formatTime(v.visited_at)}`} />
          ))}
        </Card>
      ) : null}

      {earlier.length > 0 ? (
        <Card title="Visites précédentes">
          {earlier.map((v) => (
            <VisitItem key={v.id} visit={v} when={formatDay(v.visited_at)} />
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function VisitItem({ visit, when }: { visit: VisitRow; when: string }) {
  return (
    <Link href={{ pathname: '/visites/[id]', params: { id: visit.id } }} asChild>
      <Pressable style={styles.item}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemTitle, visit.status === 'faite' && styles.done]}>
            {visit.status === 'faite' ? '✓ ' : ''}
            {visit.client_name || 'Client sans nom'}
          </Text>
          <Text style={styles.itemSub}>
            {[visit.site_address, visit.site_city].filter(Boolean).join(', ') || 'Adresse à compléter'}
          </Text>
        </View>
        <Text style={styles.itemSub}>{when}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  date: { fontSize: 18, color: Colors.textSecondary },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  itemTitle: { fontSize: 17, fontWeight: '500', color: Colors.text },
  itemSub: { fontSize: 14, color: Colors.textSecondary },
  done: { color: Colors.primary },
});
