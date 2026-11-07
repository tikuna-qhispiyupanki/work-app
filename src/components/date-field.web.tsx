import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// Jour seul (« AAAA-MM-JJ »), avec le sélecteur de date de l'iPhone. Vide = pas encore choisi.
export function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (day: string | null) => void }) {
  return (
    <View style={{ gap: Spacing.xs, flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <input type="date" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} style={input} />
    </View>
  );
}

const input: React.CSSProperties = {
  fontSize: 17,
  padding: '10px 12px',
  border: `1px solid ${Colors.border}`,
  borderRadius: 8,
  background: Colors.card,
  color: Colors.text,
  fontFamily: 'inherit',
  minWidth: 0,
};

const styles = StyleSheet.create({ label: { fontSize: 15, fontWeight: '500', color: Colors.text } });
