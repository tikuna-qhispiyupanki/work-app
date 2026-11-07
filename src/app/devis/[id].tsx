import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { confirmAction } from '@/components/confirm';
import { NumberField } from '@/components/number-field';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import {
  addQuoteLine, COMPANY_SQL, CompanyRow, deleteDraftQuote, finalizeQuote, missingCompanyFields, QUOTE_LINES_SQL, QUOTE_SQL,
  QuoteLineRow, QuoteRow, removeQuoteLine, setQuoteNotes, setQuoteZone, updateQuoteLine,
} from '@/db/quotes';
import { toDate } from '@/domain/dates';
import { euros, percent } from '@/domain/pricing';
import { FRANCHISE_MENTION } from '@/domain/quote-build';

const STATUS: Record<string, string> = { brouillon: 'Brouillon', finalise: 'Finalisé', signe: '✓ Signé', refuse: 'Refusé' };

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company: active } = useAuth();
  const { data, isLoading } = useQuery<QuoteRow>(QUOTE_SQL, [id]);
  const { data: lines } = useQuery<QuoteLineRow>(QUOTE_LINES_SQL, [id]);
  const { data: companies } = useQuery<CompanyRow>(COMPANY_SQL, [active?.id ?? '']);
  const { data: clients } = useQuery<{ name: string | null; kind: string | null }>('SELECT name, kind FROM clients WHERE id = ?', [data[0]?.client_id ?? '']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const q = data[0];
  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!q) return <Muted>Devis introuvable.</Muted>;
  const draft = q.status === 'brouillon';
  const company = companies[0] ?? null;
  const missing = missingCompanyFields(company);
  const snap = q.company_snapshot ? (JSON.parse(q.company_snapshot) as Partial<CompanyRow>) : null;
  const siret = snap ? snap.siret : company?.siret;
  const clientName = q.client_snapshot ? (JSON.parse(q.client_snapshot) as { name?: string }).name : clients[0]?.name;
  const run = async (f: () => Promise<unknown>) => {
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const day = (s: string | null) => (s ? toDate(s).toLocaleDateString('fr-FR') : '');

  const finalize = async () => {
    const ok = await confirmAction(
      'Finaliser le devis ?',
      'Il reçoit son numéro et ne pourra plus être modifié (pour changer quelque chose ensuite, il faudra refaire un devis).',
      'Finaliser'
    );
    if (!ok) return;
    setBusy(true);
    await run(() => finalizeQuote(q.id));
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title={q.number ? `Devis ${q.number}` : 'Devis (brouillon)'}>
        <View style={[styles.badge, !draft && styles.badgeOn]}>
          <Text style={[styles.badgeText, !draft && { color: Colors.primaryText }]}>{STATUS[q.status]}</Text>
        </View>
        <Text style={styles.big}>{clientName || 'Client'}</Text>
        {q.site_address ? <Muted>Chantier : {q.site_address}</Muted> : null}
        {q.issued_on ? (
          <Muted>
            Émis le {day(q.issued_on)} · valable jusqu&apos;au {day(q.valid_until)}
          </Muted>
        ) : (
          <Muted>Le numéro et la date seront attribués à la finalisation (même sans réseau).</Muted>
        )}
        {draft && q.vat_regime === 'assujetti' ? (
          <View style={styles.row}>
            {(['reunion', 'hexagone'] as const).map((z) => (
              <Pressable key={z} onPress={() => run(() => setQuoteZone(q.id, z))} style={[styles.choice, q.vat_zone === z && styles.choiceOn]} accessibilityRole="radio" accessibilityState={{ checked: q.vat_zone === z }}>
                <Text style={[styles.choiceText, q.vat_zone === z && { color: Colors.primaryText }]}>{z === 'reunion' ? 'Réunion 8,5 %' : 'Hexagone 20 %'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      <Card title={`Détail (${lines.length} ligne${lines.length > 1 ? 's' : ''})`}>
        {lines.map((l) => (
          <LineEditor key={l.id} quoteId={q.id} line={l} editable={draft} onError={setError} />
        ))}
        {draft ? (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="+ Ligne libre" onPress={() => run(() => addQuoteLine(q.id, 'libre'))} />
            </View>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="+ Location matériel" onPress={() => run(() => addQuoteLine(q.id, 'location'))} />
            </View>
          </View>
        ) : null}
      </Card>

      <Card title="Totaux">
        <Row label="Total HT" value={euros(q.subtotal_ht_cents)} />
        {q.vat_regime === 'franchise' ? <Muted>{FRANCHISE_MENTION}</Muted> : <Row label={`TVA ${percent(q.vat_rate_bp)}`} value={euros(q.vat_cents)} />}
        <Row label={q.vat_regime === 'franchise' ? 'Net à payer' : 'Total TTC'} value={euros(q.total_ttc_cents)} strong />
        {q.deposit_bp ? <Muted>Acompte à la signature : {percent(q.deposit_bp)} soit {euros(Math.round((q.total_ttc_cents * q.deposit_bp) / 10000))}</Muted> : null}
      </Card>

      <Card title="Conditions">
        <Muted>Devis gratuit · {q.payment_terms}</Muted>
        {draft ? <NotesField quoteId={q.id} value={q.notes ?? ''} /> : q.notes ? <Text style={styles.text}>{q.notes}</Text> : null}
        {!siret ? <Text style={styles.warn}>⚠ SIRET de l&apos;entreprise non renseigné (fiche entreprise).</Text> : null}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {draft ? (
        <>
          {missing.length ? (
            <Text style={styles.warn}>
              Pour finaliser, complète la fiche entreprise ({missing.join(', ')}).
            </Text>
          ) : null}
          {missing.length ? <SecondaryButton label="🏢 Compléter la fiche entreprise" onPress={() => router.push('/fiche-entreprise')} /> : null}
          <Button label={busy ? 'Finalisation…' : '✓ Finaliser le devis'} onPress={finalize} disabled={busy || missing.length > 0} />
          <SecondaryButton
            label="Supprimer ce brouillon"
            danger
            onPress={async () => {
              if (await confirmAction('Supprimer ce brouillon ?', 'Le devis brouillon sera retiré.', 'Supprimer')) {
                await run(() => deleteDraftQuote(q.id));
                router.back();
              }
            }}
          />
        </>
      ) : (
        <Muted>Signature du client et PDF : prochaine étape (4c).</Muted>
      )}
    </ScrollView>
  );
}

function LineEditor({ quoteId, line, editable, onError }: { quoteId: string; line: QuoteLineRow; editable: boolean; onError: (e: string | null) => void }) {
  const [label, setLabel] = useState(line.label);
  const change = (c: Parameters<typeof updateQuoteLine>[2]) => updateQuoteLine(quoteId, line.id, c).catch((e) => onError(String(e)));
  if (!editable) {
    return (
      <View style={styles.line}>
        <Text style={styles.lineLabel}>{line.label}</Text>
        <Muted>
          {String(line.quantity).replace('.', ',')} {line.unit ?? ''} × {euros(line.unit_price_ht_cents)}
          {line.surcharge_bp ? ` + ${percent(line.surcharge_bp)}` : ''}
        </Muted>
        <Text style={styles.lineTotal}>{euros(line.total_ht_cents)} HT</Text>
      </View>
    );
  }
  return (
    <View style={styles.line}>
      <Field label="Libellé" value={label} onChangeText={setLabel} onBlur={() => label !== line.label && change({ label })} multiline />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <NumberField label="Quantité" unit={line.unit ?? undefined} value={line.quantity} onCommit={(v) => v != null && change({ quantity: v })} allowEmpty={false} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Prix unitaire HT" unit="€" value={line.unit_price_ht_cents / 100} onCommit={(v) => v != null && change({ unit_price_ht_cents: Math.round(v * 100) })} allowEmpty={false} />
        </View>
      </View>
      {line.kind === 'prestation' ? (
        <View style={styles.chips}>
          <Chip label="Rétention" on={!!line.retention} onPress={() => change({ retention: line.retention ? 0 : 1 })} />
          <Chip label="Tronc > 60 cm" on={!!line.big_trunk} onPress={() => change({ big_trunk: line.big_trunk ? 0 : 1 })} />
          <Chip label="Urgence" on={!!line.urgent} onPress={() => change({ urgent: line.urgent ? 0 : 1 })} />
        </View>
      ) : null}
      <View style={styles.lineFoot}>
        <Text style={styles.lineTotal}>
          {euros(line.total_ht_cents)} HT{line.surcharge_bp ? ` (majorations +${percent(line.surcharge_bp)})` : ''}
        </Text>
        <Pressable onPress={() => removeQuoteLine(quoteId, line.id).catch((e) => onError(String(e)))} accessibilityRole="button" accessibilityLabel={`Retirer la ligne ${line.label}`}>
          <Text style={styles.remove}>Retirer</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NotesField({ quoteId, value }: { quoteId: string; value: string }) {
  const [t, setT] = useState(value);
  return <Field label="Remarques sur le devis (affichées au client)" value={t} onChangeText={setT} onBlur={() => t !== value && void setQuoteNotes(quoteId, t)} multiline />;
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      <Text style={[styles.chipText, on && { color: Colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.text, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.text, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  big: { fontSize: 18, fontWeight: '600', color: Colors.text },
  text: { fontSize: 16, color: Colors.text },
  strong: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  warn: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
  error: { fontSize: 15, color: Colors.danger },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#F6E7D6' },
  badgeOn: { backgroundColor: Colors.primary },
  badgeText: { fontSize: 13, fontWeight: '700', color: Colors.warning },
  choice: { flex: 1, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center', backgroundColor: Colors.card },
  choiceOn: { backgroundColor: Colors.primary },
  choiceText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  line: { gap: 6, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  lineLabel: { fontSize: 16, fontWeight: '500', color: Colors.text },
  lineFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineTotal: { fontSize: 16, fontWeight: '700', color: Colors.text },
  remove: { color: Colors.danger, fontSize: 15, fontWeight: '600', padding: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.card },
  chipOn: { backgroundColor: Colors.primary },
  chipText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
