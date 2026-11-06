import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/session';
import { authErrorMessage, supabase } from '@/auth/supabase';
import { Button, Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';

// Ouvert depuis le lien « Mot de passe oublié » reçu par e-mail.
export default function NewPasswordScreen() {
  const { status } = useAuth();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (status === 'loading') return <Muted>Chargement…</Muted>;

  const save = async () => {
    setError(null);
    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères.');
    if (password !== password2) return setError('Les deux mots de passe ne sont pas identiques.');
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(authErrorMessage(e));
    setDone(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title="Nouveau mot de passe">
        {status !== 'signedIn' ? (
          <>
            <Muted>Ce lien a expiré ou a déjà servi. Redemande un lien avec « Mot de passe oublié ».</Muted>
            <Button label="Retour à la connexion" onPress={() => router.replace('/connexion')} />
          </>
        ) : done ? (
          <>
            <Text style={styles.ok}>Mot de passe changé ✓</Text>
            <Muted>Si tu utilises Arboject depuis l&apos;icône de l&apos;écran d&apos;accueil, ouvre-la et connecte-toi avec ce nouveau mot de passe.</Muted>
            <Button label="Continuer" onPress={() => router.replace('/')} />
          </>
        ) : (
          <>
            <Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="8 caractères minimum" />
            <Field label="Nouveau mot de passe (encore)" value={password2} onChangeText={setPassword2} secureTextEntry autoComplete="new-password" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={busy ? 'Patiente…' : 'Enregistrer'} onPress={save} disabled={busy} />
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  ok: { fontSize: 18, fontWeight: '600', color: Colors.primary },
  error: { color: Colors.danger, fontSize: 15 },
});
