import { useQuery } from '@powersync/react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { Icon } from '@/components/icon';
import { NumberField } from '@/components/number-field';
import { Card, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { ACTIVE_GRID_SQL, GridRow } from '@/db/prices';
import type { QuoteLineRow } from '@/db/quotes';
import { addToCrew, CrewRow, QUOTE_CREW_SQL, removeFromCrew, setCrewHours, TEAM_SQL, TeamMemberRow, TRADE_LABEL } from '@/db/team';
import { quoteMargin } from '@/domain/margin';
import { euros } from '@/domain/pricing';
import { router } from 'expo-router';

// Équipe prévue sur le devis et marge estimée. INTERNE : jamais dans le PDF ni sur la page du client.
export function QuoteCrew({ quoteId, subtotalCents, lines }: { quoteId: string; subtotalCents: number; lines: QuoteLineRow[] }) {
  const { company } = useAuth();
  const seesCosts = company?.role === 'gerant' || company?.role === 'bureau';
  const { data: crew } = useQuery<CrewRow>(QUOTE_CREW_SQL, [quoteId]);
  const { data: team } = useQuery<TeamMemberRow>(TEAM_SQL, [company?.id ?? '']);
  const { data: grids } = useQuery<GridRow>(ACTIVE_GRID_SQL);
  const available = team.filter((m) => m.active && !crew.some((c) => c.member_id === m.id));
  const wasteM3 = lines.filter((l) => l.kind === 'evacuation' && !l.offered).reduce((s, l) => s + l.quantity, 0);
  const m = quoteMargin({
    revenueCents: subtotalCents,
    crew: crew.map((c) => ({ hours: c.hours, hourlyCostCents: c.hourly_cost_cents })),
    wasteM3,
    wasteCostPerM3Cents: grids[0]?.waste_cost_per_m3_cents ?? 0,
  });

  return (
    <Card title="Équipe prévue et marge (interne)">
      <Muted>Visible seulement dans l&apos;application : rien de cette carte n&apos;apparaît sur le devis du client.</Muted>
      {crew.map((c) => (
        <View key={c.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            <Muted>
              {TRADE_LABEL[c.trade] ?? c.trade}
              {seesCosts ? ` · ${c.hourly_cost_cents != null ? `${euros(c.hourly_cost_cents)}/h` : 'coût horaire à renseigner'}` : ''}
            </Muted>
          </View>
          <View style={{ width: 110 }}>
            <NumberField label={`Heures de ${c.name}`} unit="h" value={c.hours} onCommit={(v) => v != null && void setCrewHours(c.id, v)} allowEmpty={false} />
          </View>
          <Pressable onPress={() => void removeFromCrew(c.id)} accessibilityRole="button" accessibilityLabel={`Retirer ${c.name} du devis`} style={{ padding: 6 }}>
            <Icon name="close-circle-outline" size={24} color={Colors.danger} />
          </Pressable>
        </View>
      ))}
      {available.length ? (
        <View style={styles.chips}>
          {available.map((t) => (
            <Pressable key={t.id} style={styles.chip} onPress={() => void addToCrew(quoteId, t.id, 7)} accessibilityRole="button" accessibilityLabel={`Ajouter ${t.name}`}>
              <Icon name="add" size={16} color={Colors.primary} />
              <Text style={styles.chipText}>{t.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {team.length === 0 ? (
        <Pressable onPress={() => router.push('/equipe')} accessibilityRole="link">
          <Text style={styles.link}>Renseigne d&apos;abord ton équipe (onglet Plus → Mon équipe).</Text>
        </Pressable>
      ) : null}
      {seesCosts && crew.length ? (
        <View style={styles.margin}>
          <Line label="Prix HT facturé" value={euros(m.revenueCents)} />
          <Line label={`Équipe (${String(m.crewHours).replace('.', ',')} h)`} value={`− ${euros(m.crewCostCents)}`} />
          {m.wasteCostCents ? <Line label={`Dépôt déchèterie (${String(wasteM3).replace('.', ',')} m³)`} value={`− ${euros(m.wasteCostCents)}`} /> : null}
          <Line label="Marge estimée" value={`${euros(m.marginCents)}${m.marginBp != null ? ` (${(m.marginBp / 100).toFixed(0)} %)` : ''}`} strong warn={m.marginCents < 0} />
          {m.missingCosts ? <Text style={styles.warn}>{m.missingCosts} personne(s) sans coût horaire : marge incomplète.</Text> : null}
          <Muted>Hors matériel, carburant et frais généraux.</Muted>
        </View>
      ) : null}
    </Card>
  );
}

function Line({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.text, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.text, strong && styles.strong, warn && { color: Colors.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  name: { fontSize: 16, fontWeight: '500', color: Colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  link: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  margin: { backgroundColor: '#EEF2F0', borderRadius: 8, padding: Spacing.sm, gap: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  text: { fontSize: 15, color: Colors.text },
  strong: { fontWeight: '700', fontSize: 16 },
  warn: { fontSize: 14, color: Colors.warning },
});
