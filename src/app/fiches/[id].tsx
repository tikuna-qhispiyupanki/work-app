import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { confirmAction } from '@/components/confirm';
import { DateField } from '@/components/date-field';
import { EmergencyCard } from '@/components/emergency-card';
import { Icon } from '@/components/icon';
import { LocalImage } from '@/components/local-image';
import { SignaturePad, SignaturePadHandle } from '@/components/signature-pad';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import {
  acknowledgeSheet, AckRow, createSheet, saveSheetDefaults, JOB_TEAM_SQL, JobMemberRow, ROLE_ON_JOB_LABEL, SHEET_ACKS_SQL, SHEET_SQL, SheetField, SheetRow, signSheet, updateSheet,
} from '@/db/jobs';
import { toDate } from '@/domain/dates';
import { ACTIVITIES, EQUIPMENT_GROUPS, MEASURES, missingSheetFields, parseJson, preventionFor, RESCUE_CHECKS, RESPONSIBILITY, RISK_GROUP_LABEL, RISKS, TREE_CHECKS } from '@/domain/intervention';
import type { CheckValue, RiskGroup, RiskKey, RisksValue } from '@/domain/intervention';
import { emergencyBlock } from '@/domain/emergency';
import { quickPosition } from '@/domain/geo';
import { shareFile } from '@/pdf/share';
import { sheetPdf } from '@/pdf/sheet-pdf-data';
import { kickUploader } from '@/sync/uploader';

const SKETCHES_SQL = `SELECT p.id, p.kind, p.width, p.height, p.storage_path FROM photos p JOIN jobs j ON j.visit_id = p.owner_id
  WHERE j.id = ? AND p.owner_type = 'visit' AND p.kind IN ('croquis', 'plan') AND p.deleted_at IS NULL ORDER BY p.taken_at DESC`;
type Sketch = { id: string; kind: string; width: number; height: number; storage_path: string | null };

