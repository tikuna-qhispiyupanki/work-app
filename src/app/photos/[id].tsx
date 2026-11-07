import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { confirmAction } from '@/components/confirm';
import { LocalImage } from '@/components/local-image';
import { Card, Muted, SecondaryButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { hidePhoto, PHOTO_SQL, PhotoRow } from '@/db/photos';
import { toDate } from '@/domain/dates';

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<PhotoRow>(PHOTO_SQL, [id]);
  const p = data[0];
  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!p) return <Muted>Photo introuvable.</Muted>;

  const remove = async () => {
    if (await confirmAction('Retirer cette photo ?', 'Elle ne sera plus affichée ni utilisée dans les rapports.', 'Retirer')) {
      await hidePhoto(p.id);
      router.back();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LocalImage fileId={p.id} alt="Photo" aspectRatio={p.width / p.height} companyId={p.company_id} uploaded={!!p.storage_path} />
      <Card>
        <Muted>Prise le {toDate(p.taken_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</Muted>
        {p.lat != null && p.lng != null ? <Muted>Position : {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</Muted> : <Muted>Position non enregistrée</Muted>}
        <Muted>
          {p.width} × {p.height} px · {p.storage_path ? '✓ envoyée au serveur' : '⏳ en attente d’envoi'}
        </Muted>
      </Card>
      <SecondaryButton label="Retirer la photo" danger onPress={remove} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl } });
