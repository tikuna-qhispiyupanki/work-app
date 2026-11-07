import { useQuery } from '@powersync/react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/session';
import { FileButton } from '@/components/file-button';
import { LocalImage } from '@/components/local-image';
import { NumberField } from '@/components/number-field';
import { Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { COMPANY_SQL, CompanyFields, CompanyRow, missingCompanyFields, setCompanyLogo, updateCompany } from '@/db/quotes';
import { kickUploader } from '@/sync/uploader';
import { FRANCHISE_MENTION } from '@/domain/quote-build';

// Fiche entreprise : identité de l'émetteur des devis. Modifiable par le gérant.
export default function CompanySheetScreen() {
  const { company: active } = useAuth();
  const { data, isLoading } = useQuery<CompanyRow>(COMPANY_SQL, [active?.id ?? '']);
  const c = data[0];
  const logo = useLogo(c?.logo_photo_id ?? null); // avant tout « return » : règle des hooks React
  const canEdit = active?.role === 'gerant';
  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!c) return <Muted>Entreprise introuvable.</Muted>;
  const save = (f: CompanyFields) => void updateCompany(f);
  const missing = missingCompanyFields(c);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {missing.length ? (
        <Text style={styles.warn}>À compléter pour pouvoir finaliser un devis : {missing.join(', ')}.</Text>
      ) : (
        <Text style={styles.ok}>✓ Fiche suffisante pour émettre des devis.</Text>
      )}
      {!canEdit ? <Muted>Lecture seule : seul le gérant modifie la fiche entreprise.</Muted> : null}
      <Card title="Logo (en haut des devis)">
        {c.logo_photo_id && logo ? (
          <View style={{ width: 180 }}>
            <LocalImage fileId={c.logo_photo_id} alt="Logo de l'entreprise" aspectRatio={logo.width / logo.height} companyId={c.id} uploaded={!!logo.storage_path} />
          </View>
        ) : (
          <Muted>Aucun logo. Sans logo, le nom de l&apos;entreprise sert de titre.</Muted>
        )}
        {canEdit ? (
          <FileButton
            label={c.logo_photo_id ? 'Changer le logo' : 'Choisir le logo'} icon="image-outline"
            accept="image/*"
            onFile={async (f) => {
              await setCompanyLogo(f);
              kickUploader();
            }}
          />
        ) : null}
      </Card>
      <Card title="Identité (affichée sur les devis)">
        <TextF label="Nom de l'entreprise *" value={c.name} onCommit={(v) => save({ name: v })} disabled={!canEdit} />
        <TextF label="Forme juridique (ex. EI, micro-entreprise, SARL)" value={c.legal_form} onCommit={(v) => save({ legal_form: v })} disabled={!canEdit} />
        <TextF label="SIRET" value={c.siret} onCommit={(v) => save({ siret: v.replace(/\s/g, '') })} disabled={!canEdit} keyboard="number-pad" />
        {!c.siret ? <Muted>Le SIRET est obligatoire sur un devis professionnel : à remplir dès que possible.</Muted> : null}
        <TextF label="Adresse *" value={c.address} onCommit={(v) => save({ address: v })} disabled={!canEdit} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextF label="Code postal *" value={c.postal_code} onCommit={(v) => save({ postal_code: v })} disabled={!canEdit} keyboard="number-pad" />
          </View>
          <View style={{ flex: 2 }}>
            <TextF label="Commune *" value={c.city} onCommit={(v) => save({ city: v })} disabled={!canEdit} />
          </View>
        </View>
        <TextF label="Téléphone *" value={c.phone} onCommit={(v) => save({ phone: v })} disabled={!canEdit} keyboard="phone-pad" />
        <TextF label="E-mail" value={c.email} onCommit={(v) => save({ email: v })} disabled={!canEdit} keyboard="email-address" />
      </Card>
      <Card title="Assurance responsabilité civile professionnelle">
        <TextF label="Assureur" value={c.insurance_name} onCommit={(v) => save({ insurance_name: v })} disabled={!canEdit} />
        <TextF label="N° de contrat" value={c.insurance_policy} onCommit={(v) => save({ insurance_policy: v })} disabled={!canEdit} />
        <TextF label="Zone couverte (ex. La Réunion)" value={c.insurance_area} onCommit={(v) => save({ insurance_area: v })} disabled={!canEdit} />
      </Card>
      <Card title="TVA">
        <View style={styles.row}>
          {(['franchise', 'assujetti'] as const).map((r) => (
            <Choice key={r} label={r === 'franchise' ? 'Franchise (pas de TVA)' : 'Assujetti à la TVA'} on={(c.vat_regime ?? 'franchise') === r} onPress={() => canEdit && save({ vat_regime: r })} />
          ))}
        </View>
        {(c.vat_regime ?? 'franchise') === 'franchise' ? (
          <Muted>Mention sur les devis : « {FRANCHISE_MENTION} ».</Muted>
        ) : (
          <>
            <Muted>Taux selon le chantier : La Réunion 8,5 %, hexagone 20 %. Zone par défaut :</Muted>
            <View style={styles.row}>
              {(['reunion', 'hexagone'] as const).map((z) => (
                <Choice key={z} label={z === 'reunion' ? 'La Réunion' : 'Hexagone'} on={(c.default_vat_zone ?? 'reunion') === z} onPress={() => canEdit && save({ default_vat_zone: z })} />
              ))}
            </View>
          </>
        )}
        <Muted>Faire confirmer le régime de TVA par ton comptable.</Muted>
      </Card>
      <Card title="Conditions des devis">
        <NumberField label="Durée de validité" unit="jours" value={c.quote_validity_days ?? 30} onCommit={(v) => canEdit && v != null && v >= 1 && save({ quote_validity_days: Math.round(v) })} allowEmpty={false} />
        <TextF label="Conditions de paiement" value={c.quote_payment_terms} onCommit={(v) => save({ quote_payment_terms: v })} disabled={!canEdit} multiline />
        <NumberField label="Acompte demandé à la signature" unit="%" value={(c.quote_deposit_bp ?? 0) / 100} onCommit={(v) => canEdit && save({ quote_deposit_bp: Math.round((v ?? 0) * 100) })} />
      </Card>
    </ScrollView>
  );
}

function useLogo(id: string | null) {
  const { data } = useQuery<{ width: number; height: number; storage_path: string | null }>('SELECT width, height, storage_path FROM photos WHERE id = ?', [id ?? '']);
  return data[0];
}

function TextF({ label, value, onCommit, disabled, keyboard, multiline }: { label: string; value: string | null; onCommit: (v: string) => void; disabled?: boolean; keyboard?: 'number-pad' | 'phone-pad' | 'email-address'; multiline?: boolean }) {
  const [t, setT] = useState(value ?? '');
  return (
    <Field
      label={label}
      value={t}
      onChangeText={setT}
      onBlur={() => t !== (value ?? '') && onCommit(t)}
      editable={!disabled}
      keyboardType={keyboard}
      autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
      multiline={multiline}
    />
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, on && styles.choiceOn]} accessibilityRole="radio" aria-checked={on}>
      <Text style={[styles.choiceText, on && { color: Colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  warn: { fontSize: 15, color: Colors.warning, fontWeight: '600' },
  ok: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  choice: { flex: 1, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', backgroundColor: Colors.card },
  choiceOn: { backgroundColor: Colors.primary },
  choiceText: { fontSize: 15, fontWeight: '600', color: Colors.primary, textAlign: 'center' },
});
