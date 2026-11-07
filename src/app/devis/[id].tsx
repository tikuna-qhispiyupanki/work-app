import { Icon, type IconName } from '@/components/icon';
import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { confirmAction } from '@/components/confirm';
import { NumberField } from '@/components/number-field';
import { QuoteCrew } from '@/components/quote-crew';
import { QuoteSign } from '@/components/quote-sign';
import { Button, Card, Field, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import {
  addQuoteLine, COMPANY_SQL, copyQuote, CompanyRow, deleteDraftQuote, finalizeQuote, missingCompanyFields, QUOTE_LINES_SQL, QUOTE_SQL,
  QuoteLineRow, QuoteRow, removeQuoteLine, setQuoteNotes, setQuoteZone, updateQuoteLine,
} from '@/db/quotes';
import { toDate } from '@/domain/dates';
import { euros, percent } from '@/domain/pricing';
import { FRANCHISE_MENTION, quoteTotalsFromLines } from '@/domain/quote-build';
import { quotePdf } from '@/pdf/quote-pdf-data';
import { shareFile } from '@/pdf/share';

const STATUS: Record<string, string> = { brouillon: 'Brouillon', finalise: 'Finalisé', signe: 'Signé', refuse: 'Refusé' };

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company: active } = useAuth();
  const { data, isLoading } = useQuery<QuoteRow>(QUOTE_SQL, [id]);
  const { data: lines } = useQuery<QuoteLineRow>(QUOTE_LINES_SQL, [id]);
  const { data: companies } = useQuery<CompanyRow>(COMPANY_SQL, [active?.id ?? '']);
  const { data: clients } = useQuery<{ name: string | null; kind: string | null }>('SELECT name, kind FROM clients WHERE id = ?', [data[0]?.client_id ?? '']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openLine, setOpenLine] = useState<string | null>(null); // une seule ligne ouverte à la fois
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
  const offeredCents = quoteTotalsFromLines(lines, q.vat_rate_bp).offeredCents;

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
              <Pressable key={z} onPress={() => run(() => setQuoteZone(q.id, z))} style={[styles.choice, q.vat_zone === z && styles.choiceOn]} accessibilityRole="radio" aria-checked={q.vat_zone === z}>
                <Text style={[styles.choiceText, q.vat_zone === z && { color: Colors.primaryText }]}>{z === 'reunion' ? 'Réunion 8,5 %' : 'Hexagone 20 %'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      <Card title={`Détail (${lines.length} ligne${lines.length > 1 ? 's' : ''})`}>
        {lines.map((l) => (
          <LineEditor key={l.id} quoteId={q.id} line={l} editable={draft} open={openLine === l.id} onToggle={() => setOpenLine(openLine === l.id ? null : l.id)} onError={setError} />
        ))}
        {draft ? (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Ligne libre" icon="add-outline" onPress={() => run(async () => setOpenLine(await addQuoteLine(q.id, 'libre')))} />
            </View>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Location matériel" icon="add-outline" onPress={() => run(async () => setOpenLine(await addQuoteLine(q.id, 'location')))} />
            </View>
          </View>
        ) : null}
      </Card>

      <Card title="Totaux">
        <Row label="Total HT" value={euros(q.subtotal_ht_cents)} />
        {q.vat_regime === 'franchise' ? <Muted>{FRANCHISE_MENTION}</Muted> : <Row label={`TVA ${percent(q.vat_rate_bp)}`} value={euros(q.vat_cents)} />}
        <Row label={q.vat_regime === 'franchise' ? 'Net à payer' : 'Total TTC'} value={euros(q.total_ttc_cents)} strong />
        {offeredCents ? <Text style={styles.gift}>Geste commercial : {euros(offeredCents)} HT offerts</Text> : null}
        {q.deposit_bp ? <Muted>Acompte à la signature : {percent(q.deposit_bp)} soit {euros(Math.round((q.total_ttc_cents * q.deposit_bp) / 10000))}</Muted> : null}
      </Card>

      {active?.role !== 'technicien' ? <QuoteCrew quoteId={q.id} subtotalCents={q.subtotal_ht_cents} lines={lines} /> : null}

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
          {missing.length ? <SecondaryButton label="Compléter la fiche entreprise" icon="business-outline" onPress={() => router.push('/fiche-entreprise')} /> : null}
          <Button label={busy ? 'Finalisation…' : 'Finaliser le devis'} onPress={finalize} disabled={busy || missing.length > 0} icon="checkmark-outline" />
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
        <>
          <QuoteSign quote={q} clientName={clientName} />
          {q.status === 'signe' ? <Button label="Voir le chantier" icon="construct-outline" onPress={() => router.push({ pathname: '/chantiers/[id]', params: { id: q.id } })} /> : null}
          <SecondaryButton
            label={q.status === 'refuse' ? 'Refaire un devis à partir de celui-ci' : 'Nouveau devis à partir de celui-ci'}
            icon="copy-outline"
            onPress={async () => {
              const ok = await confirmAction(
                'Créer un nouveau devis ?',
                `Un brouillon est créé avec les mêmes lignes, prix et remarques que le devis ${q.number ?? ''}. Tu pourras tout modifier avant de le finaliser. Ce devis-ci ne change pas.`,
                'Créer le brouillon'
              );
              if (!ok) return;
              await run(async () => {
                const id = await copyQuote(q.id);
                router.replace({ pathname: '/devis/[id]', params: { id } });
              });
            }}
          />
        </>
      )}
      <SecondaryButton
        label={busy ? 'Préparation du PDF…' : `PDF du devis${draft ? ' (brouillon)' : ''}`} icon="document-text-outline"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          await run(async () => {
            const pdf = await quotePdf(q.id);
            await shareFile(pdf.data, pdf.fileName);
          });
          setBusy(false);
        }}
      />
    </ScrollView>
  );
}

