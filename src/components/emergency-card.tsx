import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { callScript, EMERGENCY_NUMBERS, nearestHospital } from '@/domain/emergency';

// « En cas d'accident » : gros boutons d'appel et ce qu'il faut dire (notice MSA). Fonctionne sans internet :
// un appel d'urgence ne passe pas par les données mobiles.
export function EmergencyCard({ company, address, lat, lng }: { company: string | null; address: string | null; lat: number | null; lng: number | null }) {
  const h = lat != null && lng != null ? nearestHospital({ lat, lng }) : null;
  return (
    <Card title="En cas d'accident">
      <Text style={styles.steps}>1. Protéger · 2. Alerter · 3. Secourir</Text>
      <View style={styles.grid}>
        {EMERGENCY_NUMBERS.map((n) => (
          <Pressable
            key={n.number}
            onPress={() => Linking.openURL(n.sms ? 'sms:114' : `tel:${n.number}`)}
            style={[styles.btn, { backgroundColor: n.color }, n.sms && styles.wide]}
            accessibilityRole="button"
            accessibilityLabel={n.sms ? 'Envoyer un SMS au 114' : `Appeler le ${n.number}, ${n.label}`}
          >
            <Text style={styles.num}>{n.number}</Text>
            <Text style={styles.lbl}>{n.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.title}>Au téléphone, dire :</Text>
      {callScript({ company, address, lat, lng }).map((line, i) => (
        <Text key={i} style={styles.line}>
          {i + 1}. {line}
        </Text>
      ))}
      {h ? (
        <View style={styles.row}>
          <Icon name="medkit-outline" size={18} color={Colors.primary} />
          <Text style={[styles.line, { flex: 1 }]}>
            Urgences les plus proches : {h.name}, {h.city} (≈ {Math.round(h.km)} km)
          </Text>
        </View>
      ) : null}
      <Muted>Ne pas déplacer la victime sans l&apos;accord des secours. Envoyer quelqu&apos;un les attendre au point de rencontre.</Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  steps: { fontSize: 16, fontWeight: '700', color: Colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  btn: { flexGrow: 1, flexBasis: '22%', minWidth: 70, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  wide: { flexBasis: '100%' },
  num: { color: '#fff', fontSize: 26, fontWeight: '800' },
  lbl: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 4 },
  line: { fontSize: 15, color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
