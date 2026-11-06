import { useQuery } from '@powersync/react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { addToCalendar } from '@/components/add-to-calendar';
import { confirmAction } from '@/components/confirm';
import { LocalImage } from '@/components/local-image';
import { Button, Card, Muted, SecondaryButton } from '@/components/ui';
import { VisitTrees } from '@/components/visit-trees';
import { Colors, Spacing } from '@/constants/theme';
import { deleteVisit, setVisitStatus, VISIT_DETAIL_SQL, VISIT_PLAN_SQL } from '@/db/visits';
import { formatPoint } from '@/domain/geo';
import { VAT_ZONE_LABEL, VatZone } from '@/domain/vat';

type VisitDetail = {
  id: string;
  client_id: string;
  client_email: string | null;
  visited_at: string;
  status: string;
  client_name: string | null;
  client_phone: string | null;
  site_address: string | null;
  site_postal_code: string | null;
  site_city: string | null;
  site_lat: number | null;
  site_lng: number | null;
  site_accuracy_m: number | null;
  vat_zone: VatZone;
  access_notes: string | null;
  notes: string | null;
  near_power_lines: number;
};

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<VisitDetail>(VISIT_DETAIL_SQL, [id]);
  const { data: plans } = useQuery<{ id: string; width: number; height: number }>(VISIT_PLAN_SQL, [id]);
  const v = data[0];
  const plan = plans[0];
  const { data: others } = useQuery<{ n: number }>(
    'SELECT COUNT(*) AS n FROM visits WHERE client_id = ? AND id <> ? AND deleted_at IS NULL',
    [v?.client_id ?? '', id]
  );
  const otherVisits = others[0]?.n ?? 0;

  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!v) return <Muted>Visite introuvable (elle a peut-être été supprimée).</Muted>;

  const done = v.status === 'faite';
  const when = new Date(v.visited_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

  const remove = async () => {
    const ok = await confirmAction(
      'Supprimer cette visite ?',
      `${v.client_name || 'Client sans nom'} – ${when}`,
      'Supprimer'
    );
    if (!ok) return;
    await deleteVisit(v.id);
    router.dismissTo('/');
  };

  const address = [v.site_address, [v.site_postal_code, v.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const calendar = () =>
    addToCalendar(
      {
        uid: `visite-${v.id}@arboject`,
        start: new Date(v.visited_at),
        durationMinutes: 60,
        title: `Visite élagage – ${v.client_name || 'client'}`,
        location: address || undefined,
        description: [
          v.client_phone ? `Tél. ${v.client_phone}` : null,
          v.access_notes ? `Accès : ${v.access_notes}` : null,
          v.near_power_lines ? 'Lignes électriques : DT-DICT à faire' : null,
          v.notes || null,
        ]
          .filter(Boolean)
          .join('\n'),
        lat: v.site_lat,
        lng: v.site_lng,
        alarmsMinutesBefore: [24 * 60, 60],
      },
      'visite-arboject.ics'
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title={v.client_name || 'Client sans nom'}>
        {v.client_phone ? <Muted>📞 {v.client_phone}</Muted> : null}
        {v.client_email ? <Muted>✉️ {v.client_email}</Muted> : null}
        <Muted>Visite du {when}</Muted>
        <View style={[styles.badge, done ? styles.badgeDone : null]}>
          <Text style={[styles.badgeText, done ? { color: Colors.primaryText } : null]}>{done ? '✓ Faite' : 'Prévue'}</Text>
        </View>
        <Link href={{ pathname: '/clients/[id]', params: { id: v.client_id } }} style={styles.link}>
          📒 Fiche client{otherVisits ? ` · ${otherVisits} autre${otherVisits > 1 ? 's' : ''} visite${otherVisits > 1 ? 's' : ''}` : ''}
        </Link>
        {!done ? <SecondaryButton label="📅 Ajouter au calendrier" onPress={calendar} /> : null}
      </Card>

      <Card title="Lieu du chantier">
        <Text style={styles.text}>
          {[v.site_address, [v.site_postal_code, v.site_city].filter(Boolean).join(' ')].filter(Boolean).join('\n') ||
            'Adresse à compléter'}
        </Text>
        <Muted>Zone : {VAT_ZONE_LABEL[v.vat_zone]}</Muted>
        {v.site_lat != null && v.site_lng != null ? (
          <Muted>Position : {formatPoint({ lat: v.site_lat, lng: v.site_lng, accuracyM: v.site_accuracy_m })}</Muted>
        ) : null}
        {plan ? <LocalImage fileId={plan.id} alt="Plan du chantier" aspectRatio={plan.width / plan.height} /> : null}
        {v.access_notes ? <Text style={styles.text}>Accès : {v.access_notes}</Text> : null}
        {v.near_power_lines ? <Text style={styles.warning}>⚠ Lignes électriques : DT-DICT à faire.</Text> : null}
      </Card>

      <VisitTrees visitId={v.id} site={v.site_lat != null && v.site_lng != null ? { lat: v.site_lat, lng: v.site_lng } : null} />

      {v.notes ? (
        <Card title="Notes">
          <Text style={styles.text}>{v.notes}</Text>
        </Card>
      ) : null}

      <Button
        label={done ? 'Remettre « à faire »' : '✓ Marquer la visite comme faite'}
        onPress={() => setVisitStatus(v.id, done ? 'prevue' : 'faite')}
      />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Modifier" onPress={() => router.push({ pathname: '/visites/[id]/modifier', params: { id: v.id } })} />
        </View>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Supprimer" danger onPress={remove} />
        </View>
      </View>
      <Muted>Fiche détaillée des arbres, croquis, photos et devis : étape 4.</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  text: { fontSize: 16, color: Colors.text },
  warning: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#E7EFE6' },
  badgeDone: { backgroundColor: Colors.primary },
  badgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  link: { fontSize: 16, color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline', paddingVertical: 4 },
});
