import { useQuery } from '@powersync/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Icon } from '@/components/icon';
import { Button, Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { JobRow, updateJob } from '@/db/jobs';
import { defaultRoadPermit, ROAD_MEASURES, RoadPermit, roadPermitLetter } from '@/domain/networks';
import { buildRoadPermitPdf } from '@/pdf/network-pdf';
import { shareFile } from '@/pdf/share';

type Company = { name: string | null; address: string | null; postal_code: string | null; city: string | null; phone: string | null; email: string | null; siret: string | null };

// Demande d'arrêté temporaire de circulation et de stationnement, pré-remplie, à envoyer à la mairie (PDF).
export default function RoadPermitScreen() {
  const { job } = useLocalSearchParams<{ job: string }>();
  const { data: jobs } = useQuery<JobRow>('SELECT * FROM jobs WHERE id = ?', [job]);
  const j = jobs[0];
  const { data: companies } = useQuery<Company>('SELECT * FROM companies WHERE id = ?', [j?.company_id ?? '']);
  const { data: lines } = useQuery<{ label: string }>(`SELECT label FROM quote_lines WHERE quote_id = ? AND deleted_at IS NULL AND kind IN ('prestation', 'libre') ORDER BY position`, [j?.quote_id ?? '']);
  const { data: chefs } = useQuery<{ name: string; phone: string | null }>(
    `SELECT m.name, m.phone FROM job_members jm JOIN team_members m ON m.id = jm.member_id WHERE jm.job_id = ? AND jm.deleted_at IS NULL AND jm.role_on_job = 'chef'`,
    [job]
  );
  if (!j) return <Muted>Chargement…</Muted>;
  const c = companies[0];
  const city = (j.site_address ?? '').match(/\d{5}\s+(.+)$/)?.[1] ?? null;
  const contact = [chefs[0]?.name, chefs[0]?.phone ?? c?.phone].filter(Boolean).join(' – ') || null;
  let permit: RoadPermit = defaultRoadPermit({ city, siteAddress: j.site_address, start: j.planned_start, end: j.planned_end, contact });
  try {
    if (j.road_permit) permit = { ...permit, ...(JSON.parse(j.road_permit) as RoadPermit) };
  } catch {
    // brouillon illisible : on repart du modèle
  }
  return <Editor key={j.road_permit ?? 'neuf'} jobId={j.id} initial={permit} company={c} works={lines.map((l) => l.label).join(', ')} />;
}

function Editor({ jobId, initial, company, works }: { jobId: string; initial: RoadPermit; company: Company | undefined; works: string }) {
  const [p, setP] = useState<RoadPermit>(initial);
  const save = (next: RoadPermit) => {
    setP(next);
    void updateJob(jobId, { road_permit: JSON.stringify(next) });
  };
  const text = (k: keyof RoadPermit, label: string, multiline = false) => (
    <Field label={label} value={String(p[k] ?? '')} onChangeText={(v) => setP({ ...p, [k]: v })} onBlur={() => save(p)} multiline={multiline} />
  );
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title="Demande d'arrêté de circulation et de stationnement">
        <Muted>À envoyer à la mairie (ou au gestionnaire de la route) plusieurs jours avant le chantier : le délai dépend de la commune, renseigne-toi. Le brouillon est gardé sur le chantier.</Muted>
        {text('mairie', 'Destinataire')}
        {text('road', 'Adresse des travaux (rue, n°)')}
        <View style={styles.row}>
          <DateField label="Du" value={p.from || null} onChange={(d) => save({ ...p, from: d ?? '' })} />
          <DateField label="Au" value={p.to || null} onChange={(d) => save({ ...p, to: d ?? '' })} />
        </View>
        {text('hours', 'Horaires')}
        {text('occupation', 'Occupation du domaine public', true)}
        <Text style={styles.label}>Mesures demandées</Text>
        {ROAD_MEASURES.map((m) => {
          const on = p.measures.includes(m);
          return (
            <Pressable key={m} style={styles.check} onPress={() => save({ ...p, measures: on ? p.measures.filter((x) => x !== m) : [...p.measures, m] })} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={m}>
              <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={Colors.primary} />
              <Text style={[styles.text, { flex: 1 }]}>{m}</Text>
            </Pressable>
          );
        })}
        {text('other', 'Autre mesure (à préciser)')}
        {text('contact', 'Personne à contacter (nom, téléphone)')}
      </Card>
      <Card title="Aperçu de la lettre">
        {roadPermitLetter(p, { company: company?.name ?? '', works }).map((t, i) => (
          <Text key={i} style={styles.small}>
            {t}
          </Text>
        ))}
      </Card>
      <Button
        label="Demande en PDF (à envoyer à la mairie)"
        icon="share-outline"
        onPress={() => void shareFile(buildRoadPermitPdf({ company: company ?? {}, permit: p, works }), 'Demande-arrete-de-voirie.pdf')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  text: { fontSize: 16, color: Colors.text },
  small: { fontSize: 14, color: Colors.text },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  row: { flexDirection: 'row', gap: Spacing.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 3 },
});
