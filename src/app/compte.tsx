import { ScrollView, StyleSheet } from 'react-native';

import { useAuth } from '@/auth/session';
import { confirmAction } from '@/components/confirm';
import { Card, Muted, SecondaryButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const ROLE_LABEL = { gerant: 'Gérant', bureau: 'Bureau', chef_equipe: "Chef d'équipe", technicien: 'Technicien' } as const;

export default function AccountScreen() {
  const { session, company, signOut } = useAuth();
  const logout = async () => {
    const ok = await confirmAction(
      'Se déconnecter ?',
      "Les données restent sur ce téléphone. Il faudra du réseau pour te reconnecter.",
      'Se déconnecter'
    );
    if (ok) await signOut();
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
      <SecondaryButton label="Se déconnecter" danger onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: Spacing.md, gap: Spacing.md } });
