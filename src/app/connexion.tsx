import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appUrl, authErrorMessage, supabase } from '@/auth/supabase';
import { Button, Card, Field, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';

type Mode = 'login' | 'signup' | 'forgot';

// Connexion, création de compte et mot de passe oublié.
export default function LoginScreen() {
  const params = useLocalSearchParams<{ confirme?: string }>();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(params.confirme ? 'Adresse e-mail confirmée ✓ Tu peux te connecter.' : null);

  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return setError('Saisis une adresse e-mail valide.');
    if (mode !== 'forgot' && password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères.');
    if (mode === 'signup' && password !== password2) return setError('Les deux mots de passe ne sont pas identiques.');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (e) throw e;
        // La suite (choix de l'entreprise, accueil) se fait automatiquement.
      } else if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { emailRedirectTo: appUrl('connexion?confirme=1') },
        });
        if (e) throw e;
        if (data.user && data.user.identities?.length === 0) {
          setError('Un compte existe déjà avec cette adresse : connecte-toi, ou utilise « Mot de passe oublié ».');
        } else {
          setMode('login');
          setPassword2('');
          setInfo(
            `Compte créé. Un e-mail (en anglais, objet « Confirm your signup ») vient d'être envoyé à ${mail}. Clique sur le lien qu'il contient, puis reviens ici et connecte-toi.`
          );
        }
      } else {
        const { error: e } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: appUrl('mot-de-passe') });
        if (e) throw e;
        setMode('login');
        setInfo(`Si un compte existe pour ${mail}, un e-mail (objet « Reset Your Password ») vient d'être envoyé. Clique sur le lien pour choisir un nouveau mot de passe.`);
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié';
  const action = mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien par e-mail';

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <Image source={require('../../assets/images/logo-96.png')} style={styles.logo} accessibilityLabel="Logo Arboject" />
        <Text style={styles.brandName}>Arboject</Text>
        <Muted>Visites, devis et chantiers d&apos;élagage</Muted>
      </View>

      <Card title={title}>
        <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        {mode !== 'forgot' ? (
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={mode === 'signup' ? '8 caractères minimum' : undefined}
          />
        ) : null}
        {mode === 'signup' ? (
          <Field label="Mot de passe (encore)" value={password2} onChangeText={setPassword2} secureTextEntry autoComplete="new-password" />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <Button label={busy ? 'Patiente…' : action} onPress={submit} disabled={busy} />
      </Card>

      <View style={styles.links}>
        {mode !== 'login' ? <Link label="J'ai déjà un compte : me connecter" onPress={() => go('login')} /> : null}
        {mode !== 'signup' ? <Link label="Créer un compte" onPress={() => go('signup')} /> : null}
        {mode !== 'forgot' ? <Link label="Mot de passe oublié ?" onPress={() => go('forgot')} /> : null}
      </View>
    </ScrollView>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ paddingVertical: 8 }}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md, paddingTop: Spacing.xl },
  brand: { alignItems: 'center', gap: Spacing.xs },
  logo: { width: 96, height: 96, borderRadius: 20 },
  brandName: { fontSize: 28, fontWeight: '700', color: Colors.primary },
  error: { color: Colors.danger, fontSize: 15 },
  info: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  links: { alignItems: 'center' },
  link: { color: Colors.primary, fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
});
