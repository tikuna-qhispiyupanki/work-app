import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/session';
import { authErrorMessage, supabase } from '@/auth/supabase';
import { Button, Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { newId } from '@/db/database';

// Première connexion : création de l'entreprise (l'utilisateur en devient le gérant).
export default function CompanyScreen() {
  const { session, companyStatus, refreshCompany, signOut } = useAuth();
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    if (!name.trim()) return setError("Indique le nom de ton entreprise.");
    setBusy(true);
    try {
      const { error: e1 } = await supabase.rpc('create_company', { p_id: newId(), p_name: name.trim() });
      if (e1) throw e1;
      if (session && fullName.trim()) {
        await supabase.from('profiles').upsert({ id: session.user.id, full_name: fullName.trim() });
      }
      await refreshCompany();
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  if (companyStatus === 'offline') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card title="Pas de réseau">
          <Muted>Pour cette première connexion, Arboject a besoin d&apos;Internet afin de retrouver ou créer ton entreprise. Réessaie avec du réseau.</Muted>
          <Button label="Réessayer" onPress={refreshCompany} />
        </Card>
      </ScrollView>
    );
  }
  if (companyStatus === 'unknown') return <Muted>Chargement…</Muted>;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card title="Bienvenue sur Arboject 🌳">
        <Muted>Dernière étape : crée ton entreprise. Tu en seras le gérant ; tu pourras inviter ton équipe plus tard.</Muted>
        <Field label="Nom de l'entreprise" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Ex. Élagage des Hauts" />
        <Field label="Ton prénom et ton nom" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <Muted>Les visites et clients déjà enregistrés sur ce téléphone seront rattachés à cette entreprise.</Muted>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={busy ? 'Création…' : "Créer mon entreprise"} onPress={create} disabled={busy} />
      </Card>
      <Muted>Connecté avec {session?.user.email}.</Muted>
      <Text style={styles.link} onPress={signOut}>
        Ce n&apos;est pas moi : me déconnecter
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  error: { color: Colors.danger, fontSize: 15 },
  link: { color: Colors.primary, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
