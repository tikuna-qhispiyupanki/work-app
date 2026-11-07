import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalImage } from '@/components/local-image';
import { Card, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { PhotoRow } from '@/db/photos';

const SQL = `SELECT id, company_id, kind, width, height, storage_path, taken_at, lat, lng, caption FROM photos
  WHERE owner_type = 'visit' AND owner_id = ? AND kind IN ('croquis', 'plan', 'photo') AND deleted_at IS NULL ORDER BY taken_at`;

// Croquis de la visite : page blanche, sur le plan (vue aérienne avec les arbres) ou sur une photo.
export function VisitSketches({ visitId }: { visitId: string }) {
  const { data } = useQuery<PhotoRow>(SQL, [visitId]);
  const [choosePhoto, setChoosePhoto] = useState(false);
  const sketches = data.filter((p) => p.kind === 'croquis');
  const plan = data.filter((p) => p.kind === 'plan').at(-1);
  const photos = data.filter((p) => p.kind === 'photo');
  const open = (fond?: string) => router.push({ pathname: '/croquis', params: { visit: visitId, ...(fond ? { fond } : {}) } });

  return (
    <Card title={`Croquis${sketches.length ? ` (${sketches.length})` : ''}`}>
      {sketches.length ? (
        <View style={styles.grid}>
          {sketches.map((s) => (
            <Pressable key={s.id} style={styles.cell} onPress={() => router.push({ pathname: '/photos/[id]', params: { id: s.id } })} accessibilityRole="button" accessibilityLabel="Voir le croquis">
              <LocalImage fileId={s.id} alt="Croquis" aspectRatio={s.width / s.height} thumb companyId={s.company_id} uploaded={!!s.storage_path} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Muted>Accès, circulation, zones à protéger, arbres à traiter : le croquis servira aussi à la fiche d&apos;intervention.</Muted>
      )}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="✏️ Page blanche" onPress={() => open()} />
        </View>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="✏️ Sur le plan" onPress={() => plan && open(plan.id)} disabled={!plan} />
        </View>
      </View>
      {!plan ? <Muted>« Sur le plan » : enregistre d&apos;abord l&apos;image du plan (carte de la visite).</Muted> : null}
      <SecondaryButton label="✏️ Sur une photo de la visite" onPress={() => setChoosePhoto(!choosePhoto)} disabled={!photos.length} />
      {choosePhoto ? (
        <View style={styles.grid}>
          {photos.map((p) => (
            <Pressable key={p.id} style={styles.cell} onPress={() => open(p.id)} accessibilityRole="button" accessibilityLabel="Dessiner sur cette photo">
              <LocalImage fileId={p.id} alt="Photo à annoter" aspectRatio={1} thumb companyId={p.company_id} uploaded={!!p.storage_path} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {!photos.length ? <Text style={styles.hint}>Prends d&apos;abord une photo de la visite pour pouvoir l&apos;annoter.</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '31.5%' },
  hint: { fontSize: 13, color: Colors.textSecondary },
});
