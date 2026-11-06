import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/session';
import { confirmAction } from '@/components/confirm';
import { Card, Muted, SecondaryButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { readSyncFailures } from '@/sync/connector';

const ROLE_LABEL = { gerant: 'Gérant', bureau: 'Bureau', chef_equipe: "Chef d'équipe", technicien: 'Technicien' } as const;

export default function AccountScreen() {
  const { session, company, signOut } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const failures = readSyncFailures();
  const logout = async () => {
    const ok = await confirmAction(
      'Se déconnecter ?',
      'Les données seront retirées de ce téléphone (elles restent sur le serveur). Il faudra du réseau pour te reconnecter.',
      'Se déconnecter'
    );
    if (!ok) return;
    const res = await signOut();
    if (!res.ok) {
      setMessage(
        `Déconnexion impossible pour l'instant : ${res.pending} modification${res.pending > 1 ? 's' : ''} pas encore envoyée${res.pending > 1 ? 's' : ''} au serveur. Attends d'avoir du réseau et que le bandeau du bas indique « Tout est envoyé ».`
      );
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title="Mon compte">
        <Muted>✉️ {session?.user.email}</Muted>
      </Card>
      {company ? (
        <Card title={company.name}>
          <Muted>Mon rôle : {ROLE_LABEL[company.role]}</Muted>
          <Muted>Fiche entreprise (SIRET, TVA, logo…) et invitation de l&apos;équipe : à venir.</Muted>
        </Card>
      ) : null}
      {failures.length ? (
        <Card title="Modifications refusées par le serveur">
          {failures.slice(-10).map((f, i) => (
            <Muted key={i}>
              {new Date(f.at).toLocaleString('fr-FR')} · {f.table} · {f.message}
            </Muted>
          ))}
          <Muted>Envoie une capture de cet écran : ces lignes aident à corriger le problème.</Muted>
        </Card>
      ) : null}
      {message ? <Text style={{ color: Colors.danger, fontSize: 15 }}>{message}</Text> : null}
      <SecondaryButton label="Se déconnecter" danger onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: Spacing.md, gap: Spacing.md } });