type LineProps = { quoteId: string; line: QuoteLineRow; editable: boolean; open: boolean; onToggle: () => void; onError: (e: string | null) => void };

// Ligne du devis : résumé compact (libellé, quantité × prix, total) ; un appui l'ouvre pour la modifier.
function LineEditor({ quoteId, line, editable, open, onToggle, onError }: LineProps) {
  const [label, setLabel] = useState(line.label);
  const change = (c: Parameters<typeof updateQuoteLine>[2]) => updateQuoteLine(quoteId, line.id, c).catch((e) => onError(String(e)));
  const summary = (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.lineLabel} numberOfLines={open ? undefined : 2}>
        {line.label}
      </Text>
      <Muted>
        {String(line.quantity).replace('.', ',')} {line.unit ?? ''} × {euros(line.unit_price_ht_cents)}
        {line.surcharge_bp ? ` + ${percent(line.surcharge_bp)}` : ''}
      </Muted>
    </View>
  );
  const total = (
    <Text style={[styles.lineTotal, !!line.offered && styles.offered]}>
      {line.offered ? `Offert (valeur ${euros(line.total_ht_cents)} HT)` : `${euros(line.total_ht_cents)} HT`}
    </Text>
  );
  if (!editable) {
    return (
      <View style={styles.line}>
        {summary}
        {total}
      </View>
    );
  }
  if (!open) {
    return (
      <Pressable onPress={onToggle} style={[styles.line, styles.lineRow]} accessibilityRole="button" accessibilityLabel={`Modifier la ligne ${line.label}`}>
        {summary}
        <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: '45%' }}>
          {total}
          <Icon name="create-outline" size={18} color={Colors.primary} />
        </View>
      </Pressable>
    );
  }
  return (
    <View style={[styles.line, styles.lineOpen]}>
      <Pressable onPress={onToggle} style={styles.lineRow} accessibilityRole="button" accessibilityLabel="Fermer la ligne">
        <Text style={[styles.lineLabel, { flex: 1 }]}>Modifier la ligne</Text>
        <Icon name="chevron-up" size={20} color={Colors.primary} />
      </Pressable>
      <Field label="Libellé" value={label} onChangeText={setLabel} onBlur={() => label !== line.label && change({ label })} multiline />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <NumberField label="Quantité" unit={line.unit ?? undefined} value={line.quantity} onCommit={(v) => v != null && change({ quantity: v })} allowEmpty={false} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Prix unitaire HT" unit="€" value={line.unit_price_ht_cents / 100} onCommit={(v) => v != null && change({ unit_price_ht_cents: Math.round(v * 100) })} allowEmpty={false} />
        </View>
      </View>
      <View style={styles.chips}>
        {line.kind === 'prestation' ? (
          <>
            <Chip label="Rétention" on={!!line.retention} onPress={() => change({ retention: line.retention ? 0 : 1 })} />
            <Chip label="Tronc > 60 cm" on={!!line.big_trunk} onPress={() => change({ big_trunk: line.big_trunk ? 0 : 1 })} />
            <Chip label="Urgence" on={!!line.urgent} onPress={() => change({ urgent: line.urgent ? 0 : 1 })} />
          </>
        ) : null}
        <Chip label="Offrir" icon="gift-outline" on={!!line.offered} onPress={() => change({ offered: line.offered ? 0 : 1 })} />
      </View>
      <View style={styles.lineFoot}>
        <Text style={[styles.lineTotal, !!line.offered && styles.offered]}>
          {line.offered ? `Offert (valeur ${euros(line.total_ht_cents)} HT)` : `${euros(line.total_ht_cents)} HT`}
          {line.surcharge_bp ? ` (majorations +${percent(line.surcharge_bp)})` : ''}
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

function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn, icon && { flexDirection: 'row', alignItems: 'center', gap: 4 }]} accessibilityRole="switch" aria-checked={on} accessibilityLabel={label}>
      {icon ? <Icon name={icon} size={15} color={on ? Colors.primaryText : Colors.primary} /> : null}
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
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  lineOpen: { borderLeftWidth: 3, borderLeftColor: Colors.primary, paddingLeft: Spacing.sm },
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
  gift: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  offered: { color: Colors.primary },
});
