import { useQuery } from '@powersync/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { NumberField } from '@/components/number-field';
import { Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { VisitPhotos } from '@/components/visit-photos';
import { Colors, Spacing } from '@/constants/theme';
import { ACTIVE_GRID_SQL, GRID_ITEMS_SQL, GridRow, gridParams, PriceItemRow } from '@/db/prices';
import { TREE_SQL, TreeFields, TreeRow, updateTree } from '@/db/trees';
import { euros, percent } from '@/domain/pricing';
import { estimateTree, suggestItemForHeight } from '@/domain/tree-estimate';

// Fiche complète d'un arbre : ce qui servira au devis et à la fiche d'intervention.
export default function TreeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<TreeRow>(TREE_SQL, [id]);
  const { data: grids } = useQuery<GridRow>(ACTIVE_GRID_SQL);
  const grid = grids[0];
  const { data: items } = useQuery<PriceItemRow>(GRID_ITEMS_SQL, [grid?.id ?? '']);
  const [choosing, setChoosing] = useState(false);
  const t = data[0];

  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!t) return <Muted>Arbre introuvable.</Muted>;

  const save = (f: TreeFields) => void updateTree(t.id, f);
  // L'intervention choisie dans une ancienne grille est retrouvée par son libellé dans la grille active.
  const item = items.find((i) => i.id === t.price_item_id) ?? items.find((i) => i.label === t.intervention) ?? null;
  const suggestion = suggestItemForHeight(items, t.height_m);
  const params = grid ? gridParams(grid) : null;
  const est = params ? estimateTree(t, item, params) : null;

  const chooseItem = (i: PriceItemRow) => {
    save({ price_item_id: i.id, intervention: i.label });
    setChoosing(false);
  };
  const onDiameter = (v: number | null) => {
    // Tronc de plus de 60 cm : la majoration est cochée automatiquement (décochable).
    save(v != null && v > 60 && !t.big_trunk ? { trunk_diameter_cm: v, big_trunk: 1 } : { trunk_diameter_cm: v });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title={`Arbre n° ${t.number}`}>
        <TextField label="Nom ou essence" value={t.species ?? ''} onCommit={(v) => save({ species: v })} placeholder="Ex. Manguier, Filao côté piscine…" />
        <TextField label="Repère pour l'équipe" value={t.notes ?? ''} onCommit={(v) => save({ notes: v })} placeholder="Ex. au fond à droite du portail" multiline />
        {t.lat == null ? <Muted>Pas encore placé sur la carte (tu peux le faire depuis la visite).</Muted> : null}
      </Card>

      <Card title="Mesures">
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <NumberField label="Hauteur" unit="m" value={t.height_m} onCommit={(v) => save({ height_m: v })} />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Diamètre du tronc" unit="cm" value={t.trunk_diameter_cm} onCommit={onDiameter} />
          </View>
        </View>
      </Card>

      <Card title="Intervention">
        {!grid ? (
          <Muted>Aucune grille de prix : charge-la dans 👤 → « Grille de prix » pour choisir l&apos;intervention et voir le prix.</Muted>
        ) : (
          <>
            <Text style={styles.big}>{item?.label ?? t.intervention ?? 'Pas encore choisie'}</Text>
            {suggestion && suggestion.id !== item?.id ? (
              <Pressable onPress={() => chooseItem(suggestion)} accessibilityRole="button" style={styles.suggest}>
                <Text style={styles.suggestText}>Suggestion pour {String(t.height_m).replace('.', ',')} m : {suggestion.label} → choisir</Text>
              </Pressable>
            ) : null}
            <SecondaryButton label={choosing ? 'Fermer la liste' : item ? "Changer d'intervention" : "Choisir l'intervention"} onPress={() => setChoosing(!choosing)} />
            {choosing ? <ItemList items={items} selected={item?.id ?? null} onChoose={chooseItem} /> : null}
            <NumberField
              label="Quantité"
              unit={item?.unit ?? 'arbre'}
              value={t.quantity ?? 1}
              onCommit={(v) => v != null && v > 0 && save({ quantity: v })}
              allowEmpty={false}
            />
          </>
        )}
      </Card>

      <Card title="Contraintes">
        <Toggle label={`Rétention : piscine, toit, véranda, clôture ou voiture dessous${params ? ` (+${percent(params.surchargeRetentionBp)})` : ''}`} value={!!t.retention} onChange={(v) => save({ retention: v ? 1 : 0 })} />
        <Toggle label={`Tronc de plus de 60 cm${params ? ` (+${percent(params.surchargeBigTrunkBp)})` : ''}`} value={!!t.big_trunk} onChange={(v) => save({ big_trunk: v ? 1 : 0 })} />
        <Toggle label={`Urgence, week-end ou jour férié${params ? ` (+${percent(params.surchargeUrgentBp)})` : ''}`} value={!!t.urgent} onChange={(v) => save({ urgent: v ? 1 : 0 })} />
        <Toggle label="Pente, ravine, sol instable" value={!!t.slope} onChange={(v) => save({ slope: v ? 1 : 0 })} />
        {t.slope ? <Muted>→ Compte des heures en plus ci-dessous (grimpeur ou homme au sol).</Muted> : null}
        <Toggle label="Végétaux à sortir loin (portage, escaliers, pas d'accès camion)" value={!!t.far_disposal} onChange={(v) => save({ far_disposal: v ? 1 : 0 })} />
        {t.far_disposal ? <Muted>→ Compte les heures de portage ci-dessous (homme au sol).</Muted> : null}
        <Toggle label="Lignes électriques à proximité" value={!!t.power_lines} onChange={(v) => save({ power_lines: v ? 1 : 0 })} />
        {t.power_lines ? <Text style={styles.warn}>⚠ DT-DICT à faire avant les travaux. Prestation « Élagage près de lignes électriques » conseillée.</Text> : null}
      </Card>

      <Card title="Temps et déchets estimés">
        <NumberField label="Heures homme au sol (portage, protection, nettoyage)" unit="h" value={t.estimated_ground_hours ?? 0} onCommit={(v) => save({ estimated_ground_hours: v ?? 0 })} />
        <NumberField label="Heures grimpeur en plus (pente, contrainte)" unit="h" value={t.estimated_climber_hours ?? 0} onCommit={(v) => save({ estimated_climber_hours: v ?? 0 })} />
        <NumberField label="Déchets verts à évacuer" unit="m³" value={t.waste_m3 ?? 0} onCommit={(v) => save({ waste_m3: v ?? 0 })} />
      </Card>

      {est ? (
        <Card title="Estimation pour cet arbre">
          <Line label={`Prestation${est.surchargeBp ? ` (majorations +${percent(est.surchargeBp)})` : ''}`} cents={est.prestation} />
          <Line label="Temps supplémentaire" cents={est.temps} />
          <Line label="Évacuation des déchets" cents={est.dechets} />
          <View style={styles.totalRow}>
            <Text style={styles.total}>Total HT</Text>
            <Text style={styles.total}>{euros(est.total)}</Text>
          </View>
          <Muted>Aperçu : le devis ajoute le déplacement et les mentions légales (étape suivante).</Muted>
        </Card>
      ) : null}

      <VisitPhotos ownerType="tree" ownerId={t.id} title="Photos de l'arbre" />
    </ScrollView>
  );
}

