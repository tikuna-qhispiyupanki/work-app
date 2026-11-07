import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SketchEditor, SketchHandle } from '@/components/sketch-editor';
import { Button, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db/database';
import { addPhoto, hidePhoto, storagePath } from '@/db/photos';
import { readFile } from '@/files/local-files';
import { fetchRemotePhoto, kickUploader } from '@/sync/uploader';

// Écran de dessin. Paramètres : visit (visite), fond (identifiant d'une photo/plan/croquis, ou vide = page blanche),
// remplace (croquis retouché : l'ancien est masqué après enregistrement).
export default function SketchScreen() {
  const { visit, fond, remplace } = useLocalSearchParams<{ visit: string; fond?: string; remplace?: string }>();
  const editor = useRef<SketchHandle>(null);
  const [background, setBackground] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(!!fond);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!fond) return;
    (async () => {
      const p = await db.getOptional<{ company_id: string; storage_path: string | null }>('SELECT company_id, storage_path FROM photos WHERE id = ?', [fond]);
      const blob = (await readFile(fond)) ?? (p?.storage_path ? await fetchRemotePhoto(storagePath(p.company_id, fond), fond) : null);
      if (!blob) setError("Image de fond indisponible (elle est sur un autre appareil et il n'y a pas de réseau).");
      setBackground(blob ?? null);
      setLoading(false);
    })();
  }, [fond]);

  const save = async () => {
    setError(null);
    if (!editor.current?.strokes()) return setError('Dessine au moins un trait avant d’enregistrer.');
    setBusy(true);
    try {
      const image = await editor.current.toJpeg();
      if (!image) throw new Error('Image du croquis impossible à créer.');
      await addPhoto({ ownerType: 'visit', ownerId: visit, kind: 'croquis', image });
      if (remplace) await hidePhoto(remplace);
      kickUploader();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {loading ? <Muted>Chargement de l&apos;image…</Muted> : <SketchEditor ref={editor} background={background} />}
      <Muted>Dessine au doigt. Indique les accès, la circulation, les zones à protéger, les arbres à traiter.</Muted>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={busy ? 'Enregistrement…' : '✓ Enregistrer le croquis'} onPress={save} disabled={busy || loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  error: { color: Colors.danger, fontSize: 15 },
});
