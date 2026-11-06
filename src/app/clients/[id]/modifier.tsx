import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { CLIENT_DETAIL_SQL, ClientInput, ClientRow, updateClient } from '@/db/clients';

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery<ClientRow>(CLIENT_DETAIL_SQL, [id]);
  if (isLoading) return <Muted>Chargement…</Muted>;
  if (!data[0]) return <Muted>Client introuvable.</Muted>;
  return <ClientForm client={data[0]} />;
}

function ClientForm({ client }: { client: ClientRow }) {
  const [f, setF] = useState<ClientInput>({
    name: client.name ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    address: client.address ?? '',
    postalCode: client.postal_code ?? '',
    city: client.city ?? '',
    notes: client.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ClientInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return setError('Le nom est obligatoire.');
    await updateClient(client.id, f);
    router.back();
  };
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title="Coordonnées">
        <Field label="Nom" value={f.name} onChangeText={set('name')} autoCapitalize="words" />
        <Field label="Téléphone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="E-mail" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      </Card>
      <Card title="Adresse du client (facturation)">
        <Field label="Adresse" value={f.address} onChangeText={set('address')} />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
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
      {error ? <Text style={{ color: Colors.warning, fontSize: 15 }}>{error}</Text> : null}
      <Button label="Enregistrer" onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl } });
