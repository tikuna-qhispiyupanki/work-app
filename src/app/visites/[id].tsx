import { useQuery } from '@powersync/react';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { VISIT_DETAIL_SQL } from '@/db/visits';
import { VAT_ZONE_LABEL, VatZone } from '@/domain/vat';

type VisitDetail = {
  id: string;
  visited_at: string;
  client_name: string | null;
  client_phone: string | null;
  site_address: string | null;
  site_postal_code: string | null;
  site_city: string | null;
  vat_zone: VatZone;
  access_notes: string | null;
  notes: string | null;
  near_power_lines: number;
};

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<VisitDetail>(VISIT_DETAIL_SQL, [id]);
  const v = data[0];

  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!v) return <Muted>Visite introuvable.</Muted>;

  const when = new Date(v.visited_at).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title={v.client_name || 'Client sans nom'}>
        {v.client_phone ? <Muted>📞 {v.client_phone}</Muted> : null}
        <Muted>Visite du {when}</Muted>
      </Card>
      <Card title="Lieu du chantier">
        <Text style={styles.text}>
          {[v.site_address, [v.site_postal_code, v.site_city].filter(Boolean).join(' ')].filter(Boolean).join('\n') ||
            'Adresse à compléter'}
        </Text>
        <Muted>Zone : {VAT_ZONE_LABEL[v.vat_zone]}</Muted>
        {v.access_notes ? <Text style={styles.text}>Accès : {v.access_notes}</Text> : null}
        {v.near_power_lines ? <Text style={styles.warning}>⚠ Lignes électriques : DT-DICT à faire.</Text> : null}
      </Card>
      {v.notes ? (
        <Card title="Notes">
          <Text style={styles.text}>{v.notes}</Text>
        </Card>
      ) : null}
      <Muted>Arbres, croquis, photos et devis : étape 4.</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  text: { fontSize: 16, color: Colors.text },
  warning: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
});
