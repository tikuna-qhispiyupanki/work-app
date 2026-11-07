import { useQuery } from '@powersync/react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { confirmAction } from '@/components/confirm';
import { FileButton } from '@/components/file-button';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { BASE_PATH } from '@/config/base-path';
import { Colors, Spacing } from '@/constants/theme';
import { ACTIVE_GRID_SQL, GRID_ITEMS_SQL, GridRow, PriceItemRow, saveImportedGrid, setGridParam, setMyPrice } from '@/db/prices';
import { toDate } from '@/domain/dates';
import { importGridWorkbook, ImportedGrid } from '@/domain/grid-import';
import { euros, percent, retainedPriceCents } from '@/domain/pricing';

const STARTER_FILE = 'grille-tarifaire-reunion-2026.xlsx';

// Grille de prix : paramètres, prestations (prix conseillé / mon prix), import du fichier Excel.
export default function GridScreen() {
  const { company } = useAuth();
  const canEdit = company?.role === 'gerant' || company?.role === 'bureau';
  const { data: grids, isLoading } = useQuery<GridRow>(ACTIVE_GRID_SQL);
  const grid = grids[0];
  const { data: items } = useQuery<PriceItemRow>(GRID_ITEMS_SQL, [grid?.id ?? '']);
  const [preview, setPreview] = useState<{ grid: ImportedGrid; file: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const readFile = async (bytes: ArrayBuffer, name: string) => {
    setError(null);
    try {
      setPreview({ grid: importGridWorkbook(new Uint8Array(bytes)), file: name });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const loadStarter = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${BASE_PATH}/${STARTER_FILE}`);
      if (!res.ok) throw new Error('Grille de départ introuvable.');
      await readFile(await res.arrayBuffer(), STARTER_FILE);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const confirmImport = async () => {
    if (!preview) return;
    if (grid && !(await confirmAction('Remplacer la grille ?', 'La grille actuelle est gardée en archive. Les devis déjà faits ne changent pas.', 'Remplacer'))) return;
    setBusy(true);
    try {
      await saveImportedGrid(preview.grid, preview.file);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Muted>Chargement…</Muted>;

  if (preview) {
    const cats = new Set(preview.grid.items.map((i) => i.category)).size;
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card title="Vérification avant import">
          <Muted>Fichier : {preview.file}</Muted>
          <Text style={styles.ok}>
            ✓ {preview.grid.items.length} prestations dans {cats} catégories
          </Text>
          <Text style={styles.ok}>✓ Paramètres lus (taux horaires, déplacement, déchets, majorations)</Text>
          {preview.grid.warnings.length ? (
            preview.grid.warnings.map((w, i) => (
              <Text key={i} style={styles.warn}>
                ⚠ {w}
              </Text>
            ))
          ) : (
            <Text style={styles.ok}>✓ Prix recalculés identiques à ceux du fichier</Text>
          )}
        </Card>
        <Button label={busy ? 'Enregistrement…' : grid ? 'Remplacer la grille actuelle' : 'Enregistrer cette grille'} onPress={confirmImport} disabled={busy} />
        <SecondaryButton label="Annuler" onPress={() => setPreview(null)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!grid ? (
        <Card title="Aucune grille de prix">
          <Muted>La grille sert à calculer les devis. Tu peux partir de la grille La Réunion 2026, puis ajuster tes prix ici ou dans Excel.</Muted>
          {canEdit ? (
            <>
              <Button label={busy ? 'Chargement…' : 'Charger la grille La Réunion 2026'} onPress={loadStarter} disabled={busy} />
              <FileButton label="📄 Importer mon fichier Excel" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onFile={async (f) => readFile(await f.arrayBuffer(), f.name)} />
            </>
          ) : (
            <Muted>Seuls le gérant et le bureau peuvent importer la grille.</Muted>
          )}
        </Card>
      ) : (
        <>
          <Card title={grid.name}>
            <Muted>
              Importée le {toDate(grid.imported_at).toLocaleDateString('fr-FR')}
              {grid.source_file ? ` depuis « ${grid.source_file} »` : ''}
            </Muted>
            {canEdit ? (
              <FileButton label="📄 Importer une nouvelle version (Excel)" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onFile={async (f) => readFile(await f.arrayBuffer(), f.name)} />
            ) : (
              <Muted>Lecture seule : seuls le gérant et le bureau modifient les prix.</Muted>
            )}
          </Card>
          <Params grid={grid} canEdit={canEdit} />
          <Items items={items} canEdit={canEdit} />
        </>
      )}
    </ScrollView>
  );
}

const PARAMS: { col: keyof GridRow; label: string; kind: 'eur' | 'pct'; hint?: string }[] = [
  { col: 'rate_climber_cents', label: 'Taux horaire grimpeur (HT)', kind: 'eur' },
  { col: 'rate_ground_cents', label: 'Taux horaire homme au sol (HT)', kind: 'eur' },
  { col: 'travel_flat_cents', label: 'Forfait déplacement (HT)', kind: 'eur' },
  { col: 'waste_per_m3_cents', label: 'Évacuation des déchets verts, par m³ (HT)', kind: 'eur' },
  { col: 'waste_cost_per_m3_cents', label: 'Ton coût de déchèterie, par m³', kind: 'eur', hint: 'Pour ta marge : jamais affiché au client.' },
  { col: 'surcharge_retention_bp', label: 'Majoration rétention (piscine, toit…)', kind: 'pct' },
  { col: 'surcharge_big_trunk_bp', label: 'Majoration tronc > 60 cm', kind: 'pct' },
  { col: 'surcharge_urgent_bp', label: 'Majoration urgence, week-end, férié', kind: 'pct' },
  { col: 'coef_bp', label: 'Coefficient Réunion (sur les prix conseillés)', kind: 'pct', hint: '100 % = prix des guides nationaux. S’applique au prochain import.' },
];

function Params({ grid, canEdit }: { grid: GridRow; canEdit: boolean }) {
  return (
    <Card title="Paramètres">
      {PARAMS.map((p) => (
        <ParamField key={p.col} grid={grid} param={p} canEdit={canEdit} />
      ))}
    </Card>
  );
}

const fmt = (v: number, kind: 'eur' | 'pct') => (kind === 'eur' ? String(v / 100) : String(v / 100)).replace('.', ',');
const parse = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.').replace(/[€%]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

function ParamField({ grid, param, canEdit }: { grid: GridRow; param: (typeof PARAMS)[number]; canEdit: boolean }) {
  const value = grid[param.col] as number;
  const [text, setText] = useState(fmt(value, param.kind));
  const [err, setErr] = useState(false);
  if (!canEdit) {
    return (
      <View style={styles.paramRow}>
        <Text style={styles.paramLabel}>{param.label}</Text>
        <Text style={styles.price}>{param.kind === 'eur' ? euros(value) : percent(value)}</Text>
      </View>
    );
  }
  return (
    <View>
      <Field
        label={`${param.label} (${param.kind === 'eur' ? '€' : '%'})`}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setErr(false);
        }}
        keyboardType="decimal-pad"
        onBlur={() => {
          const v = parse(text);
          if (v == null) return setErr(true);
          if (v !== value) void setGridParam(grid.id, param.col, v);
        }}
      />
      {err ? <Text style={styles.error}>Nombre invalide.</Text> : null}
      {param.hint ? <Muted>{param.hint}</Muted> : null}
    </View>
  );
}

function Items({ items, canEdit }: { items: PriceItemRow[]; canEdit: boolean }) {
  const groups = new Map<string, PriceItemRow[]>();
  for (const it of items) groups.set(it.category ?? 'Autres', [...(groups.get(it.category ?? 'Autres') ?? []), it]);
  return (
    <>
      {[...groups].map(([cat, list]) => (
        <Card key={cat} title={cat}>
          {list.map((it) => (
            <ItemRow key={it.id} item={it} canEdit={canEdit} />
          ))}
        </Card>
      ))}
    </>
  );
}

function ItemRow({ item, canEdit }: { item: PriceItemRow; canEdit: boolean }) {
  const [text, setText] = useState(item.my_price_cents != null ? String(item.my_price_cents / 100).replace('.', ',') : '');
  const [err, setErr] = useState(false);
  const save = () => {
    if (!text.trim()) return item.my_price_cents != null ? void setMyPrice(item.id, null) : undefined;
    const v = parse(text);
    if (v == null) return setErr(true);
    if (v !== item.my_price_cents) void setMyPrice(item.id, v);
  };
  return (
    <View style={styles.item}>
      <Text style={styles.itemLabel}>{item.label}</Text>
      <Muted>
        Conseillé : {euros(item.suggested_price_cents)} HT / {item.unit ?? 'unité'}
        {item.min_cents != null && item.max_cents != null ? ` (fourchette ${euros(item.min_cents)}–${euros(item.max_cents)} ${item.source_basis ?? ''})` : ''}
      </Muted>
      {canEdit ? (
        <Field
          label={`Mon prix HT – ${item.label}`}
          value={text}
          onChangeText={(t) => {
            setText(t);
            setErr(false);
          }}
          onBlur={save}
          keyboardType="decimal-pad"
          placeholder={`Vide = ${euros(item.suggested_price_cents)}`}
        />
      ) : null}
      {err ? <Text style={styles.error}>Nombre invalide.</Text> : null}
      <Text style={styles.retained}>Prix retenu : {euros(retainedPriceCents(item))} HT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  ok: { fontSize: 15, color: Colors.primary, fontWeight: '500' },
  warn: { fontSize: 15, color: Colors.warning },
  error: { fontSize: 15, color: Colors.danger },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, paddingVertical: 4 },
  paramLabel: { fontSize: 15, color: Colors.text, flex: 1 },
  price: { fontSize: 15, fontWeight: '600', color: Colors.text },
  item: { gap: 4, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  itemLabel: { fontSize: 16, fontWeight: '600', color: Colors.text },
  retained: { fontSize: 15, fontWeight: '600', color: Colors.primary },
});