// Fiche d'intervention : brouillon modifiable → signée par le chef d'entreprise (figée) → présentée et signée par chaque intervenant.
export default function SheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<SheetRow>(SHEET_SQL, [id]);
  const s = data[0];
  const { data: acks } = useQuery<AckRow>(SHEET_ACKS_SQL, [id]);
  const { data: team } = useQuery<JobMemberRow>(JOB_TEAM_SQL, [s?.job_id ?? '']);
  const { data: sketches } = useQuery<Sketch>(SKETCHES_SQL, [s?.job_id ?? '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { company } = useAuth();
  const { data: jobs } = useQuery<{ site_address: string | null; site_lat: number | null; site_lng: number | null }>('SELECT site_address, site_lat, site_lng FROM jobs WHERE id = ?', [s?.job_id ?? '']);
  const job = jobs[0];
  const companyName = company?.name ?? null;
  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!s) return <Muted>Fiche introuvable.</Muted>;
  const draft = s.status === 'brouillon';
  const set = (f: SheetField) => (v: string | number | null) => void updateSheet(s.id, f, v).catch((e) => setError(String(e)));
  const risks = parseJson<RisksValue>(s.risks, { checked: [], other: '' });
  const missing = missingSheetFields(s);
  const sketch = sketches.find((k) => k.id === s.sketch_photo_id);

  const pdf = async (printable: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const p = await sheetPdf(s.id, printable);
      await shareFile(p.data, p.fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={[styles.banner, !draft && styles.bannerOk]}>
        <Icon name={draft ? 'create-outline' : s.status === 'signee' ? 'shield-checkmark' : 'archive-outline'} size={22} color={draft ? Colors.warning : Colors.primary} />
        <Text style={[styles.text, { flex: 1 }]}>
          {draft
            ? `Version ${s.version} – brouillon. Relis et adapte chaque rubrique, puis signe.`
            : s.status === 'signee'
              ? `Version ${s.version} signée le ${toDate(s.signed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} par ${s.signer_name}. À garder jusqu'au ${toDate(s.retain_until).toLocaleDateString('fr-FR')}.`
              : `Version ${s.version}, remplacée par une version plus récente (gardée jusqu'au ${toDate(s.retain_until).toLocaleDateString('fr-FR')}).`}
        </Text>
      </View>

      <EmergencyCard company={companyName} address={job?.site_address ?? null} lat={job?.site_lat ?? null} lng={job?.site_lng ?? null} />

      <Card title="Identification">
        <Field2 label="Téléphone de l'entreprise (en cas d'incident ou d'accident)" value={s.company_phone} editable={draft} onSave={set('company_phone')} keyboard="phone-pad" />
        <Field2 label="Donneur d'ordre (client)" value={s.client_name} editable={draft} onSave={set('client_name')} />
        <Field2 label="Téléphone du donneur d'ordre" value={s.client_phone} editable={draft} onSave={set('client_phone')} keyboard="phone-pad" />
        <TextBlock key={`Emplacement:${s.location ?? ""}`} label="Lieu (adresse, coordonnées GPS)" value={s.location} editable={draft} onSave={set('location')} />
        {draft ? (
          <>
            <View style={styles.row}>
              <DateField label="Date de début" value={s.start_date} onChange={set('start_date')} />
              <DateField label="Date de fin" value={s.end_date} onChange={set('end_date')} />
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field2 label="Heure de début" value={s.start_time} editable onSave={set('start_time')} placeholder="8h00" /></View>
              <View style={{ flex: 1 }}><Field2 label="Heure de fin" value={s.end_time} editable onSave={set('end_time')} placeholder="16h00" /></View>
            </View>
          </>
        ) : (
          <Text style={styles.text}>
            Du {toDate(s.start_date).toLocaleDateString('fr-FR')}{s.start_time ? ` (${s.start_time})` : ''} au {toDate(s.end_date).toLocaleDateString('fr-FR')}{s.end_time ? ` (${s.end_time})` : ''}
          </Text>
        )}
        <Field2 label="Responsable de l'entreprise sur le chantier" value={s.site_manager_name} editable={draft} onSave={set('site_manager_name')} />
        <Field2 label="Téléphone du responsable" value={s.site_manager_phone} editable={draft} onSave={set('site_manager_phone')} keyboard="phone-pad" />
        <Field2 label="Nombre de travailleurs de l'entreprise" value={s.workers_count == null ? null : String(s.workers_count)} editable={draft} onSave={(v) => set('workers_count')(v && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null)} keyboard="number-pad" />
        {team.length ? <Muted>Intervenants : {team.map((t) => `${t.name} (${ROLE_ON_JOB_LABEL[t.role_on_job]})`).join(', ')}</Muted> : <Text style={styles.warning}>Aucun intervenant : ajoute l&apos;équipe dans le chantier.</Text>}
      </Card>

      <Card title="1. Travaux à réaliser et matériels">
        <CheckList label="Activités" items={ACTIVITIES} json={s.activities} editable={draft} onChange={set('activities')} />
        <TextBlock key={`Travaux:${s.works ?? ""}`} label="Détail des travaux (repris du devis)" value={s.works} editable={draft} onSave={set('works')} />
        {EQUIPMENT_GROUPS.map((g) => (
          <CheckList key={g.title} label={g.title} items={g.items} json={s.equipment} editable={draft} onChange={set('equipment')} hideOther />
        ))}
        <OtherField label="Autres matériels" json={s.equipment} editable={draft} onChange={set('equipment')} />
        <CheckList label="État sanitaire et physiologique des arbres" items={TREE_CHECKS} json={s.trees_state} editable={draft} onChange={set('trees_state')} />
      </Card>

      <Card title="2. Croquis (accès, circulation, végétaux à traiter)">
        {sketch ? (
          <LocalImage fileId={sketch.id} alt="Croquis de la fiche" aspectRatio={sketch.width / sketch.height} companyId={s.company_id} uploaded={!!sketch.storage_path} />
        ) : (
          <Text style={styles.warning}>Aucun croquis choisi. Fais-en un dans la visite (onglet Croquis), puis choisis-le ici.</Text>
        )}
        {draft && sketches.length > 1 ? (
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {sketches.map((k) => (
              <Pressable key={k.id} onPress={() => set('sketch_photo_id')(k.id)} style={[styles.thumb, k.id === s.sketch_photo_id && styles.thumbOn]} accessibilityRole="radio" aria-checked={k.id === s.sketch_photo_id} accessibilityLabel={k.kind === 'plan' ? 'Image du plan' : 'Croquis'}>
                <LocalImage fileId={k.id} alt={k.kind} aspectRatio={k.width / k.height} thumb companyId={s.company_id} uploaded={!!k.storage_path} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Muted>Sur le croquis : accès, voies de circulation, arbres à traiter, lignes électriques, zones de danger, point avec réseau téléphonique, point de rencontre des secours (PRS).</Muted>
      </Card>

      <Card title="3. Risques propres au chantier et à son environnement">
        {(Object.keys(RISK_GROUP_LABEL) as RiskGroup[]).map((g) => {
          const items = RISKS.filter((r) => r.group === g);
          if (!draft && !items.some((r) => risks.checked.includes(r.key))) return null;
          return (
            <View key={g} style={{ gap: 2 }}>
              <Text style={styles.label}>{RISK_GROUP_LABEL[g]}</Text>
              {items.map((r) => {
                const on = risks.checked.includes(r.key);
                if (!draft && !on) return null;
                return (
                  <Pressable
                    key={r.key}
                    disabled={!draft}
                    style={styles.check}
                    onPress={() => set('risks')(JSON.stringify({ ...risks, checked: on ? risks.checked.filter((x) => x !== r.key) : [...risks.checked, r.key as RiskKey] }))}
                    accessibilityRole="checkbox"
                    aria-checked={on} aria-disabled={!draft}
                    accessibilityLabel={r.label}
                  >
                    <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={Colors.primary} />
                    <Text style={[styles.text, { flex: 1 }]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        <TextBlock key={`Autres risques:${risks.other ?? ""}`} label="Autres risques identifiés" value={risks.other} editable={draft} onSave={(v) => set('risks')(JSON.stringify({ ...risks, other: v ?? '' }))} />
      </Card>

      <Card title="4. Mesures de prévention">
        <CheckList label="Mesures et règles d'organisation (dont balisage)" items={MEASURES} json={s.measures} editable={draft} onChange={set('measures')} />
        <Field2 label="Mode de communication entre travailleurs" value={s.communication_mode} editable={draft} onSave={set('communication_mode')} />
        <TextBlock key={`Mesures de prévention:${s.prevention ?? ""}`} label="Mesures de prévention" value={s.prevention} editable={draft} onSave={set('prevention')} />
        {draft ? <SecondaryButton label="Reprendre les mesures proposées pour les risques cochés" icon="refresh-outline" onPress={() => set('prevention')(preventionFor(risks.checked))} /> : null}
      </Card>
      <Card title="5. Conduite à tenir en cas d'accident">
        <TextBlock key={`Conduite à tenir:${s.accident_procedure ?? ""}`} label="Conduite à tenir" value={s.accident_procedure} editable={draft} onSave={set('accident_procedure')} />
      </Card>
      <Card title="6. Organisation des secours">
        <CheckList label="Ressources humaines et matérielles" items={RESCUE_CHECKS} json={s.rescue_checks} editable={draft} onChange={set('rescue_checks')} />
        <Field2 label="Où se trouve la trousse de secours" value={s.first_aid_location} editable={draft} onSave={set('first_aid_location')} />
        <Field2 label="Point de rencontre des secours (PRS)" value={s.meeting_point} editable={draft} onSave={set('meeting_point')} />
        <TextBlock key={`Organisation des secours:${s.rescue ?? ""}`} label="Organisation des secours" value={s.rescue} editable={draft} onSave={set('rescue')} />
        <TextBlock key={`Numéros utiles, hôpital, point de rendez-vous des secours:${s.emergency_contacts ?? ""}`} label="Numéros utiles, hôpital, point de rendez-vous des secours" value={s.emergency_contacts} editable={draft} onSave={set('emergency_contacts')} />
        {draft && job?.site_lat != null ? (
          <SecondaryButton
            label="Proposer les urgences les plus proches"
            icon="medkit-outline"
            onPress={() => set('emergency_contacts')(emergencyBlock({ address: job.site_address, lat: job.site_lat, lng: job.site_lng }))}
          />
        ) : null}
        <Muted>Urgences proposées d&apos;après le GPS du chantier (liste des hôpitaux publics de La Réunion) : vérifie l&apos;itinéraire avant le chantier.</Muted>
      </Card>
      <Card title="7. Intempéries et phénomènes météo imprévus">
        <TextBlock key={`Consignes météo:${s.weather_procedure ?? ""}`} label="Consignes en cas d'intempéries" value={s.weather_procedure} editable={draft} onSave={set('weather_procedure')} />
      </Card>
      <Card title="Observations / consignes particulières">
        <TextBlock key={`Observations:${s.observations ?? ""}`} label="Observations" value={s.observations} editable={draft} onSave={set('observations')} />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {company?.role === 'gerant' ? (
        <SecondaryButton
          label="Garder ces textes pour mes prochaines fiches"
          icon="bookmark-outline"
          onPress={async () => {
            if (!(await confirmAction('Garder ces textes ?', 'Équipements, risques habituels, mesures de prévention, conduite à tenir et secours seront repris sur chaque nouvelle fiche. Tu pourras revenir aux textes proposés depuis la fiche entreprise.', 'Garder'))) return;
            await saveSheetDefaults(s.id);
            setSaved(true);
          }}
        />
      ) : null}
      {saved ? <Text style={styles.ok}>Textes gardés : ils seront repris sur tes prochaines fiches.</Text> : null}
      {draft ? <SignCard sheet={s} missing={missing} onError={setError} /> : null}
      {s.status === 'signee' ? <AcksCard sheet={s} acks={acks} team={team} onError={setError} /> : null}

      <SecondaryButton label={busy ? 'Préparation du PDF…' : draft ? 'PDF de la fiche (brouillon)' : 'Envoyer la fiche (SMS, WhatsApp, e-mail…)'} icon={draft ? 'document-text-outline' : 'share-outline'} disabled={busy} onPress={() => pdf(false)} />
      {s.status === 'signee' ? (
        <>
          <Button label={busy ? 'Préparation…' : 'Version papier à imprimer'} icon="print-outline" disabled={busy} onPress={() => pdf(true)} />
          <Muted>Pour le chantier : la fiche complète, des lignes pour que chaque intervenant signe à la main, et une page « À afficher sur le chantier » (numéros d&apos;urgence, adresse, point de rencontre). Sur iPhone : touche « Imprimer » dans le menu de partage.</Muted>
        </>
      ) : null}
      {s.status === 'signee' ? (
        <SecondaryButton
          label="Corriger : nouvelle version"
          icon="copy-outline"
          onPress={async () => {
            if (!(await confirmAction('Nouvelle version ?', 'Une copie modifiable est créée. La version signée reste gardée 2 ans ; elle sera remplacée quand la nouvelle sera signée.', 'Créer'))) return;
            const nid = await createSheet(s.job_id);
            router.replace({ pathname: '/fiches/[id]', params: { id: nid } });
          }}
        />
      ) : null}
      <Muted>{RESPONSIBILITY}</Muted>
    </ScrollView>
  );
}

function Field2({ label, value, editable, onSave, keyboard, placeholder }: { label: string; value: string | null; editable: boolean; onSave: (v: string | null) => void; keyboard?: 'phone-pad' | 'number-pad'; placeholder?: string }) {
  const [t, setT] = useState(value ?? '');
  if (!editable) {
    return value ? (
      <Text style={styles.text}>
        <Text style={styles.label}>{label} : </Text>
        {value}
      </Text>
    ) : null;
  }
  return <Field label={label} value={t} onChangeText={setT} onBlur={() => t !== (value ?? '') && onSave(t.trim() || null)} keyboardType={keyboard} placeholder={placeholder} />;
}

// Liste à cocher du modèle MSA, enregistrée en JSON {checked, other}. Plusieurs listes peuvent partager le même JSON.
function CheckList({ label, items, json, editable, onChange, hideOther }: { label: string; items: string[]; json: string | null; editable: boolean; onChange: (v: string) => void; hideOther?: boolean }) {
  const v = parseJson<CheckValue>(json, { checked: [], other: '' });
  const shown = editable ? items : items.filter((i) => v.checked.includes(i));
  if (!editable && !shown.length && !v.other) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.label}>{label}</Text>
      {shown.map((i) => {
        const on = v.checked.includes(i);
        return (
          <Pressable
            key={i}
            disabled={!editable}
            style={styles.check}
            onPress={() => onChange(JSON.stringify({ ...v, checked: on ? v.checked.filter((x) => x !== i) : [...v.checked, i] }))}
            accessibilityRole="checkbox"
            aria-checked={on}
            aria-disabled={!editable}
            accessibilityLabel={i}
          >
            <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={Colors.primary} />
            <Text style={[styles.text, { flex: 1 }]}>{i}</Text>
          </Pressable>
        );
      })}
      {!hideOther ? <OtherField label="Autres (à préciser)" json={json} editable={editable} onChange={onChange} /> : null}
    </View>
  );
}

function OtherField({ label, json, editable, onChange }: { label: string; json: string | null; editable: boolean; onChange: (v: string) => void }) {
  const v = parseJson<CheckValue>(json, { checked: [], other: '' });
  return <TextBlock key={`${label}:${v.other}`} label={label} value={v.other || null} editable={editable} onSave={(o) => onChange(JSON.stringify({ ...v, other: o ?? '' }))} />;
}

function TextBlock({ label, value, editable, onSave }: { label: string; value: string | null; editable: boolean; onSave: (v: string | null) => void }) {
  const [t, setT] = useState(value ?? '');
  if (!editable) {
    return value ? (
      <View style={{ gap: 2 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.text}>{value}</Text>
      </View>
    ) : null;
  }
  return <Field label={label} value={t} onChangeText={setT} onBlur={() => t !== (value ?? '') && onSave(t)} multiline />;
}

function SignCard({ sheet, missing, onError }: { sheet: SheetRow; missing: string[]; onError: (e: string | null) => void }) {
  const { session } = useAuth();
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState('');
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const sign = async () => {
    onError(null);
    const image = await pad.current?.toJpeg();
    if (!image) return onError('Signe dans le cadre.');
    setBusy(true);
    try {
      await signSheet(sheet.id, name, image, await quickPosition(3000));
      kickUploader();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <Card title="Signature du chef d'entreprise">
      {missing.length ? <Text style={styles.warning}>À compléter avant de signer : {missing.join(', ')}.</Text> : <Muted>Une fois signée, la fiche ne change plus (pour corriger : nouvelle version).</Muted>}
      <Field label="Nom du chef d'entreprise" value={name} onChangeText={setName} autoCapitalize="words" placeholder={session?.user.email ?? ''} />
      <SignaturePad ref={pad} onInk={setInk} />
      <Button label={busy ? 'Enregistrement…' : 'Signer la fiche'} icon="create-outline" onPress={sign} disabled={busy || !ink || missing.length > 0 || !name.trim()} />
    </Card>
  );
}

function AcksCard({ sheet, acks, team, onError }: { sheet: SheetRow; acks: AckRow[]; team: JobMemberRow[]; onError: (e: string | null) => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [who, setWho] = useState<{ id: string | null; name: string } | null>(null);
  const [other, setOther] = useState('');
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = team.filter((t) => !acks.some((a) => a.member_id === t.member_id));
  const sign = async () => {
    onError(null);
    const m = who ?? { id: null, name: other };
    const image = await pad.current?.toJpeg();
    if (!image) return onError('L’intervenant doit signer dans le cadre.');
    setBusy(true);
    try {
      await acknowledgeSheet(sheet.id, m, image);
      kickUploader();
      setWho(null);
      setOther('');
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <Card title={`Présentée aux intervenants (${acks.length}/${team.length || acks.length})`}>
      <Muted>Avant le début des travaux, chaque intervenant lit la fiche (ou tu la lui présentes), puis signe pour l&apos;attester.</Muted>
      {acks.map((a) => (
        <View key={a.id} style={styles.ack}>
          <Icon name="checkmark-circle" size={20} color={Colors.primary} />
          <Text style={[styles.text, { flex: 1 }]}>
            {a.name} – {toDate(a.acknowledged_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          </Text>
          {a.signature_photo_id ? (
            <View style={{ width: 90 }}>
              <LocalImage fileId={a.signature_photo_id} alt={`Signature de ${a.name}`} aspectRatio={600 / 240} companyId={sheet.company_id} uploaded />
            </View>
          ) : null}
        </View>
      ))}
      {pending.length ? <Text style={styles.warning}>Pas encore signé : {pending.map((p) => p.name).join(', ')}.</Text> : null}
      <Text style={styles.label}>Qui signe maintenant ?</Text>
      <View style={styles.chips}>
        {pending.map((p) => {
          const on = who?.id === p.member_id;
          return (
            <Pressable key={p.member_id} onPress={() => setWho(on ? null : { id: p.member_id, name: p.name })} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" aria-checked={on}>
              <Text style={[styles.chipText, on && { color: Colors.primaryText }]}>{p.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {!who ? <Field label="Ou nom d'un autre intervenant (sous-traitant…)" value={other} onChangeText={setOther} autoCapitalize="words" /> : null}
      <SignaturePad ref={pad} onInk={setInk} />
      <Button label={busy ? 'Enregistrement…' : 'Valider : fiche présentée'} icon="create-outline" onPress={sign} disabled={busy || !ink || (!who && !other.trim())} />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#F6E7D6', borderRadius: 10, padding: Spacing.md },
  bannerOk: { backgroundColor: '#E3F0E8' },
  text: { fontSize: 16, color: Colors.text },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  warning: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
  error: { fontSize: 15, color: Colors.danger },
  ok: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: Colors.card },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, color: Colors.text },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  thumb: { width: 90, borderWidth: 2, borderColor: 'transparent', borderRadius: 6, overflow: 'hidden' },
  thumbOn: { borderColor: Colors.primary },
  ack: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
});
