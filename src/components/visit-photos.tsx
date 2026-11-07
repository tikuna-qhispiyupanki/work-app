import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { LocalImage } from '@/components/local-image';
import { PhotoPicker } from '@/components/photo-picker';
import { Card, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { addPhoto, OWNER_PHOTOS_SQL, PhotoRow } from '@/db/photos';
import { quickPosition } from '@/domain/geo';
import { compressImage, HD_QUALITY, PHOTO_HD_MAX, PHOTO_MAX, QUALITY } from '@/files/image';
import { kickUploader } from '@/sync/uploader';

// Photos d'une visite (ou plus tard d'un arbre, d'un chantier) : prise, compression, miniatures.
export function VisitPhotos({ ownerType, ownerId, title = 'Photos' }: { ownerType: 'visit' | 'tree'; ownerId: string; title?: string }) {
  const { data: photos } = useQuery<PhotoRow>(OWNER_PHOTOS_SQL, [ownerType, ownerId]);
  const [hd, setHd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPicked = async (files: File[]) => {
    setError(null);
    const position = quickPosition(); // en parallèle de la compression
    try {
      for (const [i, file] of files.entries()) {
        setBusy(files.length > 1 ? `Préparation ${i + 1}/${files.length}…` : 'Préparation de la photo…');
        const image = await compressImage(file, hd ? PHOTO_HD_MAX : PHOTO_MAX, hd ? HD_QUALITY : QUALITY);
        const p = await position;
        await addPhoto({ ownerType, ownerId, kind: 'photo', image, lat: p?.lat, lng: p?.lng });
      }
      kickUploader();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title={`${title}${photos.length ? ` (${photos.length})` : ''}`}>
      <PhotoPicker onPicked={onPicked} disabled={!!busy} />
      <View style={styles.hdRow}>
        <Text style={styles.hdLabel}>Haute définition (diagnostic, expertise)</Text>
        <Switch value={hd} onValueChange={setHd} trackColor={{ true: Colors.primary }} accessibilityLabel="Haute définition" />
      </View>
      {busy ? <Muted>{busy}</Muted> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {photos.length ? (
        <View style={styles.grid}>
          {photos.map((p) => (
            <Pressable
              key={p.id}
              style={styles.cell}
              onPress={() => router.push({ pathname: '/photos/[id]', params: { id: p.id } })}
              accessibilityRole="button"
              accessibilityLabel="Voir la photo"
            >
              <LocalImage fileId={p.id} alt="Miniature de photo" aspectRatio={1} thumb companyId={p.company_id} uploaded={!!p.storage_path} />
              {!p.storage_path ? <Text style={styles.badge}>⏳</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <Muted>Aucune photo. Elles sont compressées sur le téléphone puis envoyées dès qu&apos;il y a du réseau.</Muted>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  hdLabel: { fontSize: 15, color: Colors.text, flex: 1 },
  error: { color: Colors.danger, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '31.5%', position: 'relative' },
  badge: { position: 'absolute', right: 4, bottom: 4, fontSize: 14 },
});
