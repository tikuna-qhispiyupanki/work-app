import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// Date et heure avec les sélecteurs natifs de l'iPhone (roulettes).
// `value` est une date ISO ; l'affichage est en heure locale du téléphone.
export function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const update = (newDate: string, newTime: string) => {
    const next = new Date(`${newDate}T${newTime || '00:00'}`);
    if (!Number.isNaN(next.getTime())) onChange(next.toISOString());
  };
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <input type="date" aria-label={`${label} – jour`} value={date} onChange={(e) => update(e.target.value, time)} style={input} />
        <input type="time" aria-label={`${label} – heure`} value={time} onChange={(e) => update(date, e.target.value)} style={{ ...input, flex: '0 0 110px' }} />
      </View>
    </View>
  );
}

const input: React.CSSProperties = {
  flex: 1,
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
