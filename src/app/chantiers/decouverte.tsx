import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { PhotoPicker } from '@/components/photo-picker';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db/database';
import { addFinding, FINDING_PHOTOS_SQL, FINDINGS_SQL, FindingRow } from '@/db/networks';
import { storagePath } from '@/db/photos';
import { toDate } from '@/domain/dates';
import { quickPosition } from '@/domain/geo';
import { RESPONSIBILITY } from '@/domain/intervention';
import { FINDING_STEPS, NETWORK_TYPES } from '@/domain/networks';
import { compressImage, CompressedImage, PHOTO_MAX, QUALITY } from '@/files/image';
import { readFile } from '@/files/local-files';
import { buildFindingPdf } from '@/pdf/network-pdf';
import { shareFile } from '@/pdf/share';
import { fetchRemotePhoto, kickUploader } from '@/sync/uploader';

// Découverte fortuite d'un réseau : consignes immédiates, puis constat (photos, GPS) en PDF. Sans réseau.
export default function FindingScreen() {
  const { job } = useLocalSearchParams<{ job: string }>();
  const { session } = useAuth();
  const { data: jobs } = useQuery<{ title: string | null; site_address: string | null; company_id: string }>('SELECT title, site_address, company_id FROM jobs WHERE id = ?', [job]);
  const { data: findings } = useQuery<FindingRow>(FINDINGS_SQL, [job]);
  const [type, setType] = useState('inconnu');
  const [damage, setDamage] = useState<string | null>('aucun');
  const [description, setDescription] = useState('');
  const [actions, setActions] = useState('Arrêt des travaux, zone balisée, personnes éloignées.');
  const [operator, setOperator] = useState('');
  const [reporter, setReporter] = useState(session?.user.email ?? '');
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const j = jobs[0];

  const pdf = async (f: FindingRow) => {
    const company = (await db.getOptional<Record<string, string>>('SELECT * FROM companies WHERE id = ?', [f.company_id])) ?? {};
    const ph = await db.getAll<{ id: string; company_id: string; width: number; height: number }>(FINDING_PHOTOS_SQL, [f.id]);
    const photos = [];
    for (const p of ph) {
      const blob = (await readFile(p.id)) ?? (await fetchRemotePhoto(storagePath(p.company_id, p.id), p.id));
      if (blob) photos.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: p.width, height: p.height });
    }
    const data = buildFindingPdf({ company, jobTitle: j?.title ?? 'Chantier', siteAddress: j?.site_address ?? null, finding: f, photos });
    await shareFile(data, `Constat-decouverte-reseau-${f.found_at.slice(0, 10)}.pdf`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title="Tout de suite">
        {FINDING_STEPS.map((s, i) => (
          <Text key={i} style={[styles.text, i === 0 && styles.strong]}>
            {i + 1}. {s}
          </Text>
        ))}
        <View style={styles.row}>
          <Pressable style={[styles.call, { backgroundColor: '#C62828' }]} onPress={() => Linking.openURL('tel:18')} accessibilityRole="button" accessibilityLabel="Appeler le 18, Pompiers">
            <Text style={styles.callNum}>18</Text>
            <Text style={styles.callLbl}>Pompiers</Text>
          </Pressable>
          <Pressable style={[styles.call, { backgroundColor: '#2E7D32' }]} onPress={() => Linking.openURL('tel:112')} accessibilityRole="button" accessibilityLabel="Appeler le 112">
            <Text style={styles.callNum}>112</Text>
            <Text style={styles.callLbl}>Urgences</Text>
          </Pressable>
        </View>
        <Muted>Le numéro d&apos;urgence de chaque exploitant figure sur son récépissé de DT-DICT (onglet Infos du chantier).</Muted>
      </Card>

      <Card title="Constat">
        <Text style={styles.label}>Type de réseau (couleur du grillage ou de la gaine)</Text>
        <View style={styles.chips}>
          {NETWORK_TYPES.map((t) => (
            <Pressable key={t.key} onPress={() => setType(t.key)} style={[styles.chip, type === t.key && styles.chipOn]} accessibilityRole="radio" aria-checked={type === t.key}>
              <Text style={[styles.chipText, type === t.key && { color: Colors.primaryText }]}>
                {t.label}
                {t.color ? ` (${t.color})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Dommage</Text>
        <View style={styles.chips}>
          {[['aucun', 'Aucun'], ['leger', 'Léger'], ['important', 'Important']].map(([k, l]) => (
            <Pressable key={k} onPress={() => setDamage(k)} style={[styles.chip, damage === k && styles.chipOn]} accessibilityRole="radio" aria-checked={damage === k} accessibilityLabel={`Dommage ${l}`}>
              <Text style={[styles.chipText, damage === k && { color: Colors.primaryText }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Description (profondeur, position, état)" value={description} onChangeText={setDescription} multiline />
        <Field label="Mesures prises" value={actions} onChangeText={setActions} multiline />
        <Field label="Exploitant prévenu (nom, heure, n° d'appel)" value={operator} onChangeText={setOperator} />
        <Field label="Constat établi par" value={reporter} onChangeText={setReporter} />
        <PhotoPicker
          disabled={busy}
          onPicked={async (files) => {
            const out = [];
            for (const f of files) out.push(await compressImage(f, PHOTO_MAX, QUALITY));
            setImages([...images, ...out]);
          }}
        />
        {images.length ? <Muted>{images.length} photo(s) prête(s) pour le constat.</Muted> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={busy ? 'Enregistrement…' : 'Enregistrer le constat (avec la position GPS)'}
          icon="save-outline"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await addFinding(job, { network_type: type, description, damage, actions_taken: actions, operator_contacted: operator, reporter_name: reporter }, await quickPosition(4000), images);
              kickUploader();
              setImages([]);
              setDescription('');
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
        />
      </Card>

      {findings.length ? (
        <Card title={`Constats (${findings.length})`}>
          {findings.map((f) => (
            <View key={f.id} style={styles.item}>
              <Text style={styles.text}>
                {toDate(f.found_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} – {NETWORK_TYPES.find((t) => t.key === f.network_type)?.label}
              </Text>
              {f.description ? <Muted>{f.description}</Muted> : null}
              <SecondaryButton label="Constat en PDF (à envoyer)" icon="share-outline" onPress={() => void pdf(f)} />
            </View>
          ))}
        </Card>
      ) : null}
      <SecondaryButton label="Retour au chantier" onPress={() => router.back()} />
      <Muted>{RESPONSIBILITY}</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  text: { fontSize: 16, color: Colors.text },
  strong: { fontWeight: '700', color: Colors.danger },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  error: { fontSize: 15, color: Colors.danger },
  row: { flexDirection: 'row', gap: Spacing.sm },
  call: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  callNum: { color: '#fff', fontSize: 26, fontWeight: '800' },
  callLbl: { color: '#fff', fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: Colors.card },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, color: Colors.text },
  item: { gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
});
