import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { createVisit, NewVisitInput } from '@/db/visits';
import { VAT_ZONE_LABEL, vatZoneFromPostalCode } from '@/domain/vat';

const EMPTY: NewVisitInput = {
  clientName: '',
  clientPhone: '',
  siteAddress: '',
  sitePostalCode: '',
  siteCity: '',
  accessNotes: '',
  notes: '',
  nearPowerLines: false,
};

// Formulaire de visite. Pour l'instant : client, adresse, accès, notes.
// La fiche par arbre, le croquis et les photos arrivent à l'étape 4.
export default function NewVisitScreen() {
  const [form, setForm] = useState<NewVisitInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NewVisitInput>(key: K) => (value: NewVisitInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.clientName.trim()) {
      setError('Indique au moins le nom du client.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createVisit(form);
      router.replace({ pathname: '/visites/[id]', params: { id } });
    } catch (e) {
      setError(`Enregistrement impossible : ${String(e)}`);
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title="Client">
        <Field label="Nom" value={form.clientName} onChangeText={set('clientName')} autoCapitalize="words" />
        <Field label="Téléphone" value={form.clientPhone} onChangeText={set('clientPhone')} keyboardType="phone-pad" />
      </Card>

      <Card title="Lieu du chantier">
        <Field label="Adresse" value={form.siteAddress} onChangeText={set('siteAddress')} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Code postal" value={form.sitePostalCode} onChangeText={set('sitePostalCode')} keyboardType="number-pad" maxLength={5} />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="Commune" value={form.siteCity} onChangeText={set('siteCity')} />
          </View>
        </View>
        {form.sitePostalCode.length >= 3 ? (
          <Muted>Zone : {VAT_ZONE_LABEL[vatZoneFromPostalCode(form.sitePostalCode)]}</Muted>
        ) : null}
        <Field label="Accès (portail, stationnement, chemin…)" value={form.accessNotes} onChangeText={set('accessNotes')} multiline />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Lignes électriques à proximité</Text>
          <Switch value={form.nearPowerLines} onValueChange={set('nearPowerLines')} trackColor={{ true: Colors.primary }} />
        </View>
        {form.nearPowerLines ? <Text style={styles.warning}>⚠ DT-DICT à faire avant les travaux.</Text> : null}
      </Card>

      <Card title="Notes">
        <Field label="Notes (tu peux dicter avec le micro du clavier)" value={form.notes} onChangeText={set('notes')} multiline />
      </Card>

      {error ? <Text style={styles.warning}>{error}</Text> : null}
      <Button label={saving ? 'Enregistrement…' : 'Enregistrer la visite'} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  switchLabel: { fontSize: 16, color: Colors.text, flex: 1 },
  warning: { fontSize: 15, color: Colors.warning, fontWeight: '500' },
});
