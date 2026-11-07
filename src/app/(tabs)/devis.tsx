import { useQuery } from '@powersync/react';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { QuoteItem } from '@/components/list-items';
import { Segmented } from '@/components/segmented';
import { Card, Muted } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { QUOTES_LIST_SQL, QuoteListRow } from '@/db/lists';
import { euros } from '@/domain/pricing';

type Filter = 'tous' | 'brouillon' | 'finalise' | 'signe' | 'refuse';

// Tous les devis, filtrés par état.
export default function QuotesScreen() {
  const [filter, setFilter] = useState<Filter>('tous');
  const { data, isLoading } = useQuery<QuoteListRow>(QUOTES_LIST_SQL);
  const count = (s: Filter) => (s === 'tous' ? data.length : data.filter((q) => q.status === s).length);
  const list = filter === 'tous' ? data : data.filter((q) => q.status === filter);
  const signedTotal = data.filter((q) => q.status === 'signe').reduce((a, q) => a + q.total_ttc_cents, 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        items={[
          { key: 'tous', label: 'Tous', count: count('tous') },
          { key: 'brouillon', label: 'Brouillons', count: count('brouillon') },
          { key: 'finalise', label: 'À signer', count: count('finalise') },
          { key: 'signe', label: 'Signés', count: count('signe') },
          { key: 'refuse', label: 'Refusés', count: count('refuse') },
        ]}
      />
      <Card>
        {isLoading ? <Muted>Chargement…</Muted> : null}
        {!isLoading && !list.length ? <Muted>Aucun devis. Un devis se crée depuis une visite (onglet « Devis » de la visite).</Muted> : null}
        {list.map((q) => (
          <QuoteItem key={q.id} q={q} />
        ))}
      </Card>
      {signedTotal ? <Muted>Total des devis signés : {euros(signedTotal)}</Muted> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl } });
