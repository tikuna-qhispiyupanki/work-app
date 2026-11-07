import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { ClientInput, ClientKind } from '@/db/clients';

export const EMPTY_CLIENT: ClientInput = { kind: 'particulier', name: '', phone: '', email: '', address: '', postalCode: '', city: '', notes: '' };

// Formulaire de fiche client (création et modification).
export function ClientForm({ initial, submitLabel, onSubmit }: { initial: ClientInput; submitLabel: string; onSubmit: (c: ClientInput) => Promise<void> }) {
  const [f, setF] = useState<ClientInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ClientInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return setError('Le nom est obligatoire.');
    if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setError('Adresse e-mail invalide.');
    setBusy(true);
    try {
      await onSubmit(f);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title="Type de client">
        <View style={styles.row}>
          {(['particulier', 'professionnel'] as ClientKind[]).map((k) => (
            <Pressable key={k} onPress={() => setF((x) => ({ ...x, kind: k }))} style={[styles.choice, f.kind === k && styles.choiceOn]} accessibilityRole="radio" accessibilityState={{ checked: f.kind === k }}>
              <Text style={[styles.choiceText, f.kind === k && { color: Colors.primaryText }]}>{k === 'particulier' ? 'Particulier' : 'Professionnel'}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card title="Coordonnées">
        <Field label={f.kind === 'professionnel' ? 'Nom de la société (ou du contact)' : 'Nom'} value={f.name} onChangeText={set('name')} autoCapitalize="words" />
        <Field label="Téléphone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="E-mail" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      </Card>
      <Card title="Adresse du client (facturation)">
        <Field label="Adresse" value={f.address} onChangeText={set('address')} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Code postal" value={f.postalCode} onChangeText={set('postalCode')} keyboardType="number-pad" maxLength={5} />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="Commune" value={f.city} onChangeText={set('city')} />
          </View>
        </View>
      </Card>
      <Card title="Notes sur le client">
        <Field label="Notes" value={f.notes} onChangeText={set('notes')} multiline placeholder="Ex. préfère être appelé le matin, chien dans le jardin…" />
      </Card>
      {error ? <Text style={{ color: Colors.danger, fontSize: 15 }}>{error}</Text> : null}
      <Button label={busy ? 'Enregistrement…' : submitLabel} onPress={save} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  choice: { flex: 1, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: Colors.card },
  choiceOn: { backgroundColor: Colors.primary },
  choiceText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
});
