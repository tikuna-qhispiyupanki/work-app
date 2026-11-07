import { useQuery } from '@powersync/react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { confirmAction } from '@/components/confirm';
import { Icon } from '@/components/icon';
import { NumberField } from '@/components/number-field';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { DateField } from '@/components/date-field';
import { Colors, Spacing } from '@/constants/theme';
import { AIPR_LABEL, aiprState, aiprText } from '@/domain/networks';
import { addTeamMember, removeTeamMember, setHourlyCost, TEAM_SQL, TeamMemberRow, Trade, TRADE_LABEL, updateTeamMember } from '@/db/team';
import { euros } from '@/domain/pricing';

const TRADES: Trade[] = ['grimpeur', 'sol', 'polyvalent', 'autre'];

// « Mon équipe » : les personnes de l'entreprise et leur coût horaire (interne, pour la marge des devis).
export default function TeamScreen() {
  const { company } = useAuth();
  const canEdit = company?.role === 'gerant' || company?.role === 'bureau';
  const { data: team } = useQuery<TeamMemberRow>(TEAM_SQL, [company?.id ?? '']);
  const [name, setName] = useState('');
  const [trade, setTrade] = useState<Trade>('grimpeur');
  const [cost, setCost] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    if (!name.trim()) return setError('Indique le nom.');
    try {
      await addTeamMember(name, trade, cost == null ? null : Math.round(cost * 100));
      setName('');
      setCost(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Muted>
        Le coût horaire (salaire chargé, ou ce que te coûte un sous-traitant) sert seulement à calculer ta marge sur les devis. Il n&apos;est jamais montré au
        client, ni à tes équipiers : seuls le gérant et le bureau le voient.
      </Muted>

      {canEdit ? (
        <Card title="Ajouter une personne">
          <Field label="Nom" value={name} onChangeText={setName} autoCapitalize="words" />
          <TradeChips value={trade} onChange={setTrade} />
          <NumberField label="Coût horaire" unit="€/h" value={cost} onCommit={setCost} placeholder="ex. 25" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Ajouter à l'équipe" icon="person-add-outline" onPress={add} />
        </Card>
      ) : null}

      <Card title={`Équipe (${team.length})`}>
        {team.length === 0 ? <Muted>Personne pour l&apos;instant. Ajoute-toi, puis tes grimpeurs et hommes au sol.</Muted> : null}
        {team.map((m) =>
          open === m.id && canEdit ? (
            <MemberEditor key={m.id} m={m} onClose={() => setOpen(null)} />
          ) : (
            <Pressable
              key={m.id}
              style={styles.row}
              onPress={() => canEdit && setOpen(m.id)}
              accessibilityRole={canEdit ? 'button' : undefined}
              accessibilityLabel={canEdit ? `Modifier ${m.name}` : m.name}
            >
              <Icon name={m.trade === 'sol' ? 'walk-outline' : 'git-pull-request-outline'} size={22} color={m.active ? Colors.primary : Colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, !m.active && { color: Colors.textSecondary }]}>{m.name}</Text>
                <Muted>
                  {TRADE_LABEL[m.trade] ?? m.trade}
                  {!m.active ? ' · inactif' : ''}
                </Muted>
                <Text style={[styles.aipr, ['absente', 'expiree'].includes(aiprState(m)) && { color: Colors.warning }]}>{aiprText(m)}</Text>
              </View>
              {canEdit ? <Text style={styles.cost}>{m.hourly_cost_cents != null ? `${euros(m.hourly_cost_cents)}/h` : 'coût ?'}</Text> : null}
            </Pressable>
          )
        )}
      </Card>
    </ScrollView>
  );
}

function TradeChips({ value, onChange }: { value: Trade; onChange: (t: Trade) => void }) {
  return (
    <View style={styles.chips}>
      {TRADES.map((t) => (
        <Pressable key={t} onPress={() => onChange(t)} style={[styles.chip, value === t && styles.chipOn]} accessibilityRole="radio" aria-checked={value === t}>
          <Text style={[styles.chipText, value === t && { color: Colors.primaryText }]}>{TRADE_LABEL[t]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MemberEditor({ m, onClose }: { m: TeamMemberRow; onClose: () => void }) {
  const [name, setName] = useState(m.name);
  return (
    <View style={[styles.row, styles.editor]}>
      <View style={{ flex: 1, gap: Spacing.sm }}>
        <Field label="Nom" value={name} onChangeText={setName} onBlur={() => name.trim() && name !== m.name && void updateTeamMember(m.id, { name: name.trim() })} />
        <TradeChips value={m.trade} onChange={(t) => void updateTeamMember(m.id, { trade: t })} />
        <NumberField
          label="Coût horaire"
          unit="€/h"
          value={m.hourly_cost_cents == null ? null : m.hourly_cost_cents / 100}
          onCommit={(v) => v != null && void setHourlyCost(m.id, Math.round(v * 100))}
        />
        <Text style={styles.chipText}>AIPR (autorisation d&apos;intervention à proximité des réseaux)</Text>
        <View style={styles.chips}>
          {(['operateur', 'encadrant', 'concepteur'] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => void updateTeamMember(m.id, { aipr_profile: m.aipr_profile === p ? null : p })}
              style={[styles.chip, m.aipr_profile === p && styles.chipOn]}
              accessibilityRole="radio"
              aria-checked={m.aipr_profile === p}
              accessibilityLabel={`AIPR ${AIPR_LABEL[p]}`}
            >
              <Text style={[styles.chipText, m.aipr_profile === p && { color: Colors.primaryText }]}>{AIPR_LABEL[p]}</Text>
            </Pressable>
          ))}
        </View>
        <DateField label="AIPR valable jusqu'au" value={m.aipr_valid_until} onChange={(d) => void updateTeamMember(m.id, { aipr_valid_until: d })} />
        <Muted>Attestation de compétence obtenue après un QCM dans un centre agréé, valable 5 ans ; l&apos;employeur délivre ensuite l&apos;AIPR.</Muted>
        <SecondaryButton
          label={m.active ? 'Marquer inactif (ne travaille plus avec moi)' : 'Remettre actif'}
          icon={m.active ? 'pause-circle-outline' : 'play-circle-outline'}
          onPress={() => void updateTeamMember(m.id, { active: m.active ? 0 : 1 })}
        />
        <SecondaryButton
          label="Retirer de l'équipe"
          danger
          onPress={async () => {
            if (await confirmAction(`Retirer ${m.name} ?`, 'Les anciens devis gardent son nom et ses heures.', 'Retirer')) {
              await removeTeamMember(m.id);
              onClose();
            }
          }}
        />
        <Button label="Terminé" icon="checkmark-outline" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  editor: { borderLeftWidth: 3, borderLeftColor: Colors.primary, paddingLeft: Spacing.sm },
  name: { fontSize: 16, fontWeight: '500', color: Colors.text },
  cost: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.card },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 15, color: Colors.text },
  error: { color: Colors.danger, fontSize: 15 },
  aipr: { fontSize: 13, color: Colors.textSecondary },
});
