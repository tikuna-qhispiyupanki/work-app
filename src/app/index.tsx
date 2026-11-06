import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// Écran d'accueil terrain : chantiers et visites du jour.
// Pour l'instant vide : les données arriveront avec la base locale (étape 2b).
export default function HomeScreen() {
  const date = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const today = date.charAt(0).toUpperCase() + date.slice(1); // « Vendredi 6 novembre »

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.date}>{today}</Text>

      <Section title="Visites du jour" empty="Aucune visite prévue aujourd'hui." />
      <Section title="Chantiers du jour" empty="Aucun chantier prévu aujourd'hui." />
    </ScrollView>
  );
}

function Section({ title, empty }: { title: string; empty: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.empty}>{empty}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  date: { fontSize: 18, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: { fontSize: 20, fontWeight: '600', color: Colors.text },
  empty: { fontSize: 16, color: Colors.textSecondary },
});
