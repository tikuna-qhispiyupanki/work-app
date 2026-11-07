import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/session';
import { confirmAction } from '@/components/confirm';
import { Card, MenuRow, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';

const ROLE_LABEL = { gerant: 'Gérant', bureau: 'Bureau', chef_equipe: "Chef d'équipe", technicien: 'Technicien' } as const;

// « Plus » : entreprise, réglages, compte.
export default function MoreScreen() {
  const { session, company, signOut } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
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
        `Déconnexion impossible pour l'instant : ${res.pending} modification${res.pending > 1 ? 's' : ''} pas encore envoyée${res.pending > 1 ? 's' : ''} au serveur. Attends d'avoir du réseau et que la pastille en haut indique « Envoyé ».`
      );
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {company ? (
        <Card title={company.name}>
          <Muted>
            {session?.user.email} · {ROLE_LABEL[company.role]}
          </Muted>
          <MenuRow icon="business-outline" label="Fiche entreprise" detail="Identité, logo, SIRET, TVA, conditions des devis" onPress={() => router.push('/fiche-entreprise')} />
          <MenuRow icon="pricetags-outline" label="Grille de prix" detail="Prestations, « mon prix », taux horaires, majorations" onPress={() => router.push('/grille')} />
          <MenuRow icon="cloud-upload-outline" label="Synchronisation" detail="Ce qui reste à envoyer au serveur" onPress={() => router.push('/synchro')} />
        </Card>
      ) : null}
      <Card title="Mon compte">
        <MenuRow icon="log-out-outline" label="Se déconnecter" danger onPress={logout} />
        {message ? <Text style={{ color: Colors.danger, fontSize: 15 }}>{message}</Text> : null}
      </Card>
      <Muted>Arboject – version de test. Invitation de l&apos;équipe : à venir.</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl } });
