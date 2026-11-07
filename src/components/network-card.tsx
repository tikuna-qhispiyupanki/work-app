import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Icon } from '@/components/icon';
import { LocalImage } from '@/components/local-image';
import { PhotoPicker } from '@/components/photo-picker';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { JOB_TEAM_SQL, JobRow, updateJob } from '@/db/jobs';
import { addJobDocument, FINDINGS_SQL, FindingRow, JOB_DOCS_SQL } from '@/db/networks';
import { toDate } from '@/domain/dates';
import { aiprText, DT_DICT_STATUS_LABEL, DtDictStatus, dtDictFields, GUICHET_UNIQUE_URL, membersWithoutAipr, NETWORK_TYPES } from '@/domain/networks';
import { compressImage, PHOTO_HD_MAX, HD_QUALITY } from '@/files/image';
import { kickUploader } from '@/sync/uploader';

const today = () => new Date().toISOString().slice(0, 10);
const STATUSES: DtDictStatus[] = ['a_faire', 'envoyee', 'recepisses', 'non_concerne'];

type Member = { name: string; aipr_profile: string | null; aipr_valid_until: string | null };
const TEAM_AIPR_SQL = `SELECT m.name, m.aipr_profile, m.aipr_valid_until FROM job_members jm JOIN team_members m ON m.id = jm.member_id WHERE jm.job_id = ? AND jm.deleted_at IS NULL`;

