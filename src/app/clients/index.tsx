import { useQuery } from '@powersync/react';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { ClientRow, CLIENTS_SEARCH_SQL } from '@/db/clients';

// Carnet clients : tous les clients, avec recherche.
export default function ClientsScreen() {
  const [q, setQ] = useState('');
  const s = q.trim();
  const { data: clients, isLoading } = useQuery<ClientRow>(CLIENTS_SEARCH_SQL, [s, s, s, s]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Field label="Rechercher (nom, téléphone, commune)" value={q} onChangeText={setQ} autoCapitalize="none" />
      <Card title={`${clients.length} client${clients.length > 1 ? 's' : ''}`}>
        {isLoading ? <Muted>Chargement…</Muted> : null}
        {!isLoading && clients.length === 0 ? (
          <Muted>{s ? 'Aucun client trouvé.' : 'Le carnet se remplit tout seul quand tu crées des visites.'}</Muted>
        ) : null}
        {clients.map((c) => (
          <Link key={c.id} href={{ pathname: '/clients/[id]', params: { id: c.id } }} asChild>
            <Pressable style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name || 'Client sans nom'}</Text>
                <Text style={styles.sub}>{[c.city, c.phone].filter(Boolean).join(' · ') || 'Coordonnées à compléter'}</Text>
              </View>
              <Text style={styles.sub}>
                {c.visit_count} visite{c.visit_count > 1 ? 's' : ''}
              </Text>
            </Pressable>
          </Link>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  name: { fontSize: 17, fontWeight: '500', color: Colors.text },
  sub: { fontSize: 14, color: Colors.textSecondary },
});