function ItemList({ items, selected, onChoose }: { items: PriceItemRow[]; selected: string | null; onChoose: (i: PriceItemRow) => void }) {
  const groups = new Map<string, PriceItemRow[]>();
  for (const i of items) groups.set(i.category ?? 'Autres', [...(groups.get(i.category ?? 'Autres') ?? []), i]);
  return (
    <View style={{ gap: Spacing.sm }}>
      {[...groups].map(([cat, list]) => (
        <View key={cat}>
          <Text style={styles.cat}>{cat}</Text>
          {list.map((i) => (
            <Pressable key={i.id} onPress={() => onChoose(i)} style={[styles.choice, i.id === selected && styles.choiceOn]} accessibilityRole="button">
              <Text style={styles.choiceText}>{i.label}</Text>
              <Text style={styles.choicePrice}>
                {euros(i.my_price_cents ?? i.suggested_price_cents)} / {i.unit ?? 'unité'}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function TextField({ label, value, onCommit, placeholder, multiline }: { label: string; value: string; onCommit: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const [text, setText] = useState(value);
  return <Field label={label} value={text} onChangeText={setText} onBlur={() => text !== value && onCommit(text)} placeholder={placeholder} multiline={multiline} />;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.primary }} accessibilityLabel={label} />
    </View>
  );
}

function Line({ label, cents }: { label: string; cents: number }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{euros(cents)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  big: { fontSize: 17, fontWeight: '600', color: Colors.text },
  suggest: { backgroundColor: '#E6EFEC', borderRadius: 8, padding: Spacing.sm },
  suggestText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  cat: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginTop: 4 },
  choice: { paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  choiceOn: { backgroundColor: '#E6EFEC' },
  choiceText: { fontSize: 16, color: Colors.text },
  choicePrice: { fontSize: 14, color: Colors.textSecondary },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingVertical: 4 },
  toggleLabel: { fontSize: 15, color: Colors.text, flex: 1 },
  warn: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  lineLabel: { fontSize: 15, color: Colors.text, flex: 1 },
  lineValue: { fontSize: 15, color: Colors.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  total: { fontSize: 18, fontWeight: '700', color: Colors.primary },
});