// Réseaux (DT-DICT, AIPR, découverte fortuite) et voie publique (arrêté de circulation), sur la page du chantier.
export function NetworkCard({ job }: { job: JobRow }) {
  const { data: lines } = useQuery<{ label: string }>(`SELECT label FROM quote_lines WHERE quote_id = ? AND deleted_at IS NULL AND kind IN ('prestation', 'libre') ORDER BY position`, [job.quote_id ?? '']);
  const works = lines.map((l) => l.label);
  const { data: companies } = useQuery<{ name: string; siret: string; address: string; postal_code: string; city: string; phone: string; email: string }>('SELECT * FROM companies WHERE id = ?', [job.company_id]);
  const { data: docs } = useQuery<{ id: string; company_id: string; width: number; height: number; storage_path: string | null; caption: string | null }>(JOB_DOCS_SQL, [job.id]);
  const { data: findings } = useQuery<FindingRow>(FINDINGS_SQL, [job.id]);
  const { data: team } = useQuery<Member>(TEAM_AIPR_SQL, [job.id]);
  const { data: chefs } = useQuery<{ name: string }>(JOB_TEAM_SQL.replace('ORDER BY', "AND jm.role_on_job = 'chef' ORDER BY"), [job.id]);
  const [showFields, setShowFields] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const status = (job.dt_dict_status as DtDictStatus | null) ?? (job.near_power_lines ? 'a_faire' : null);
  const noAipr = job.near_power_lines ? membersWithoutAipr(team) : [];
  const fields = dtDictFields({
    siteAddress: job.site_address, lat: job.site_lat, lng: job.site_lng, start: job.planned_start, end: job.planned_end, works,
    company: companies[0] ?? {}, manager: chefs[0]?.name ?? null, nearPowerLines: !!job.near_power_lines,
  });

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <>
      <Card title="Réseaux : DT-DICT et AIPR">
        <Pressable style={styles.check} onPress={() => void updateJob(job.id, { near_power_lines: job.near_power_lines ? 0 : 1 })} accessibilityRole="checkbox" aria-checked={!!job.near_power_lines} accessibilityLabel="Lignes électriques à proximité du chantier">
          <Icon name={job.near_power_lines ? 'checkbox' : 'square-outline'} size={24} color={Colors.primary} />
          <Text style={styles.text}>Lignes électriques ou autres réseaux à proximité (aériens ou enterrés : rognage, dessouchage)</Text>
        </Pressable>
        {job.near_power_lines ? (
          job.dt_dict_done_on ? (
            <Text style={styles.ok}>DT-DICT faite le {toDate(job.dt_dict_done_on).toLocaleDateString('fr-FR')}.</Text>
          ) : (
            <Text style={styles.warning}>⚠ DT-DICT à faire avant les travaux (déclaration auprès des gestionnaires de réseaux).</Text>
          )
        ) : null}

        <View style={styles.chips}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              onPress={() => void updateJob(job.id, { dt_dict_status: s, ...(s === 'recepisses' && !job.dt_dict_done_on ? { dt_dict_done_on: today() } : {}), ...(s === 'envoyee' && !job.dt_dict_sent_on ? { dt_dict_sent_on: today() } : {}) })}
              style={[styles.chip, status === s && styles.chipOn]}
              accessibilityRole="radio"
              aria-checked={status === s}
              accessibilityLabel={`DT-DICT : ${DT_DICT_STATUS_LABEL[s]}`}
            >
              <Text style={[styles.chipText, status === s && { color: Colors.primaryText }]}>{DT_DICT_STATUS_LABEL[s]}</Text>
            </Pressable>
          ))}
        </View>

        {status !== 'non_concerne' ? (
          <>
            <Muted>
              La déclaration se fait sur le guichet unique officiel « Réseaux et canalisations » (gratuit) : il indique les exploitants à prévenir, puis chacun répond par un
              récépissé (plans, consignes, numéro d&apos;urgence). Délais de réponse : à vérifier sur le guichet. Travaux urgents (arbre tombé sur une ligne) : avis de travaux urgents (ATU).
            </Muted>
            <Button label="Ouvrir le guichet unique (Internet)" icon="open-outline" onPress={() => Linking.openURL(GUICHET_UNIQUE_URL)} />
            <SecondaryButton label={showFields ? 'Masquer les infos à saisir' : 'Infos à saisir sur le guichet (à copier)'} icon="clipboard-outline" onPress={() => setShowFields(!showFields)} />
            {showFields
              ? fields.map((f) => (
                  <Pressable key={f.label} onPress={() => void copy(f.label, f.value)} style={styles.field} accessibilityRole="button" accessibilityLabel={`Copier : ${f.label}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.small}>{f.label}</Text>
                      <Text style={styles.text}>{f.value}</Text>
                    </View>
                    <Text style={styles.copy}>{copied === f.label ? 'Copié ✓' : 'Copier'}</Text>
                  </Pressable>
                ))
              : null}
            <RefField job={job} />
            <View style={styles.row}>
              <DateField label="Déclaration envoyée le" value={job.dt_dict_sent_on} onChange={(d) => void updateJob(job.id, { dt_dict_sent_on: d })} />
              <DateField label="DT-DICT faite (récépissés) le" value={job.dt_dict_done_on} onChange={(d) => void updateJob(job.id, { dt_dict_done_on: d })} />
            </View>
            {!job.dt_dict_done_on ? <SecondaryButton label="DT-DICT faite aujourd'hui" icon="checkmark-outline" onPress={() => void updateJob(job.id, { dt_dict_done_on: today(), dt_dict_status: 'recepisses' })} /> : null}
            <Text style={styles.label}>Récépissés des exploitants ({docs.length})</Text>
            <Muted>Photo ou capture d&apos;écran de chaque récépissé : il doit être disponible sur le chantier.</Muted>
            <PhotoPicker
              disabled={busy}
              onPicked={async (files) => {
                setBusy(true);
                for (const f of files) await addJobDocument(job.id, await compressImage(f, PHOTO_HD_MAX, HD_QUALITY), 'Récépissé DT-DICT');
                kickUploader();
                setBusy(false);
              }}
            />
            {docs.length ? (
              <View style={styles.grid}>
                {docs.map((d) => (
                  <Pressable key={d.id} style={styles.cell} onPress={() => router.push({ pathname: '/photos/[id]', params: { id: d.id } })} accessibilityRole="button" accessibilityLabel="Voir le récépissé">
                    <LocalImage fileId={d.id} alt="Récépissé" aspectRatio={1} thumb companyId={d.company_id} uploaded={!!d.storage_path} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {job.near_power_lines ? (
          noAipr.length ? (
            <Text style={styles.warning}>⚠ AIPR manquante ou expirée : {noAipr.map((m) => `${m.name} (${aiprText(m)})`).join(', ')}. À renseigner dans Plus → Mon équipe.</Text>
          ) : team.length ? (
            <Text style={styles.ok}>AIPR à jour pour l&apos;équipe du chantier.</Text>
          ) : null
        ) : null}
      </Card>

      <Card title="Découverte d'un réseau">
        <Muted>Câble, conduite ou grillage avertisseur trouvé pendant le chantier (rognage, dessouchage, ancrage) : consignes à suivre et constat.</Muted>
        <Button label="J'ai découvert un réseau" icon="warning-outline" onPress={() => router.push({ pathname: '/chantiers/decouverte', params: { job: job.id } })} />
        {findings.map((f) => (
          <Text key={f.id} style={styles.small}>
            • {toDate(f.found_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} – {NETWORK_TYPES.find((t) => t.key === f.network_type)?.label ?? f.network_type}
            {f.description ? ` : ${f.description}` : ''}
          </Text>
        ))}
      </Card>

      <Card title="Voie publique">
        <Muted>Chantier sur ou au bord d&apos;une route, d&apos;un trottoir : demande d&apos;arrêté de circulation et de stationnement à la mairie, pré-remplie.</Muted>
        <SecondaryButton label={job.road_permit ? 'Demande d’arrêté de voirie (brouillon)' : 'Préparer une demande d’arrêté de voirie'} icon="car-outline" onPress={() => router.push({ pathname: '/chantiers/voirie', params: { job: job.id } })} />
      </Card>
    </>
  );
}

function RefField({ job }: { job: JobRow }) {
  const [t, setT] = useState(job.dt_dict_reference ?? '');
  return <Field label="N° de la déclaration (téléservice)" value={t} onChangeText={setT} onBlur={() => t !== (job.dt_dict_reference ?? '') && void updateJob(job.id, { dt_dict_reference: t.trim() || null })} />;
}

const styles = StyleSheet.create({
  text: { fontSize: 16, color: Colors.text, flexShrink: 1 },
  small: { fontSize: 14, color: Colors.text },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  ok: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  warning: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.card },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, color: Colors.text },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  copy: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 80 },
});
