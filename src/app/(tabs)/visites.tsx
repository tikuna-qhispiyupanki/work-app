import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { VisitItem } from '@/components/list-items';
import { Segmented } from '@/components/segmented';
import { Button, Card, Field, Muted } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { VISITS_SEARCH_SQL, VisitListRow } from '@/db/lists';
import { toDate } from '@/domain/dates';

type Filter = 'a_venir' | 'faites' | 'toutes';

// Toutes les visites, avec recherche et filtre.
export default function VisitsScreen() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('a_venir');
  const s = q.trim();
  const { data, isLoading } = useQuery<VisitListRow>(VISITS_SEARCH_SQL, [s, s, s, s]);
  const start = new Date(new Date().toDateString()).getTime();
  const upcoming = data.filter((v) => v.status !== 'faite' && toDate(v.visited_at).getTime() >= start);
  const done = [...data.filter((v) => v.status === 'faite' || toDate(v.visited_at).getTime() < start)].reverse();
  const list = filter === 'a_venir' ? upcoming : filter === 'faites' ? done : [...data].reverse();

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Button label="Nouvelle visite" icon="add-circle-outline" onPress={() => router.push('/visites/nouvelle')} />
      <Field label="Rechercher (client, adresse, commune)" value={q} onChangeText={setQ} autoCapitalize="none" />
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        items={[
          { key: 'a_venir', label: 'À venir', count: upcoming.length },
          { key: 'faites', label: 'Faites ou passées', count: done.length },
          { key: 'toutes', label: 'Toutes', count: data.length },
        ]}
      />
      <Card>
        {isLoading ? <Muted>Chargement…</Muted> : null}
        {!isLoading && !list.length ? <Muted>{s ? 'Aucune visite trouvée.' : 'Aucune visite.'}</Muted> : null}
        {list.map((v) => (
          <VisitItem key={v.id} v={v} showDate />
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl } });
