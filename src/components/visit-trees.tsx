import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmAction } from '@/components/confirm';
import { GeoMap, GeoMapHandle, MapMarker } from '@/components/geo-map';
import { Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { ACTIVE_GRID_SQL, GRID_ITEMS_SQL, GridRow, gridParams, PriceItemRow } from '@/db/prices';
import { addTree, deleteTree, TreeRow, updateTree, VISIT_TREES_SQL } from '@/db/trees';
import { euros } from '@/domain/pricing';
import { estimateTree } from '@/domain/tree-estimate';
import { savePlanImage } from '@/db/visits';
import { getCurrentPosition, GeoPoint } from '@/domain/geo';

type Mode = { kind: 'idle' } | { kind: 'add' } | { kind: 'move'; treeId: string; number: number };

// Arbres de la visite : placés sur la carte, numérotés et nommés, pour que l'équipe s'y retrouve.
export function VisitTrees({ visitId, site }: { visitId: string; site: GeoPoint | null }) {
  const { data: trees } = useQuery<TreeRow>(VISIT_TREES_SQL, [visitId]);
  const { data: grids } = useQuery<GridRow>(ACTIVE_GRID_SQL);
  const grid = grids[0];
  const { data: items } = useQuery<PriceItemRow>(GRID_ITEMS_SQL, [grid?.id ?? '']);
  const params = grid ? gridParams(grid) : null;
  const estimate = (t: TreeRow) => {
    if (!params) return null;
    const item = items.find((i) => i.id === t.price_item_id) ?? items.find((i) => i.label === t.intervention) ?? null;
    return estimateTree(t, item, params).total;
  };
  const visitTotal = params && trees.length ? trees.reduce((sum, t) => sum + (estimate(t) ?? 0), 0) + params.travelFlatCents : null;
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<GeoMapHandle>(null);

  const placed = trees.filter((t) => t.lat != null && t.lng != null);
  const center = site ?? (placed[0] ? { lat: placed[0].lat!, lng: placed[0].lng! } : null);
  const markers: MapMarker[] = [
    ...(site ? [{ id: 'site', kind: 'site' as const, lat: site.lat, lng: site.lng }] : []),
    ...placed.map((t) => ({
      id: t.id,
      kind: 'tree' as const,
      lat: t.lat!,
      lng: t.lng!,
      label: String(t.number),
      title: t.species || undefined,
      selected: mode.kind === 'move' && mode.treeId === t.id,
    })),
  ];

  const onTap = async (p: GeoPoint) => {
    if (mode.kind === 'add') {
      const t = await addTree(visitId, p.lat, p.lng);
      setEditing(t.id);
      setMessage(`Arbre n° ${t.number} placé. Donne-lui un nom ci-dessous, ou touche la carte pour en placer un autre.`);
    } else if (mode.kind === 'move') {
      await updateTree(mode.treeId, { lat: p.lat, lng: p.lng });
      setMessage(`Arbre n° ${mode.number} déplacé.`);
      setMode({ kind: 'idle' });
    }
  };

  const addWithoutMap = async () => {
    const t = await addTree(visitId, null, null);
    router.push({ pathname: '/arbres/[id]', params: { id: t.id } });
  };

  const addAtMyPosition = async () => {
    setBusy(true);
    setMessage('Recherche de la position…');
    try {
      const p = await getCurrentPosition();
      const t = await addTree(visitId, p.lat, p.lng);
      setEditing(t.id);
      setMessage(
        `Arbre n° ${t.number} placé à ta position${p.accuracyM ? ` (précision ${p.accuracyM} m)` : ''}. Sous les arbres le GPS peut dévier : vérifie sur la carte.`
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async () => {
    setBusy(true);
    try {
      const plan = await mapRef.current?.capture();
      if (!plan) {
        setMessage("Image impossible pour l'instant (pas de réseau ou carte pas encore chargée).");
        return;
      }
      await savePlanImage(visitId, plan, site?.lat ?? null, site?.lng ?? null);
      setMessage("Image du plan enregistrée avec les arbres. Elle est visible plus haut sur la fiche.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: TreeRow) => {
    const ok = await confirmAction(`Supprimer l'arbre n° ${t.number} ?`, t.species || 'Arbre sans nom', 'Supprimer');
    if (ok) await deleteTree(t.id);
  };

  const hint =
    mode.kind === 'add'
      ? '➕ Mode ajout : touche la carte à l’emplacement de chaque arbre. Glisse pour te déplacer.'
      : mode.kind === 'move'
        ? `↔ Touche la carte au nouvel emplacement de l'arbre n° ${mode.number}.`
        : 'Glisse pour te déplacer sur la carte.';

  return (
    <Card title={`Arbres${trees.length ? ` (${trees.length})` : ''}`}>
      {center ? (
        <GeoMap ref={mapRef} center={center} markers={markers} onTap={mode.kind === 'idle' ? undefined : onTap} hint={hint} />
      ) : (
        <Muted>Localise d&apos;abord le chantier (bouton « Modifier », puis « Me localiser » ou « Situer l&apos;adresse ») pour placer les arbres sur la carte.</Muted>
      )}

      {center ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              label={mode.kind === 'add' ? '✓ Terminer' : '➕ Placer des arbres'}
              onPress={() => {
                setMode(mode.kind === 'add' ? { kind: 'idle' } : { kind: 'add' });
                setMessage(null);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="🌳 Arbre à ma position" onPress={addAtMyPosition} disabled={busy} />
          </View>
        </View>
      ) : null}
      <SecondaryButton label="➕ Ajouter un arbre sans carte (hors-ligne)" onPress={addWithoutMap} />
      {message ? <Muted>{message}</Muted> : null}

      {trees.map((t) => (
        <View key={t.id} style={styles.tree}>
          <Pressable style={styles.treeHead} onPress={() => setEditing(editing === t.id ? null : t.id)} accessibilityRole="button">
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t.number}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.treeName}>{t.species || 'Arbre sans nom'}</Text>
              {t.intervention ? (
                <Text style={styles.treeNotes}>
                  {t.intervention}
                  {estimate(t) != null ? ` · ≈ ${euros(estimate(t)!)} HT` : ''}
                </Text>
              ) : null}
              {t.notes ? <Text style={styles.treeNotes}>{t.notes}</Text> : null}
              {t.lat == null ? <Text style={styles.treeNotes}>Pas encore placé sur la carte</Text> : null}
            </View>
            <Text style={styles.chevron}>{editing === t.id ? '▲' : '▼'}</Text>
          </Pressable>
          {editing === t.id ? (
            <>
              <SecondaryButton label="📋 Fiche complète (mesures, intervention, contraintes, photos)" onPress={() => router.push({ pathname: '/arbres/[id]', params: { id: t.id } })} />
              <TreeEditor tree={t} onMove={() => setMode({ kind: 'move', treeId: t.id, number: t.number })} onDelete={() => remove(t)} />
            </>
          ) : null}
        </View>
      ))}

      {visitTotal != null ? (
        <View style={styles.estimate}>
          <Text style={styles.estimateText}>Estimation de la visite : ≈ {euros(visitTotal)} HT</Text>
          <Muted>Arbres + déplacement. Le devis détaillé arrive à l&apos;étape suivante.</Muted>
        </View>
      ) : null}

      {placed.length && center ? (
        <SecondaryButton label="📷 Enregistrer l'image du plan avec les arbres" onPress={savePlan} disabled={busy} />
      ) : null}
    </Card>
  );
}

function TreeEditor({ tree, onMove, onDelete }: { tree: TreeRow; onMove: () => void; onDelete: () => void }) {
  const [species, setSpecies] = useState(tree.species ?? '');
  const [notes, setNotes] = useState(tree.notes ?? '');
  return (
    <View style={styles.editor}>
      <Field
        label={`Nom de l'arbre n° ${tree.number}`}
        value={species}
        onChangeText={setSpecies}
        onBlur={() => species !== (tree.species ?? '') && updateTree(tree.id, { species })}
        placeholder="Ex. Manguier, Filao côté piscine…"
        autoCapitalize="sentences"
      />
      <Field
        label="Repère pour l'équipe"
        value={notes}
        onChangeText={setNotes}
        onBlur={() => notes !== (tree.notes ?? '') && updateTree(tree.id, { notes })}
        placeholder="Ex. au fond à gauche du portail"
        multiline
      />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="↔ Déplacer sur la carte" onPress={onMove} />
        </View>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Supprimer" danger onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  tree: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: Spacing.sm },
  treeHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1B7F4B', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  treeName: { fontSize: 17, fontWeight: '500', color: Colors.text },
  treeNotes: { fontSize: 14, color: Colors.textSecondary },
  chevron: { fontSize: 14, color: Colors.textSecondary },
  editor: { gap: Spacing.sm, paddingLeft: 38 },
  estimate: { backgroundColor: '#E6EFEC', borderRadius: 8, padding: Spacing.sm, gap: 2 },
  estimateText: { fontSize: 17, fontWeight: '700', color: Colors.primary },
});
