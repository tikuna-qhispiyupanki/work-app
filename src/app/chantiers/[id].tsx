import { useQuery } from '@powersync/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { DateField } from '@/components/date-field';
import { Icon } from '@/components/icon';
import { Segmented } from '@/components/segmented';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db/database';
import {
  addJobMember, createJobForQuote, createSheet, JOB_SHEETS_SQL, JOB_SQL, JOB_STATUS_LABEL, JOB_TEAM_SQL, JobMemberRow, JobRow, JobStatus, removeJobMember, ROLE_ON_JOB_LABEL,
  setJobMemberRole, SheetRow, updateJob,
} from '@/db/jobs';
import { TEAM_SQL, TeamMemberRow } from '@/db/team';
import { toDate } from '@/domain/dates';
import { RESPONSIBILITY } from '@/domain/intervention';

type Tab = 'infos' | 'equipe' | 'fiche';
const STATUSES: JobStatus[] = ['a_planifier', 'planifie', 'en_cours', 'termine', 'annule'];
const today = () => new Date().toISOString().slice(0, 10);

// Page d'un chantier : planification, équipe, fiche d'intervention.
export default function JobScreen() {
  const { id, onglet } = useLocalSearchParams<{ id: string; onglet?: Tab }>();
  const [tab, setTab] = useState<Tab>(onglet ?? 'infos');
  const { company } = useAuth();
  const { data, isLoading } = useQuery<JobRow>(JOB_SQL, [id]);
  const { data: team } = useQuery<JobMemberRow>(JOB_TEAM_SQL, [id]);
  const { data: sheets } = useQuery<SheetRow>(JOB_SHEETS_SQL, [id]);
  const { data: everyone } = useQuery<TeamMemberRow>(TEAM_SQL, [company?.id ?? '']);
  const [error, setError] = useState<string | null>(null);
  const j = data[0];
  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!j) return <MissingJob id={id} />;
  const current = sheets.find((s) => s.status !== 'remplacee') ?? null;
  const available = everyone.filter((m) => m.active && !team.some((t) => t.member_id === m.id));

  const openSheet = async () => {
    setError(null);
    try {
      const sid = current?.status === 'brouillon' ? current.id : current ? current.id : await createSheet(j.id);
      router.push({ pathname: '/fiches/[id]', params: { id: sid } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: j.client_name || 'Chantier' }} />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'infos', label: 'Infos' },
          { key: 'equipe', label: 'Équipe', count: team.length },
          { key: 'fiche', label: 'Fiche' },
        ]}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {tab === 'infos' ? (
          <>
            <Card>
              <Text style={styles.big}>{j.title}</Text>
              {j.site_address ? <Text style={styles.text}>{j.site_address}</Text> : null}
              <View style={styles.row}>
                {j.site_address ? (
                  <Quick icon="navigate-outline" label="Itinéraire" onPress={() => Linking.openURL(`https://maps.apple.com/?daddr=${encodeURIComponent(j.site_address ?? '')}`)} />
                ) : null}
                {j.quote_id ? <Quick icon="document-text-outline" label={`Devis ${j.quote_number ?? ''}`} onPress={() => router.push({ pathname: '/devis/[id]', params: { id: j.quote_id! } })} /> : null}
                {j.visit_id ? <Quick icon="clipboard-outline" label="Visite" onPress={() => router.push({ pathname: '/visites/[id]', params: { id: j.visit_id! } })} /> : null}
              </View>
            </Card>
            <Card title="Avancement">
              <View style={styles.chips}>
                {STATUSES.map((s) => (
                  <Pressable key={s} onPress={() => void updateJob(j.id, { status: s })} style={[styles.chip, j.status === s && styles.chipOn]} accessibilityRole="radio" aria-checked={j.status === s}>
                    <Text style={[styles.chipText, j.status === s && { color: Colors.primaryText }]}>{JOB_STATUS_LABEL[s]}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.row}>
                <DateField
                  label="Début prévu"
                  value={j.planned_start}
                  onChange={(d) => void updateJob(j.id, { planned_start: d, ...(d && j.status === 'a_planifier' ? { status: 'planifie' as const } : {}), ...(d && (!j.planned_end || j.planned_end < d) ? { planned_end: d } : {}) })}
                />
                <DateField label="Fin prévue" value={j.planned_end} onChange={(d) => void updateJob(j.id, { planned_end: d })} />
              </View>
            </Card>
            <Card title="Lignes électriques">
              <Pressable style={styles.check} onPress={() => void updateJob(j.id, { near_power_lines: j.near_power_lines ? 0 : 1 })} accessibilityRole="checkbox" aria-checked={!!j.near_power_lines} accessibilityLabel="Lignes électriques à proximité du chantier">
                <Icon name={j.near_power_lines ? 'checkbox' : 'square-outline'} size={24} color={Colors.primary} />
                <Text style={styles.text}>Lignes électriques à proximité</Text>
              </Pressable>
              {j.near_power_lines ? (
                j.dt_dict_done_on ? (
                  <Text style={styles.ok}>DT-DICT faite le {toDate(j.dt_dict_done_on).toLocaleDateString('fr-FR')}.</Text>
                ) : (
                  <>
                    <Text style={styles.warning}>⚠ DT-DICT à faire avant les travaux (déclaration auprès des gestionnaires de réseaux).</Text>
                    <SecondaryButton label="DT-DICT faite aujourd'hui" icon="checkmark-outline" onPress={() => void updateJob(j.id, { dt_dict_done_on: today() })} />
                  </>
                )
              ) : null}
            </Card>
            <NotesCard job={j} />
          </>
        ) : null}

        {tab === 'equipe' ? (
          <Card title="Équipe du chantier">
            {team.length === 0 ? <Muted>Personne pour l&apos;instant. Ajoute les intervenants ci-dessous.</Muted> : null}
            {team.map((m) => (
              <View key={m.id} style={styles.member}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{m.name}</Text>
                  <View style={styles.chips}>
                    {(['chef', 'equipier', 'sauveteur'] as const).map((r) => (
                      <Pressable key={r} onPress={() => void setJobMemberRole(m.id, r)} style={[styles.smallChip, m.role_on_job === r && styles.chipOn]} accessibilityRole="radio" aria-checked={m.role_on_job === r} accessibilityLabel={`${m.name} : ${ROLE_ON_JOB_LABEL[r]}`}>
                        <Text style={[styles.smallChipText, m.role_on_job === r && { color: Colors.primaryText }]}>{ROLE_ON_JOB_LABEL[r]}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Pressable onPress={() => void removeJobMember(m.id)} accessibilityRole="button" accessibilityLabel={`Retirer ${m.name} du chantier`} style={{ padding: 6 }}>
                  <Icon name="close-circle-outline" size={24} color={Colors.danger} />
                </Pressable>
              </View>
            ))}
            {available.length ? (
              <View style={styles.chips}>
                {available.map((t) => (
                  <Pressable key={t.id} style={styles.addChip} onPress={() => void addJobMember(j.id, t.id)} accessibilityRole="button" accessibilityLabel={`Ajouter ${t.name} au chantier`}>
                    <Icon name="add" size={16} color={Colors.primary} />
                    <Text style={styles.addChipText}>{t.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {everyone.length === 0 ? <SecondaryButton label="Renseigner mon équipe" icon="people-outline" onPress={() => router.push('/equipe')} /> : null}
            {team.length > 0 && !team.some((t) => t.role_on_job === 'sauveteur') ? (
              <Text style={styles.warning}>Désigne un sauveteur : quelqu&apos;un au sol, formé au sauvetage, pendant tout le travail en hauteur.</Text>
            ) : null}
          </Card>
        ) : null}

        {tab === 'fiche' ? (
          <>
            <Card title="Fiche d'intervention">
              <Muted>
                Obligatoire pour l&apos;élagage et l&apos;abattage : établie avant le début des travaux, datée et signée par le chef d&apos;entreprise, présentée à
                chaque intervenant (qui signe), disponible sur le chantier et gardée 2 ans. Elle est pré-remplie avec la visite et le devis.
              </Muted>
              {current ? (
                <Text style={styles.text}>
                  Version {current.version} :{' '}
                  {current.status === 'brouillon'
                    ? 'brouillon, à compléter et signer'
                    : `signée le ${toDate(current.signed_at).toLocaleDateString('fr-FR')} par ${current.signer_name}`}
                </Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label={current ? 'Ouvrir la fiche' : "Préparer la fiche d'intervention"} icon="shield-checkmark-outline" onPress={openSheet} />
              {j.near_power_lines && !j.dt_dict_done_on ? <Text style={styles.warning}>⚠ DT-DICT pas encore faite (onglet Infos).</Text> : null}
            </Card>
            {sheets.filter((s) => s.status === 'remplacee').length ? (
              <Card title="Anciennes versions (gardées 2 ans)">
                {sheets
                  .filter((s) => s.status === 'remplacee')
                  .map((s) => (
                    <Pressable key={s.id} onPress={() => router.push({ pathname: '/fiches/[id]', params: { id: s.id } })} accessibilityRole="link">
                      <Text style={styles.link}>
                        Version {s.version}, signée le {toDate(s.signed_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </Pressable>
                  ))}
              </Card>
            ) : null}
            <Muted>{RESPONSIBILITY}</Muted>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function NotesCard({ job }: { job: JobRow }) {
  const [t, setT] = useState(job.notes ?? '');
  return (
    <Card title="Notes du chantier">
      <Field label="Notes (accès, clés, matériel à prévoir…)" value={t} onChangeText={setT} onBlur={() => t !== (job.notes ?? '') && void updateJob(job.id, { notes: t })} multiline />
    </Card>
  );
}

function Quick({ icon, label, onPress }: { icon: 'navigate-outline' | 'document-text-outline' | 'clipboard-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quick} accessibilityRole="link" accessibilityLabel={label}>
      <Icon name={icon} size={17} color={Colors.primary} />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, paddingTop: 0, gap: Spacing.md, paddingBottom: Spacing.xl },
  big: { fontSize: 19, fontWeight: '600', color: Colors.text },
  text: { fontSize: 16, color: Colors.text, flexShrink: 1 },
  name: { fontSize: 16, fontWeight: '500', color: Colors.text },
  ok: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  warning: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
  error: { fontSize: 15, color: Colors.danger },
  link: { fontSize: 15, color: Colors.primary, fontWeight: '600', paddingVertical: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.card },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 15, color: Colors.text },
  smallChip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: Colors.card },
  smallChipText: { fontSize: 13, color: Colors.text },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7 },
  addChipText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  quickText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
});

// Devis signé avant l'arrivée des chantiers : on peut créer son chantier à la main.
function MissingJob({ id }: { id: string }) {
  const { data } = useQuery<{ status: string }>('SELECT status FROM quotes WHERE id = ?', [id]);
  if (data[0]?.status !== 'signe') return <Muted>Chantier introuvable.</Muted>;
  return (
    <View style={styles.container}>
      <Card title="Pas encore de chantier">
        <Muted>Ce devis a été signé avant l&apos;arrivée des chantiers dans Arboject.</Muted>
        <Button label="Créer le chantier" icon="construct-outline" onPress={() => void db.writeTransaction((tx) => createJobForQuote(tx, id))} />
      </Card>
    </View>
  );
}
