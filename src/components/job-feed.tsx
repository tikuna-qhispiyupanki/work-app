import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LocalImage } from '@/components/local-image';
import { PhotoPicker } from '@/components/photo-picker';
import { Button, Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { addJobNote, addJobPhoto, FEED_SQL, FeedItem, setPhotoInReport } from '@/db/reports';
import { toDate } from '@/domain/dates';
import { quickPosition } from '@/domain/geo';
import { STAGE_LABEL } from '@/domain/report';
import { compressImage, PHOTO_MAX, QUALITY } from '@/files/image';
import { kickUploader } from '@/sync/uploader';

type Stage = 'avant' | 'pendant' | 'apres';

// Fil du chantier : notes (la dictée passe par le micro du clavier) et photos avant / pendant / après. Sans réseau.
export function JobFeed({ jobId, author }: { jobId: string; author: string | null }) {
  const { data: items } = useQuery<FeedItem>(FEED_SQL, [jobId]);
  const [note, setNote] = useState('');
  const [stage, setStage] = useState<Stage>('avant');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPicked = async (files: File[]) => {
    setError(null);
    const pos = quickPosition();
    try {
      for (const [i, f] of files.entries()) {
        setBusy(files.length > 1 ? `Préparation ${i + 1}/${files.length}…` : 'Préparation de la photo…');
        await addJobPhoto(jobId, await compressImage(f, PHOTO_MAX, QUALITY), stage, await pos);
      }
      kickUploader();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card title="Ajouter au fil du chantier">
        <Field label="Note (tu peux dicter avec le micro du clavier)" value={note} onChangeText={setNote} multiline />
        <Button
          label="Ajouter la note"
          icon="chatbox-ellipses-outline"
          disabled={!note.trim()}
          onPress={async () => {
            await addJobNote(jobId, note, author);
            setNote('');
          }}
        />
        <Text style={styles.label}>Photo</Text>
        <View style={styles.chips}>
          {(['avant', 'pendant', 'apres'] as const).map((s) => (
            <Pressable key={s} onPress={() => setStage(s)} style={[styles.chip, stage === s && styles.chipOn]} accessibilityRole="radio" aria-checked={stage === s} accessibilityLabel={`Photo ${STAGE_LABEL[s]}`}>
              <Text style={[styles.chipText, stage === s && { color: Colors.primaryText }]}>{STAGE_LABEL[s]}</Text>
            </Pressable>
          ))}
        </View>
        <PhotoPicker onPicked={onPicked} disabled={!!busy} />
        {busy ? <Muted>{busy}</Muted> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card title={`Fil du chantier (${items.length})`}>
        {items.length === 0 ? <Muted>Rien pour l&apos;instant : photos « avant » au début, notes pendant, photos « après » à la fin.</Muted> : null}
        {items.map((it) =>
          it.kind === 'note' ? (
            <View key={it.id} style={styles.item}>
              <Icon name="chatbox-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>{it.body}</Text>
                <Muted>
                  {toDate(it.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  {it.author ? ` · ${it.author}` : ''}
                </Muted>
              </View>
            </View>
          ) : (
            <View key={it.id} style={styles.item}>
              <Pressable style={{ width: 96 }} onPress={() => router.push({ pathname: '/photos/[id]', params: { id: it.id } })} accessibilityRole="button" accessibilityLabel="Voir la photo du chantier">
                <LocalImage fileId={it.id} alt="Photo du chantier" aspectRatio={1} thumb companyId={it.company_id} uploaded={!!it.storage_path} />
              </Pressable>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.stage}>{it.stage ? STAGE_LABEL[it.stage] : 'Photo'}</Text>
                <Muted>
                  {toDate(it.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  {!it.storage_path ? ' · pas encore envoyée' : ''}
                </Muted>
                <Pressable style={styles.check} onPress={() => void setPhotoInReport(it.id, !it.include_in_report)} accessibilityRole="checkbox" aria-checked={!!it.include_in_report} accessibilityLabel="Dans le rapport du client">
                  <Icon name={it.include_in_report ? 'checkbox' : 'square-outline'} size={20} color={Colors.primary} />
                  <Text style={styles.small}>Dans le rapport du client</Text>
                </Pressable>
              </View>
            </View>
          )
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  text: { fontSize: 16, color: Colors.text },
  small: { fontSize: 14, color: Colors.text },
  stage: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  error: { fontSize: 15, color: Colors.danger },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.card },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 15, color: Colors.text },
  item: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-start' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
