import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QuoteItem, VisitItem } from '@/components/list-items';
import { Button, Card, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { QUOTES_LIST_SQL, QuoteListRow, VISITS_SEARCH_SQL, VisitListRow } from '@/db/lists';
import { toDate } from '@/domain/dates';

const DAY = 86400000;

// Accueil : la journée, la semaine, les devis à faire signer et les brouillons.
export default function HomeScreen() {
  const { data: visits, isLoading } = useQuery<VisitListRow>(VISITS_SEARCH_SQL, ['', '', '', '']);
  const { data: quotes } = useQuery<QuoteListRow>(QUOTES_LIST_SQL);
  const start = new Date(new Date().toDateString()).getTime();
  const t = (v: VisitListRow) => toDate(v.visited_at).getTime();
  const today = visits.filter((v) => t(v) >= start && t(v) < start + DAY);
  const week = visits.filter((v) => t(v) >= start + DAY && t(v) < start + 8 * DAY && v.status !== 'faite');
  const toSign = quotes.filter((q) => q.status === 'finalise');
  const drafts = quotes.filter((q) => q.status === 'brouillon');
  const label = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.date}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
      <Button label="Nouvelle visite" icon="add-circle-outline" onPress={() => router.push('/visites/nouvelle')} />

      <View style={styles.stats}>
        <Stat n={today.length} label="aujourd'hui" />
        <Stat n={week.length} label="cette semaine" />
        <Stat n={toSign.length} label="devis à signer" warn={toSign.length > 0} />
      </View>

      <Card title="Aujourd'hui">
        {isLoading ? <Muted>Chargement…</Muted> : null}
        {!isLoading && !today.length ? <Muted>Aucune visite aujourd&apos;hui.</Muted> : null}
        {today.map((v) => (
          <VisitItem key={v.id} v={v} />
        ))}
      </Card>

      {week.length ? (
        <Card title="Les 7 prochains jours">
          {week.map((v) => (
            <VisitItem key={v.id} v={v} showDate />
          ))}
        </Card>
      ) : null}

      {toSign.length ? (
        <Card title="Devis à faire signer">
          {toSign.slice(0, 5).map((q) => (
            <QuoteItem key={q.id} q={q} />
          ))}
        </Card>
      ) : null}

      {drafts.length ? (
        <Card title="Devis en brouillon">
          {drafts.slice(0, 5).map((q) => (
            <QuoteItem key={q.id} q={q} />
          ))}
        </Card>
      ) : null}

      <Card title="Chantiers">
        <Muted>Les chantiers arrivent à l&apos;étape 5 (fiche d&apos;intervention).</Muted>
      </Card>
    </ScrollView>
  );
}

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <View style={[styles.stat, warn && { borderColor: '#E0A23B', backgroundColor: '#FBF1E1' }]}>
      <Text style={[styles.statN, warn && { color: '#8A5A2B' }]}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  date: { fontSize: 18, color: Colors.textSecondary },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center' },
  statN: { fontSize: 26, fontWeight: '700', color: Colors.primary },
  statL: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
});
