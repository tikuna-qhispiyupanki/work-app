import { useQuery } from '@powersync/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionMenu } from '@/components/action-menu';
import { addToCalendar } from '@/components/add-to-calendar';
import { confirmAction } from '@/components/confirm';
import { Icon } from '@/components/icon';
import { LocalImage } from '@/components/local-image';
import { Segmented } from '@/components/segmented';
import { SyncPill } from '@/components/sync-pill';
import { Button, Card, Muted } from '@/components/ui';
import { VisitPhotos } from '@/components/visit-photos';
import { VisitQuotes } from '@/components/visit-quotes';
import { VisitSketches } from '@/components/visit-sketches';
import { VisitTrees } from '@/components/visit-trees';
import { Colors, Spacing } from '@/constants/theme';
import { deleteVisit, setVisitStatus, VISIT_DETAIL_SQL, VISIT_PLAN_SQL } from '@/db/visits';
import { toDate } from '@/domain/dates';
import { formatPoint } from '@/domain/geo';
import { VAT_ZONE_LABEL, VatZone } from '@/domain/vat';

type VisitDetail = {
  id: string;
  company_id: string;
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

type Tab = 'infos' | 'arbres' | 'photos' | 'croquis' | 'devis';

const COUNTS_SQL = `SELECT
  (SELECT COUNT(*) FROM trees WHERE visit_id = ?1 AND deleted_at IS NULL) AS trees,
  (SELECT COUNT(*) FROM photos WHERE owner_type = 'visit' AND owner_id = ?1 AND kind = 'photo' AND deleted_at IS NULL) AS photos,
  (SELECT COUNT(*) FROM photos WHERE owner_type = 'visit' AND owner_id = ?1 AND kind = 'croquis' AND deleted_at IS NULL) AS sketches,
  (SELECT COUNT(*) FROM quotes WHERE visit_id = ?1 AND deleted_at IS NULL) AS quotes,
  (SELECT COUNT(*) FROM visits WHERE client_id = (SELECT client_id FROM visits WHERE id = ?1) AND id <> ?1 AND deleted_at IS NULL) AS others`;

// Page d'une visite, en onglets : Infos · Arbres · Photos · Croquis · Devis.
// Les actions (modifier, faite, calendrier, supprimer) sont dans le menu « ⋯ » de l'en-tête.
export default function VisitScreen() {
  const { id, onglet } = useLocalSearchParams<{ id: string; onglet?: Tab }>();
  const [tab, setTab] = useState<Tab>(onglet ?? 'infos');
  const { data, isLoading } = useQuery<VisitDetail>(VISIT_DETAIL_SQL, [id]);
  const { data: plans } = useQuery<{ id: string; width: number; height: number; storage_path: string | null }>(VISIT_PLAN_SQL, [id]);
  const { data: countRows } = useQuery<{ trees: number; photos: number; sketches: number; quotes: number; others: number }>(COUNTS_SQL, [id]);
  const v = data[0];
  const plan = plans[0];
  const counts = countRows[0] ?? { trees: 0, photos: 0, sketches: 0, quotes: 0, others: 0 };

  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!v) return <Muted>Visite introuvable (elle a peut-être été supprimée).</Muted>;

  const done = v.status === 'faite';
  const when = toDate(v.visited_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
  const address = [v.site_address, [v.site_postal_code, v.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const remove = async () => {
    if (!(await confirmAction('Supprimer cette visite ?', `${v.client_name || 'Client sans nom'} – ${when}`, 'Supprimer'))) return;
    await deleteVisit(v.id);
    router.dismissTo('/');
  };
  const calendar = () =>
    addToCalendar(
      {
        uid: `visite-${v.id}@arboject`,
        start: toDate(v.visited_at),
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
    <>
      <Stack.Screen
        options={{
          title: v.client_name || 'Visite',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SyncPill />
              <ActionMenu
                label="Actions de la visite"
                actions={[
                  { label: 'Modifier la visite', icon: 'create-outline', onPress: () => router.push({ pathname: '/visites/[id]/modifier', params: { id: v.id } }) },
                  {
                    label: done ? 'Remettre « à faire »' : 'Marquer la visite comme faite',
                    icon: done ? 'refresh-outline' : 'checkmark-circle-outline',
                    onPress: () => setVisitStatus(v.id, done ? 'prevue' : 'faite'),
                  },
                  { label: 'Ajouter au calendrier', icon: 'calendar-outline', onPress: calendar, hidden: done },
                  { label: 'Fiche client', icon: 'person-outline', onPress: () => router.push({ pathname: '/clients/[id]', params: { id: v.client_id } }) },
                  { label: 'Supprimer la visite', icon: 'trash-outline', onPress: remove, danger: true },
                ]}
              />
            </View>
          ),
        }}
      />
      <View>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'infos', label: 'Infos' },
            { key: 'arbres', label: 'Arbres', count: counts.trees },
            { key: 'photos', label: 'Photos', count: counts.photos },
            { key: 'croquis', label: 'Croquis', count: counts.sketches },
            { key: 'devis', label: 'Devis', count: counts.quotes },
          ]}
        />
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {tab === 'infos' ? (
          <>
            <Card>
              <View style={styles.headRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.big}>{v.client_name || 'Client sans nom'}</Text>
                  <Muted>{when}</Muted>
                  {v.client_phone ? <Text style={styles.text}>Tél. {v.client_phone}</Text> : null}
                  {v.client_email ? <Muted>{v.client_email}</Muted> : null}
                </View>
                <View style={[styles.badge, done && styles.badgeDone]}>
                  <Text style={[styles.badgeText, done && { color: Colors.primaryText }]}>{done ? 'Faite' : 'Prévue'}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                {v.client_phone ? <Quick icon="call-outline" label="Appeler" url={`tel:${v.client_phone.replace(/\s/g, '')}`} /> : null}
                {v.client_phone ? <Quick icon="chatbubble-outline" label="SMS" url={`sms:${v.client_phone.replace(/\s/g, '')}`} /> : null}
                {address ? <Quick icon="navigate-outline" label="Itinéraire" url={`https://maps.apple.com/?daddr=${encodeURIComponent(address)}`} /> : null}
                <Pressable style={styles.action} onPress={() => router.push({ pathname: '/clients/[id]', params: { id: v.client_id } })} accessibilityRole="link">
                  <Icon name="person-outline" size={17} color={Colors.primary} />
                  <Text style={styles.actionText}>Fiche client{counts.others ? ` · ${counts.others} autre${counts.others > 1 ? 's' : ''} visite${counts.others > 1 ? 's' : ''}` : ''}</Text>
                </Pressable>
              </View>
            </Card>

            <Card title="Lieu du chantier">
              <Text style={styles.text}>
                {[v.site_address, [v.site_postal_code, v.site_city].filter(Boolean).join(' ')].filter(Boolean).join('\n') || 'Adresse à compléter'}
              </Text>
              <Muted>Zone : {VAT_ZONE_LABEL[v.vat_zone]}</Muted>
              {v.site_lat != null && v.site_lng != null ? <Muted>Position : {formatPoint({ lat: v.site_lat, lng: v.site_lng, accuracyM: v.site_accuracy_m })}</Muted> : null}
              {v.access_notes ? <Text style={styles.text}>Accès : {v.access_notes}</Text> : null}
              {v.near_power_lines ? <Text style={styles.warning}>⚠ Lignes électriques : DT-DICT à faire.</Text> : null}
            </Card>

            {v.notes ? (
              <Card title="Notes">
                <Text style={styles.text}>{v.notes}</Text>
              </Card>
            ) : null}

            <Card title="Avancement">
              <Muted>
                {counts.trees} arbre{counts.trees > 1 ? 's' : ''} · {counts.photos} photo{counts.photos > 1 ? 's' : ''} · {counts.sketches} croquis · {counts.quotes} devis
              </Muted>
              {!counts.trees ? <Next label="Relever les arbres" onPress={() => setTab('arbres')} /> : !counts.quotes ? <Next label="Préparer le devis" onPress={() => setTab('devis')} /> : null}
            </Card>

            <Button
              label={done ? 'Remettre « à faire »' : 'Marquer la visite comme faite'}
              icon={done ? 'refresh-outline' : 'checkmark-circle-outline'}
              onPress={() => setVisitStatus(v.id, done ? 'prevue' : 'faite')}
            />
          </>
        ) : null}

        {tab === 'arbres' ? (
          <>
            <VisitTrees visitId={v.id} site={v.site_lat != null && v.site_lng != null ? { lat: v.site_lat, lng: v.site_lng } : null} />
            {plan ? (
              <Card title="Image du plan enregistrée">
                <LocalImage fileId={plan.id} alt="Plan du chantier" aspectRatio={plan.width / plan.height} companyId={v.company_id} uploaded={!!plan.storage_path} />
                <Muted>Elle sert au croquis et à la fiche d&apos;intervention.</Muted>
              </Card>
            ) : null}
          </>
        ) : null}
        {tab === 'photos' ? <VisitPhotos ownerType="visit" ownerId={v.id} /> : null}
        {tab === 'croquis' ? <VisitSketches visitId={v.id} /> : null}
        {tab === 'devis' ? <VisitQuotes visitId={v.id} /> : null}
      </ScrollView>
    </>
  );
}

function Quick({ icon, label, url }: { icon: 'call-outline' | 'chatbubble-outline' | 'navigate-outline'; label: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={styles.action} accessibilityRole="link" accessibilityLabel={label}>
      <Icon name={icon} size={17} color={Colors.primary} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Next({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.next} accessibilityRole="button">
      <Text style={styles.nextText}>Étape suivante : {label}</Text>
      <Icon name="arrow-forward" size={18} color={Colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, paddingTop: 0, gap: Spacing.md, paddingBottom: Spacing.xl },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  big: { fontSize: 20, fontWeight: '600', color: Colors.text },
  text: { fontSize: 16, color: Colors.text },
  warning: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#E7EFE6' },
  badgeDone: { backgroundColor: Colors.primary },
  badgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.card },
  actionText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E6EFEC', borderRadius: 8, padding: Spacing.sm },
  nextText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
});
